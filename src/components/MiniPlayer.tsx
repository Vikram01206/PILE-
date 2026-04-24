import React from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, Maximize2, Volume2 } from 'lucide-react';
import { useAudio } from '../lib/AudioProvider';
import { db } from '../lib/db';
import { Song } from '../types';

interface MiniPlayerProps {
  onExpand: () => void;
}

const MiniPlayer: React.FC<MiniPlayerProps> = ({ onExpand }) => {
  const { state, togglePlay, next, prev, seek, setVolume } = useAudio();
  const [song, setSong] = React.useState<Song | null>(null);

  React.useEffect(() => {
    if (state.currentSongId) {
      db.getSong(state.currentSongId).then(setSong);
    }
  }, [state.currentSongId]);

  if (!state.currentSongId || !song) return null;

  const progressPercentage = (state.currentTime / (song.duration || 1)) * 100;

  return (
    <div className="h-24 border-t-2 border-ink bg-cream-warm flex items-center px-4 md:px-8 relative md:mx-8 md:mb-8 md:brutal-border md:brutal-shadow">
      {/* Small Progress Bar */}
      <div className="absolute top-[-2px] left-[-2px] right-[-2px] h-3 bg-cream-dark border-b-2 border-ink cursor-pointer overflow-hidden" onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        seek(percent * song.duration);
      }}>
        <div 
          className="h-full bg-crimson border-r-2 border-ink transition-all duration-100 ease-linear shadow-[inset_0_0_10px_rgba(0,0,0,0.1)]" 
          style={{ width: `${progressPercentage}%` }} 
        />
      </div>

      <div className="flex-1 flex items-center gap-3 md:gap-6 min-w-0">
        <div className="w-12 h-12 md:w-14 md:h-14 border-2 border-ink shadow-brutal flex-shrink-0 bg-ink overflow-hidden">
          {song.picture ? (
            <img src={song.picture} alt="art" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-display text-cream opacity-20 italic">P</div>
          )}
        </div>
        <div className="min-w-0">
          <div className="font-display text-lg md:text-xl truncate italic font-black uppercase tracking-tight">{song.title}</div>
          <div className="font-ui text-[8px] md:text-[9px] text-ink opacity-60 uppercase font-bold tracking-widest truncate">{song.artist}</div>
        </div>
      </div>

      <div className="hidden sm:flex flex-[2] items-center justify-center gap-10">
        <button className="w-12 h-12 brutal-border bg-cream hover:bg-crimson hover:text-white transition-colors flex items-center justify-center font-bold" onClick={prev}>
          <SkipBack className="w-5 h-5 fill-current" />
        </button>
        <button 
          className="w-16 h-16 bg-crimson border-2 border-ink shadow-heavy flex items-center justify-center text-white active:shadow-pressed active:translate-x-1 active:translate-y-1 transition-all"
          onClick={togglePlay}
        >
          {state.isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
        </button>
        <button className="w-12 h-12 brutal-border bg-cream hover:bg-crimson hover:text-white transition-colors flex items-center justify-center font-bold" onClick={next}>
          <SkipForward className="w-5 h-5 fill-current" />
        </button>
      </div>

      <div className="flex items-center justify-end gap-4 md:gap-10 h-full border-l-2 border-ink pl-4 md:pl-10">
        <button 
          className="w-12 h-12 bg-crimson border-2 border-ink flex sm:hidden items-center justify-center text-white"
          onClick={togglePlay}
        >
          {state.isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
        </button>
        
        <div className="hidden md:flex flex-col items-end gap-1">
          <span className="font-ui text-[8px] uppercase font-bold opacity-40">Output Gain</span>
          <div className="flex items-center gap-4">
             <span className="font-mono text-sm font-bold">{Math.round(state.volume * 100)}%</span>
             <div className="group relative w-32 h-4 bg-cream-dark border-2 border-ink overflow-hidden cursor-pointer">
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={state.volume} 
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <div className="h-full bg-ink transition-all duration-75" style={{ width: `${state.volume * 100}%` }} />
             </div>
          </div>
        </div>
        <button className="brutal-btn p-2 md:p-3 !bg-ink !text-cream" onClick={onExpand}>
          <Maximize2 className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </div>
    </div>
  );
};

export default MiniPlayer;
