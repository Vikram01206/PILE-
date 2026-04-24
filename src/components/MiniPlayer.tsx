import React from 'react';
import { motion } from 'motion/react';
import { Play, Pause, SkipForward, SkipBack, Maximize2, Volume2 } from 'lucide-react';
import { useAudio } from '../lib/AudioProvider';
import { db } from '../lib/db';
import { Song } from '../types';

interface MiniPlayerProps {
  onExpand: () => void;
}

const MiniPlayer: React.FC<MiniPlayerProps> = ({ onExpand }) => {
  const { state, togglePlay, next, prev, seek, setVolume, haptic } = useAudio();
  const [song, setSong] = React.useState<Song | null>(null);

  React.useEffect(() => {
    if (state.currentSongId) {
      db.getSong(state.currentSongId).then(setSong);
    }
  }, [state.currentSongId]);

  if (!state.currentSongId || !song) return null;

  const progressPercentage = (state.currentTime / (song.duration || 1)) * 100;

  return (
    <motion.div 
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.y < -50) onExpand();
      }}
      className="h-20 border-t-2 border-ink bg-cream/80 backdrop-blur-xl flex items-center px-4 md:px-6 relative md:mx-4 md:mb-4 rounded-t-2xl md:rounded-xl shadow-2xl z-40 group"
    >
      {/* Waveform Visualization Overlay */}
      {state.isPlaying && (
        <div className="absolute top-0 left-0 right-0 flex justify-center items-end gap-[1px] h-2 pointer-events-none overflow-hidden opacity-30">
          {[...Array(60)].map((_, i) => (
            <motion.div
              key={i}
              className="w-[1.5px] bg-crimson rounded-full"
              animate={{
                height: [
                  1, 
                  Math.random() * 6 + 2, 
                  1, 
                  Math.random() * 4 + 1, 
                  1
                ]
              }}
              transition={{
                duration: 0.5 + Math.random() * 0.5,
                repeat: Infinity,
                delay: i * 0.015,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
      )}

      {/* Small Progress Bar */}
      <div className="absolute top-[-2px] left-4 right-4 h-1.5 bg-ink/5 rounded-full cursor-pointer overflow-hidden" onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        seek(percent * song.duration);
      }}>
        <div 
          className="h-full bg-crimson transition-all duration-100 ease-linear" 
          style={{ width: `${progressPercentage}%` }} 
        />
      </div>

      <div className="flex-1 flex items-center gap-3 min-w-0" onClick={() => { haptic(10); onExpand(); }}>
        <div className="w-12 h-12 rounded-lg border-2 border-ink shadow-brutal flex-shrink-0 bg-ink overflow-hidden group-hover:scale-105 transition-transform">
          {song.picture ? (
            <img src={song.picture} alt="art" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-display text-cream opacity-20 italic">P</div>
          )}
        </div>
        <div className="min-w-0">
          <div className="font-ui text-sm md:text-base truncate font-black uppercase tracking-tight leading-tight">{song.title}</div>
          <div className="font-ui text-[10px] text-ink/40 uppercase font-black tracking-widest truncate">{song.artist}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 mr-4">
          <button className="w-10 h-10 rounded-full hover:bg-cream-dark transition-colors flex items-center justify-center text-ink" onClick={prev}>
            <SkipBack size={18} className="fill-current" />
          </button>
          <button className="w-10 h-10 rounded-full hover:bg-cream-dark transition-colors flex items-center justify-center text-ink" onClick={next}>
            <SkipForward size={18} className="fill-current" />
          </button>
        </div>

        <button 
          className="w-12 h-12 bg-crimson rounded-full border-2 border-primary shadow-brutal flex items-center justify-center text-white active:scale-95 transition-all"
          onClick={() => { haptic(25); togglePlay(); }}
        >
          {state.isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current ml-0.5" />}
        </button>
        
        <button className="p-2 text-ink/40 hover:text-ink transition-colors hidden md:block" onClick={onExpand}>
          <Maximize2 size={20} />
        </button>
      </div>
    </motion.div>
  );
};

export default MiniPlayer;
