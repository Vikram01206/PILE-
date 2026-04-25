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
      const { Capacitor } = await import('@capacitor/core');
      await (Capacitor as any).Plugins.MediaStorePlugin.openSettings();
    } catch (e) {
      console.error('Piel Engine: Failed to open settings via plugin:', e);
      window.open('package:com.piel.musicplayer', '_system');
    }
  }
}

export async function openAllFilesAccess() {
  if (await isNative()) {
    console.log('Piel Engine: Attempting to open All Files Access settings...');
    try {
      const { Capacitor } = await import('@capacitor/core');
      await (Capacitor as any).Plugins.MediaStorePlugin.openAllFilesAccess();
    } catch (e) {
      console.warn('Piel Engine: openAllFilesAccess failed, falling back to app details.');
      await openSettings();
    }
  }
}

export async function checkPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!(await isNative())) return 'granted';
  
  try {
    const { Capacitor } = await import('@capacitor/core');
    const status = await (Capacitor as any).Plugins.MediaStorePlugin.checkPermissions();
    console.log('Piel Engine: MediaStorePlugin checkPermissions status:', JSON.stringify(status));
    
    // Check both for broadest compatibility
    if (status.audio === 'granted' || status.storage === 'granted') {
      return 'granted';
    }
    if (status.audio === 'denied' || status.storage === 'denied') {
      return 'denied';
    }
  } catch (e) {
    console.warn('Piel Engine: MediaStorePlugin checkPermissions failed, falling back to Filesystem:', e);
    try {
      const status = await Filesystem.checkPermissions();
      if (status.publicStorage === 'granted') return 'granted';
      if (status.publicStorage === 'denied') return 'denied';
    } catch (err) {
      console.error('Piel Engine: Permission check failed:', err);
    }
  }
  return 'prompt';
}

export async function requestPermissions() {
  if (await isNative()) {
    try {
      const { Capacitor } = await import('@capacitor/core');
      console.log('Piel Engine: Calling MediaStorePlugin.requestPermissions()...');
      const status = await (Capacitor as any).Plugins.MediaStorePlugin.requestPermissions();
      console.log('Piel Engine: MediaStorePlugin requestPermissions result:', JSON.stringify(status));
      return (status.audio === 'granted' || status.storage === 'granted') ? 'granted' : 'denied';
    } catch (e) {
      console.warn('Piel Engine: MediaStorePlugin requestPermissions failed, falling back to Filesystem:', e);
      try {
        const status = await Filesystem.requestPermissions();
        return status.publicStorage;
      } catch (err) {
        console.error('Piel Engine: Error requesting permissions:', err);
        return 'denied';
      }
    }
  }
  return 'granted';
}

export async function pickAndDeepScan(): Promise<{ folders: any[] }> {
  if (!(await isNative())) return { folders: [] };
  
  try {
    const { Capacitor } = await import('@capacitor/core');
    const { Preferences } = await import('@capacitor/preferences');
    
    // 1. Pick the folder
    const pickResult = await (Capacitor as any).Plugins.MediaStorePlugin.pickFolder();
    const folderUri = pickResult.uri;
    
    if (!folderUri) return { folders: [] };
    
    // 2. Save root URI
    const { value } = await Preferences.get({ key: 'root_folders' });
    let folders: string[] = value ? JSON.parse(value) : [];
    if (!folders.includes(folderUri)) {
      folders.push(folderUri);
      await Preferences.set({ key: 'root_folders', value: JSON.stringify(folders) });
    }
    
    // 3. Scan
    return await (Capacitor as any).Plugins.MediaStorePlugin.deepScan({ uri: folderUri });
  } catch (e) {
    console.error('Piel Engine: Deep Scan failed:', e);
    return { folders: [] };
  }
}

export async function getRootFolderScans(): Promise<{ folders: any[] }> {
  if (!(await isNative())) return { folders: [] };
  
  try {
    const { Capacitor } = await import('@capacitor/core');
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key: 'root_folders' });
    
    if (!value) return { folders: [] };
    
    const rootUris: string[] = JSON.parse(value);
    let allFolders: any[] = [];
    
    for (const uri of rootUris) {
      try {
        const result = await (Capacitor as any).Plugins.MediaStorePlugin.deepScan({ uri });
        if (result && result.folders) {
          allFolders = [...allFolders, ...result.folders];
        }
      } catch (err) {
        console.warn(`Piel Engine: Auto-scan failed for ${uri}:`, err);
      }
    }
    
    if (allFolders.length > 0) {
      await ingestDeepScanResults(allFolders);
    }
    
    return { folders: allFolders };
  } catch (e) {
    console.error('Piel Engine: Error loading root folders:', e);
    return { folders: [] };
  }
}

export async function ingestDeepScanResults(folders: any[]) {
  const songs: Song[] = [];
  for (const folder of folders) {
    for (const song of folder.songs) {
      songs.push({
        id: `saf-${song.uri}`,
        title: song.name.replace(/\.[^/.]+$/, ""),
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        duration: 0,
        addedAt: Date.now(),
        playCount: 0,
        nativePath: song.uri,
        folderPath: folder.folderName,
        data: new File([], song.name),
        url: song.uri
      });
    }
  }

  for (const s of songs) {
    await db.saveSong(s);
  }
  return songs;
}

export async function pickAndScanFolder(): Promise<Song[]> {
  if (!(await isNative())) return [];
  
  try {
    const { Capacitor } = await import('@capacitor/core');
    const { Preferences } = await import('@capacitor/preferences');
    
    // 1. Pick the folder
    const pickResult = await (Capacitor as any).Plugins.MediaStorePlugin.pickFolder();
    const folderUri = pickResult.uri;
    
    if (!folderUri) return [];
    
    // 2. Save the folder URI for future scans
    const { value } = await Preferences.get({ key: 'manual_folders' });
    let folders: string[] = value ? JSON.parse(value) : [];
    if (!folders.includes(folderUri)) {
      folders.push(folderUri);
      await Preferences.set({ key: 'manual_folders', value: JSON.stringify(folders) });
    }
    
    // 3. Scan the folder
    return await scanFolderUri(folderUri);
  } catch (e) {
    console.error('Piel Engine: Folder picker failed:', e);
    return [];
  }
}

async function scanFolderUri(uri: string): Promise<Song[]> {
  const { Capacitor } = await import('@capacitor/core');
  const scanResult = await (Capacitor as any).Plugins.MediaStorePlugin.scanFolder({ uri });
  const files = scanResult.files;
  const songs: Song[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileName = file.name || 'Unknown';
    const displayPath = file.path || 'Music';
    
    songs.push({
      id: `saf-${file.uri}`,
      title: file.name && file.name.replace(/\.[^/.]+$/, "") || 'Unknown',
      artist: file.artist || 'Unknown Artist',
      album: file.album || 'Unknown Album',
      duration: (file.duration || 0) / 1000,
      addedAt: Date.now(),
      playCount: 0,
      nativePath: file.uri,
      folderPath: displayPath,
      data: new File([], fileName),
      url: file.uri
    });
  }
  return songs;
}

export async function getMediaStoreSongs(): Promise<Song[]> {
  if (!(await isNative())) {
    console.log('Piel Engine: Not a native platform, skipping scan.');
    return [];
  }
  
  // Explicitly ensure permissions before querying MediaStore
  const pStatus = await checkPermission();
  console.log(`Piel Engine: Permission status before scan: ${pStatus}`);
  
  if (pStatus !== 'granted') {
    const reqStatus = await requestPermissions();
    console.log(`Piel Engine: Requesting permissions, result: ${reqStatus}`);
    if (reqStatus !== 'granted') {
      alert("SIGNAL BLOCKED: Storage access was denied by the system.");
      return [];
    }
  }

  try {
    const { Capacitor } = await import('@capacitor/core');
    const { Preferences } = await import('@capacitor/preferences');
    
    // 1. Automatic Scan
    console.log('Piel Engine: Initiating native query...');
    const result = await (Capacitor as any).Plugins.MediaStorePlugin.getAudioFiles();
    const files = result.files;
    console.log(`Piel Engine: Native query returned ${files?.length || 0} files.`);
    
    let songs: Song[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name || 'Unknown';
      
      // Use the URI for playback and ID
      // If path is available (it will be RELATIVE_PATH), use it for grouping
      const displayPath = file.path || 'Music';
      
      songs.push({
        id: `ms-${file.uri}`,
        title: file.name && file.name.replace(/\.[^/.]+$/, "") || 'Unknown',
        artist: file.artist || 'Unknown Artist',
        album: file.album || 'Unknown Album',
        duration: (file.duration || 0) / 1000,
        addedAt: Date.now(),
        playCount: 0,
        nativePath: file.uri, // Store the URI as nativePath for playback
        folderPath: displayPath, // Store for grouping
        data: new File([], fileName), // Placeholder
        url: file.uri // Use the content URI directly
      });
    }
    
    // 2. Manual Folders Scan
    const { value } = await Preferences.get({ key: 'manual_folders' });
    if (value) {
      const folders: string[] = JSON.parse(value);
      for (const folderUri of folders) {
        try {
          const folderSongs = await scanFolderUri(folderUri);
          // Only add unique songs by URI
          for (const s of folderSongs) {
            if (!songs.find(existing => existing.nativePath === s.nativePath)) {
              songs.push(s);
            }
          }
        } catch (err) {
          console.warn(`Piel Engine: Failed to scan manual folder ${folderUri}:`, err);
        }
      }
    }

    return songs;
  } catch (e) {
    console.error('Piel Engine: MediaStore query failed:', e);
    return [];
  }
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
      
      if (foundSongs.length === 0) {
        throw new Error('No music found. On modern Android devices, you may need to grant "All Files Access" in system settings to let the engine scan your entire storage.');
      }
    } catch (e: any) {
      console.warn('Piel Engine: Broad spectrum scan failed. This usually indicates restricted storage access on modern Android systems.');
      if (e.message?.includes('No music found')) throw e;
      throw new Error('Scan restricted. On Android 11+, you must grant "All Files Access" in system settings to detect files outside standard media folders.');
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
