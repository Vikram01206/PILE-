import { Filesystem, Directory } from '@capacitor/filesystem';
import { Device } from '@capacitor/device';
import { NativeSettings } from 'capacitor-native-settings';
import * as mmb from 'music-metadata-browser';
import { Song } from '../types';
import { db } from './db';

export async function isNative(): Promise<boolean> {
  const info = await Device.getInfo();
  return info.platform === 'android' || info.platform === 'ios';
}

export async function openSettings() {
  if (await isNative()) {
    try {
      await (NativeSettings as any).open({
        option: 'app',
      });
    } catch (e) {
      console.error('Piel Engine: Failed to open settings via plugin:', e);
      // Fallback: This might work on some Android devices
      window.open('package:com.piel.musicplayer', '_system');
    }
  }
}

export async function checkPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!(await isNative())) return 'granted';
  
  try {
    const status = await Filesystem.checkPermissions();
    console.log('Piel Engine: raw checkPermissions status:', JSON.stringify(status));
    
    // Some versions of Android (13+) might report 'granted' for specific media types
    // but capacitor-filesystem might map them to publicStorage
    const publicStorage = status.publicStorage;
    
    if (publicStorage === 'granted') {
      console.log('Piel Engine: Public storage permission is GRANTED');
      return 'granted';
    }
    if (publicStorage === 'denied') {
      console.log('Piel Engine: Public storage permission is DENIED');
      return 'denied';
    }
    console.log('Piel Engine: Public storage permission is in PROMPT state');
  } catch (e) {
    console.error('Piel Engine: checkPermissions error:', e);
  }
  return 'prompt';
}

export async function requestPermissions() {
  if (await isNative()) {
    try {
      console.log('Piel Engine: Calling Filesystem.requestPermissions()...');
      const status = await Filesystem.requestPermissions();
      console.log('Piel Engine: raw requestPermissions result:', JSON.stringify(status));
      return status.publicStorage;
    } catch (e) {
      console.error('Piel Engine: Error requesting permissions:', e);
      return 'denied';
    }
  }
  return 'granted';
}

export async function scanNativeMusic(onProgress?: (count: number, currentFile?: string) => void): Promise<Song[]> {
  const pStatus = await checkPermission();
  console.log('Piel Engine: Current permission status:', pStatus);
  
  if (pStatus !== 'granted') {
    const newStatus = await requestPermissions();
    if (newStatus !== 'granted') {
      throw new Error('Permission denied. Please enable storage access in settings to scan your music library.');
    }
  }
  
  const foundSongs: Song[] = [];
  const audioExtensions = ['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'mp4', 'm4b'];

  // Common directories on Android
  const dirsToScan = [
    { dir: Directory.ExternalStorage, path: 'Music' },
    { dir: Directory.ExternalStorage, path: 'Download' },
    { dir: Directory.ExternalStorage, path: 'Recordings' },
    { dir: Directory.Documents, path: '' }
  ];
  
  const scannedPaths = new Set<string>();

  for (const scanTarget of dirsToScan) {
    try {
      console.log(`Piel Engine: Scanning ${scanTarget.dir}/${scanTarget.path}`);
      await scanRecursive(scanTarget.dir, scanTarget.path, foundSongs, audioExtensions, scannedPaths, onProgress);
    } catch (e) {
      console.warn(`Piel Engine: Failed to scan ${scanTarget.path}:`, e);
    }
  }

  // If we found nothing in common folders, try root cautiously
  // On Android 11+, this will likely fail without MANAGE_EXTERNAL_STORAGE
  if (foundSongs.length === 0) {
    try {
      console.log('Piel Engine: No signals found in common sectors. Attempting broad spectrum scan...');
      await scanRecursive(Directory.ExternalStorage, '', foundSongs, audioExtensions, scannedPaths, onProgress);
    } catch (e) {
      console.warn('Piel Engine: Broad spectrum scan failed. This usually indicates restricted storage access on modern Android systems.');
      throw new Error('No music found. On modern Android devices, you may need to grant "All Files Access" in system settings.');
    }
  }

  return foundSongs;
}

async function scanRecursive(
  directory: Directory, 
  path: string, 
  foundSongs: Song[], 
  extensions: string[],
  scannedPaths: Set<string>,
  onProgress?: (count: number, currentFile?: string) => void
) {
  const fullKey = `${directory}:${path}`;
  if (scannedPaths.has(fullKey)) return;
  scannedPaths.add(fullKey);

  try {
    const result = await Filesystem.readdir({
      directory,
      path
    });

    for (const file of result.files) {
      const fullPath = path ? `${path}/${file.name}` : file.name;
      
      if (file.type === 'directory') {
        // Exclude system and hidden folders
        const systemFolders = ['Android', 'data', 'Lost.dir', 'system', 'logs'];
        if (!file.name.startsWith('.') && !systemFolders.includes(file.name)) {
          await scanRecursive(directory, fullPath, foundSongs, extensions, scannedPaths, onProgress);
        }
      } else {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (extensions.includes(ext)) {
          try {
            onProgress?.(foundSongs.length, file.name);
            const song = await parseNativeFile(directory, fullPath, file.name);
            if (song) {
              foundSongs.push(song);
              await db.saveSong(song);
            }
          } catch (e) {
            console.error(`Piel Engine: Error parsing ${fullPath}:`, e);
          }
        }
      }
    }
  } catch (e) {
    // Some directories might be restricted by Scoped Storage
    console.debug(`Piel Engine: Skipping restricted directory ${path}`);
  }
}

async function parseNativeFile(directory: Directory, path: string, fileName: string): Promise<Song | null> {
  const result = await Filesystem.readFile({
    directory,
    path
  });

  // Convert base64 to Blob
  const byteCharacters = atob(result.data as string);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'audio/' + fileName.split('.').pop() });
  
  // Reuse existing logic from libraryScanner if possible, or replicate here
  const metadata = await mmb.parseBlob(blob);
  const common = metadata.common;
  const format = metadata.format;

  let pictureBase64 = '';
  if (common.picture && common.picture.length > 0) {
    const pic = common.picture[0];
    const picBlob = new Blob([pic.data], { type: pic.format });
    pictureBase64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(picBlob);
    });
  }

  // Create a pseudo-file for compatibility if needed, 
  // but for native storage we might need a different 'data' approach 
  // since the blob won't persist across reloads in memory.
  // Actually, db handles blobs/files if they are stored in IndexedDB.
  
  return {
    id: `native-${path}-${typeof result.data === 'string' ? result.data.length : (result.data as Blob).size}`,
    title: common.title || fileName.replace(/\.[^/.]+$/, ""),
    artist: common.artist || 'Unknown Artist',
    album: common.album || 'Unknown Album',
    genre: common.genre?.[0],
    year: common.year,
    duration: format.duration || 0,
    trackNumber: common.track.no || undefined,
    picture: pictureBase64,
    // Store the path in native systems instead of the whole blob?
    // Actually, IndexedDB is fine for storing blobs/files on Android too.
    data: new File([blob], fileName, { type: blob.type }),
    url: URL.createObjectURL(blob),
    addedAt: Date.now(),
    playCount: 0,
    nativePath: path,
    nativeDirectory: directory
  };
}
