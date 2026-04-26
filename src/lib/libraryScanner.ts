import * as mmb from 'music-metadata-browser';
import { Song } from '../types';

export async function parseSongFile(file: File): Promise<Song> {
  const metadata = await mmb.parseBlob(file);
  const common = metadata.common;
  const format = metadata.format;

  let pictureBase64 = '';
  if (common.picture && common.picture.length > 0) {
    const pic = common.picture[0];
    const blob = new Blob([pic.data], { type: pic.format });
    pictureBase64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }

  return {
    id: `${file.name}-${file.size}-${file.lastModified}`, // More stable ID than random for duplicates
    title: common.title || file.name.replace(/\.[^/.]+$/, ""),
    artist: common.artist || 'Unknown Artist',
    album: common.album || 'Unknown Album',
    genre: common.genre?.[0],
    year: common.year,
    duration: format.duration || 0,
    trackNumber: common.track.no || undefined,
    picture: pictureBase64,
    data: file,
    url: URL.createObjectURL(file),
    addedAt: Date.now(),
    playCount: 0,
  };
}

export async function scanDirectory(files: FileList): Promise<Song[]> {
  const songs: Song[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    // Improved check: some browsers don't give a type for all audio files
    const isAudio = file.type.startsWith('audio/') || 
                    /\.(mp3|flac|wav|aac|ogg|m4a|mp4|m4b)$/i.test(file.name);

    if (isAudio) {
      try {
        const song = await parseSongFile(file);
        songs.push(song);
      } catch (e) {
        console.error(`Piel Engine Error: Failed to decode ${file.name}. This format might be corrupted or unsupported by your browser's decoder.`, e);
      }
    } else {
      // Ignore known non-audio files quietly, but maybe log others
      if (!file.name.startsWith('.') && !['Thumbs.db', 'desktop.ini', 'folder.jpg', 'cover.jpg'].includes(file.name)) {
        console.warn(`Piel Engine: Ignoring non-audio file ${file.name}`);
      }
    }
  }
  return songs;
}
