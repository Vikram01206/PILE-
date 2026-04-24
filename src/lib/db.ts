import { openDB, IDBPDatabase } from 'idb';
import { Song, Playlist, ListeningStat } from '../types';

const DB_NAME = 'piel_db';
const DB_VERSION = 2; // Bumped for schema change (Blob storage)

export async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        // Songs store
        if (!db.objectStoreNames.contains('songs')) {
          db.createObjectStore('songs', { keyPath: 'id' });
        }
        
        // Playlists store
        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' });
        }
  
        // Stats/History store
        if (!db.objectStoreNames.contains('stats')) {
          db.createObjectStore('stats', { keyPath: 'timestamp' });
        }
  
        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      }
      
      // If upgrading from v1 to v2, we might want to clear old stale data
      if (oldVersion === 1) {
        db.deleteObjectStore('songs');
        db.createObjectStore('songs', { keyPath: 'id' });
      }
    },
  });
}

const dbPromise = initDB();

export const db = {
  async saveSong(song: Song) {
    const d = await dbPromise;
    return d.put('songs', song);
  },
  async getSong(id: string): Promise<Song | undefined> {
    const d = await dbPromise;
    return d.get('songs', id);
  },
  async getAllSongs(): Promise<Song[]> {
    const d = await dbPromise;
    return d.getAll('songs');
  },
  async savePlaylist(playlist: Playlist) {
    const d = await dbPromise;
    return d.put('playlists', playlist);
  },
  async getAllPlaylists(): Promise<Playlist[]> {
    const d = await dbPromise;
    return d.getAll('playlists');
  },
  async deletePlaylist(id: string) {
    const d = await dbPromise;
    return d.delete('playlists', id);
  },
  async logPlay(stat: ListeningStat) {
    const d = await dbPromise;
    return d.add('stats', stat);
  },
  async getStats(): Promise<ListeningStat[]> {
    const d = await dbPromise;
    return d.getAll('stats');
  },
};
