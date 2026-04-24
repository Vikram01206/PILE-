import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, Filter, List, Grid, LayoutGrid, MoreVertical, Play, Heart, Star, Plus, Music2 } from 'lucide-react';
import { Song } from '../types';
import { parseSongFile, scanDirectory } from '../lib/libraryScanner';
import { db } from '../lib/db';
import { useAudio } from '../lib/AudioProvider';

interface LibraryProps {
  screen: string;
  songs: Song[];
  onRefresh: () => void;
}

const Library: React.FC<LibraryProps> = ({ screen, songs, onRefresh }) => {
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'compact'>('list');
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { playSong } = useAudio();

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setIsScanning(true);
    console.log(`Piel Engine: Indexing ${e.target.files.length} signals...`);
    const newSongs = await scanDirectory(e.target.files);
    console.log(`Piel Engine: Identified ${newSongs.length} valid audio paths.`);
    for (const song of newSongs) {
      await db.saveSong(song);
    }
    setIsScanning(false);
    onRefresh();
    if (e.target) e.target.value = ''; // Reset input
  };

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const currentSongs = songs.filter(s => {
    if (screen === 'favorites') return s.rating === 5;
    // Add other filters like albums/artists if needed
    return true;
  });

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 md:mb-12">
        <div className="border-l-4 border-crimson pl-4 md:pl-6">
          <h2 className="text-4xl md:text-6xl uppercase tracking-tighter italic font-black leading-none mb-2">{screen}</h2>
          <div className="font-ui text-[9px] md:text-[10px] text-ink opacity-60 uppercase font-bold tracking-[0.4em]">
            {currentSongs.length} REGISTERED TRACKS
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:gap-6">
          <input
            type="file"
            ref={folderInputRef}
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="audio/*,.mp3,.flac,.wav,.aac,.ogg,.m4a"
            className="hidden"
            onChange={handleFileUpload}
          />
          
          <div className="flex gap-2 w-full md:w-auto">
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
              className="brutal-btn flex-1 md:flex-none text-xs bg-white text-ink"
            >
              <Plus className="inline-block mr-2 w-3 h-3" />
              FILES
            </button>
            <button 
              onClick={() => folderInputRef.current?.click()}
              disabled={isScanning}
              className="brutal-btn flex-1 md:flex-none text-xs"
            >
              {isScanning ? 'INDEXING...' : 'FOLDER'}
            </button>
          </div>
          
          <div className="flex border-2 border-ink brutal-shadow bg-cream overflow-hidden">
             {[
               { id: 'list', icon: List },
               { id: 'grid', icon: LayoutGrid },
               { id: 'compact', icon: Grid }
             ].map(({ id, icon: Icon }) => (
               <button
                 key={id}
                 onClick={() => setViewMode(id as any)}
                 className={`p-2.5 md:p-3 transition-colors ${viewMode === id ? 'bg-crimson text-white' : 'hover:bg-cream-dark text-ink'}`}
               >
                 <Icon className="w-4 h-4 md:w-5 md:h-5" />
               </button>
             ))}
          </div>
        </div>
      </div>

      {currentSongs.length === 0 ? (
        <div className="h-64 border-2 border-dashed border-ink flex flex-col items-center justify-center bg-cream-warm p-8 text-center">
          <div className="w-16 h-16 mb-4 text-ink-muted opacity-30"><Music2 size={64} /></div>
          <p className="font-display text-xl mb-4 text-ink-muted uppercase">Your library is skin and bones.</p>
          <button onClick={() => fileInputRef.current?.click()} className="brutal-btn">Analyse local files</button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header Row */}
          <div className="flex items-center px-4 py-2 font-mono text-[9px] md:text-[10px] text-ink-muted tracking-widest uppercase border-b-2 border-ink mb-4">
             <div className="w-8 md:w-12 text-center">#</div>
             <div className="flex-1">Title & Artist</div>
             <div className="flex-1 hidden md:block">Album</div>
             <div className="w-20 md:w-24 text-right">Duration</div>
             <div className="w-32 text-center hidden lg:block">Rating</div>
             <div className="w-8 md:w-12"></div>
          </div>

          {currentSongs.map((song, i) => (
            <motion.div 
              key={song.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              onDoubleClick={() => playSong(song, currentSongs.slice(i + 1).map(s => s.id))}
              onClick={() => { if(window.innerWidth < 768) playSong(song) }}
              className="flex items-center px-3 py-3 md:px-4 md:py-3 bg-cream border-2 border-ink shadow-brutal group hover:bg-white active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer overflow-hidden"
            >
              <div className="w-8 md:w-12 text-center font-numeric text-[10px] md:text-xs text-ink-muted group-hover:text-crimson">
                {i + 1}
              </div>
              <div className="flex-1 flex items-center gap-3 min-w-0">
                 <div className="w-10 h-10 md:w-12 md:h-12 border-2 border-ink bg-ink overflow-hidden flex-shrink-0">
                    {song.picture ? <img src={song.picture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-display text-[10px] text-cream opacity-20">P</div>}
                 </div>
                 <div className="min-w-0">
                   <div className="font-display text-sm md:text-base font-black italic uppercase leading-none truncate tracking-tight">{song.title}</div>
                   <div className="font-ui text-[9px] md:text-[10px] font-bold text-ink opacity-40 truncate uppercase tracking-widest mt-1">{song.artist}</div>
                 </div>
              </div>
              <div className="flex-1 hidden md:block font-serif text-sm italic text-ink-muted truncate pr-4">
                {song.album}
              </div>
              <div className="w-20 md:w-24 text-right font-numeric text-[10px] md:text-xs text-ink font-bold opacity-60">
                {formatDuration(song.duration)}
              </div>
              <div className="w-32 hidden lg:flex justify-center gap-1">
                 {[1,2,3,4,5].map(star => (
                   <Star key={star} className={`w-3 h-3 ${song.rating && song.rating >= star ? 'fill-gold text-gold' : 'text-ink-muted opacity-30'}`} />
                 ))}
              </div>
              <div className="w-8 md:w-12 flex justify-end">
                 <button className="p-1 md:opacity-0 group-hover:opacity-100 hover:text-crimson transition-all">
                   <MoreVertical className="w-4 h-4" />
                 </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Library;
