import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search as SearchIcon, X, Music2, Disc, Mic2, ArrowRight } from 'lucide-react';
import { Song } from '../types';
import { useAudio } from '../lib/AudioProvider';

interface SearchOverlayProps {
  onClose: () => void;
  songs: Song[];
}

const SearchOverlay: React.FC<SearchOverlayProps> = ({ onClose, songs }) => {
  const [query, setQuery] = useState('');
  const { playSong } = useAudio();

  const results = query.trim() === '' ? [] : songs.filter(s => 
    s.title.toLowerCase().includes(query.toLowerCase()) ||
    s.artist.toLowerCase().includes(query.toLowerCase()) ||
    s.album.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 10);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-cream/95 backdrop-blur-sm z-50 flex flex-col items-center p-8 overflow-y-auto"
    >
      <button onClick={onClose} className="absolute top-4 right-4 md:top-8 md:right-8 p-2 md:p-3 hover:bg-ink hover:text-cream transition-colors">
        <X size={32} className="md:w-12 md:h-12 text-ink" />
      </button>

      <div className="w-full max-w-4xl mt-12 md:mt-24">
        <div className="relative group">
          <SearchIcon className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 text-ink opacity-20 w-8 h-8 md:w-12 md:h-12 group-focus-within:text-crimson transition-all" />
          <input
            autoFocus
            type="text"
            placeholder="PIEL INDEX SEARCH..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-20 md:h-32 bg-cream-warm border-4 border-ink brutal-shadow px-6 md:px-12 pl-14 md:pl-24 font-display text-2xl md:text-[64px] uppercase tracking-tighter italic outline-none focus:translate-x-[-4px] md:focus:translate-x-[-8px] focus:translate-y-[-4px] md:focus:translate-y-[-8px] focus:shadow-heavy transition-all placeholder:opacity-10"
          />
        </div>

        <div className="mt-8 md:mt-16 space-y-4 md:space-y-6">
          <AnimatePresence mode="popLayout">
            {results.map((song, i) => (
              <motion.div
                key={song.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                className="group flex items-center gap-4 md:gap-8 p-4 md:p-6 bg-cream-warm border-2 border-ink shadow-brutal hover:bg-crimson hover:text-white transition-all cursor-pointer relative overflow-hidden"
                onClick={() => {
                  playSong(song);
                  onClose();
                }}
              >
                <div className="w-12 h-12 md:w-20 md:h-20 border-2 border-ink group-hover:border-white shadow-brutal flex-shrink-0 overflow-hidden bg-ink transition-all">
                   {song.picture ? <img src={song.picture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-display text-xs md:text-base text-cream opacity-20 italic">P</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-xl md:text-4xl uppercase tracking-tighter italic font-black truncate leading-none mb-1 md:mb-2">{song.title}</div>
                  <div className="font-ui text-[9px] md:text-[11px] opacity-60 uppercase tracking-widest font-bold truncate group-hover:opacity-100">{song.artist} — {song.album}</div>
                </div>
                <div className="hidden sm:block font-mono text-sm opacity-40 group-hover:opacity-100 italic pr-4">
                   {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                </div>
                
                <div className="absolute right-0 top-0 bottom-0 w-1 bg-ink opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            ))}
          </AnimatePresence>
          {query && results.length === 0 && (
            <div className="p-12 md:p-20 text-center border-4 border-dashed border-ink/20 font-display text-2xl md:text-4xl text-ink italic opacity-20 uppercase tracking-tighter">
              No resonance detected for "{query}"
            </div>
          )}

          {!query && (
             <div className="p-12 md:p-20 text-center flex flex-col items-center gap-4 border-2 border-ink/10">
               <div className="w-12 h-[2px] bg-crimson mb-2 md:mb-4" />
               <div className="font-ui text-[8px] md:text-[10px] text-ink opacity-40 uppercase tracking-[0.3em] md:tracking-[0.5em] font-bold">
                 ENTER QUERY TO SCAN ARCHIVES
               </div>
             </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default SearchOverlay;
