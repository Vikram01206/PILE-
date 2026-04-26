import { Filesystem, Directory } from '@capacitor/filesystem';
import { Device } from '@capacitor/device';
import * as mmb from 'music-metadata-browser';
import { Song } from '../types';
import { db } from './db';

export async function isNative(): Promise<boolean> {
  const info = await Device.getInfo();
  return info.platform === 'android' || info.platform === 'ios';
}

export async function checkPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!(await isNative())) return 'granted';
  
  const status = await Filesystem.checkPermissions();
  if (status.publicStorage === 'granted') return 'granted';
  if (status.publicStorage === 'denied') return 'denied';
  return 'prompt';
}

export async function requestPermissions() {
  if (await isNative()) {
    const status = await Filesystem.requestPermissions();
    if (status.publicStorage !== 'granted') {
      throw new Error('Storage permission denied');
    }
    return status.publicStorage;
  }
  return 'granted';
}

export async function scanNativeMusic(onProgress?: (count: number) => void): Promise<Song[]> {
  const pStatus = await checkPermission();
  if (pStatus !== 'granted') {
    await requestPermissions();
  }
  
  const foundSongs: Song[] = [];
  const audioExtensions = ['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'mp4', 'm4b'];

  // Common directories to scan on Android
  const dirsToScan = [
    { dir: Directory.ExternalStorage, path: 'Music' },
    { dir: Directory.ExternalStorage, path: 'Download' },
    { dir: Directory.Documents, path: '' }
  ];

  for (const scanTarget of dirsToScan) {
    try {
      await scanRecursive(scanTarget.dir, scanTarget.path, foundSongs, audioExtensions, onProgress);
    } catch (e) {
      console.warn(`Failed to scan ${scanTarget.path}:`, e);
    }
  }

  return foundSongs;
}

async function scanRecursive(
  directory: Directory, 
  path: string, 
  foundSongs: Song[], 
  extensions: string[],
  onProgress?: (count: number) => void
) {
  try {
    const result = await Filesystem.readdir({
      directory,
      path
    });

    for (const file of result.files) {
      const fullPath = path ? `${path}/${file.name}` : file.name;
      
      if (file.type === 'directory') {
        // Limit depth or exclude certain folders if needed
        if (!file.name.startsWith('.') && file.name !== 'Android') {
          await scanRecursive(directory, fullPath, foundSongs, extensions, onProgress);
        }
      } else {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (extensions.includes(ext)) {
          try {
            // Check if already in DB to avoid re-parsing?
            // For now, parse it
            const song = await parseNativeFile(directory, fullPath, file.name);
            if (song) {
              foundSongs.push(song);
              onProgress?.(foundSongs.length);
              
              // Save to DB immediately so user sees progress
              await db.saveSong(song);
            }
          } catch (e) {
            console.error(`Error parsing native file ${fullPath}:`, e);
          }
        }
      }
    }
  } catch (e) {
    console.error(`Error reading directory ${path}:`, e);
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
