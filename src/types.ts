/**
 * Core types for the Piel Music Player.
 */

export interface Song {
  id: string; // Hash of file path or UUID
  title: string;
  artist: string;
  album: string;
  genre?: string;
  year?: number;
  duration: number; // in seconds
  trackNumber?: number;
  picture?: string; // Data URL or URL
  data?: Blob; // The actual file content for persistence
  url?: string; // Temporary Blob URL
  addedAt: number;
  playCount: number;
  lastPlayedAt?: number;
  rating?: number;
  bpm?: number;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  songIds: string[];
  isSmart: boolean;
  smartRules?: SmartRule[];
  createdAt: number;
  customCover?: string;
}

export interface SmartRule {
  field: keyof Song;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'between';
  value: any;
}

export interface PlaybackState {
  currentSongId: string | null;
  queue: string[];
  history: string[];
  isPlaying: boolean;
  isShuffle: boolean;
  isRepeat: 'off' | 'all' | 'one';
  volume: number;
  playbackSpeed: number;
  currentTime: number;
  isGapless?: boolean;
  isNormalized?: boolean;
}

export interface ListeningStat {
  songId: string;
  timestamp: number;
  durationPlayed: number;
}
