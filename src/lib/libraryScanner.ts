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
    nativePath: (file as any).webkitRelativePath || file.name
  };
}

export async function scanDirectory(files: FileList | File[]): Promise<Song[]> {
  const songs: Song[] = [];
  const fileArray = Array.from(files);
  for (const file of fileArray) {
    const isAudio = file.type.startsWith('audio/') || 
                    /\.(mp3|flac|wav|aac|ogg|m4a|mp4|m4b)$/i.test(file.name);

    if (isAudio) {
      try {
        const song = await parseSongFile(file);
        songs.push(song);
      } catch (e) {
        console.error(`Piel Engine Error: Failed to decode ${file.name}. This format might be corrupted or unsupported by your browser's decoder.`, e);
      }
    }
  }
  return songs;
}
