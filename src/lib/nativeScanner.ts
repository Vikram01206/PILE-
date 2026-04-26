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
  const isNativeApp = await isNative();
  
  if (isNativeApp) {
    try {
      const { Capacitor } = await import('@capacitor/core');
      const { Preferences } = await import('@capacitor/preferences');
      
      const pickResult = await (Capacitor as any).Plugins.MediaStorePlugin.pickFolder();
      const folderUri = pickResult.uri;
      
      if (!folderUri) return { folders: [] };
      
      const { value } = await Preferences.get({ key: 'root_folders' });
      let rootFolders: string[] = value ? JSON.parse(value) : [];
      if (!rootFolders.includes(folderUri)) {
        rootFolders.push(folderUri);
        await Preferences.set({ key: 'root_folders', value: JSON.stringify(rootFolders) });
      }
      
      return await (Capacitor as any).Plugins.MediaStorePlugin.deepScan({ uri: folderUri });
    } catch (e) {
      console.error('Piel Engine: Native Deep Scan failed:', e);
      return { folders: [] };
    }
  } else {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      (input as any).webkitdirectory = true;
      
      input.onchange = async (e: any) => {
        const files: File[] = Array.from(e.target.files);
        const foldersMap = new Map<string, any>();
        
        for (const file of files) {
          if (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|flac|m4a|ogg|aac)$/i)) {
            const relPath = file.webkitRelativePath || file.name;
            const pathParts = relPath.split('/');
            pathParts.pop(); // remove filename
            const folderName = pathParts.pop() || 'Root';
            const folderPath = pathParts.join('/');
            
            if (!foldersMap.has(folderPath)) {
              foldersMap.set(folderPath, { folderName, songs: [], songCount: 0 });
            }
            
            const folder = foldersMap.get(folderPath);
            folder.songs.push({ name: file.name, uri: URL.createObjectURL(file) });
            folder.songCount++;
          }
        }
        
        const folders = Array.from(foldersMap.values());
        resolve({ folders });
      };
      
      input.click();
    });
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
        console.warn(`Piel Engine: Auto-scan failed for persisted URI ${uri}:`, err);
      }
    }
    
    return { folders: allFolders };
  } catch (e) {
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
  const result = await pickAndDeepScan();
  if (result && result.folders) {
    return await ingestDeepScanResults(result.folders);
  }
  return [];
}

export async function scanNativeMusic(onProgress?: (count: number, currentFile?: string) => void): Promise<Song[]> {
  // Compatibility shim: Trigger auto-rescan of root folders
  const result = await getRootFolderScans();
  if (result && result.folders) {
    return await ingestDeepScanResults(result.folders);
  }
  return [];
}

export async function getMediaStoreSongs(): Promise<Song[]> {
  return [];
}

