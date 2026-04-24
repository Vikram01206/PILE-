import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, Pause, SkipForward, SkipBack, Repeat, Shuffle, 
  Heart, Plus, Share2, List, Volume2, ChevronDown, Disc
} from 'lucide-react';
import { useAudio } from '../lib/AudioProvider';
import { db } from '../lib/db';
import { Song } from '../types';

import confetti from 'canvas-confetti';

const NowPlaying: React.FC = () => {
  const { state, togglePlay, next, prev, seek, setVolume, analyser } = useAudio();
  const [song, setSong] = React.useState<Song | null>(null);
  const [isLiked, setIsLiked] = React.useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (state.currentSongId) {
      db.getSong(state.currentSongId).then(s => {
        setSong(s || null);
        setIsLiked(s?.rating === 5);
      });
    }
  }, [state.currentSongId]);

  const handleLike = async () => {
    if (!song) return;
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    
    if (newLiked) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#C0152A', '#D4A017', '#1A0A0D']
      });
    }

    const updatedSong = { ...song, rating: newLiked ? 5 : 0 };
    await db.saveSong(updatedSong);
    setSong(updatedSong);
  };

  // Visualizer Logic
  useEffect(() => {
    if (!analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const renderFrame = () => {
      requestAnimationFrame(renderFrame);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;
        ctx.fillStyle = i % 2 === 0 ? '#C0152A' : '#1A0A0D';
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    renderFrame();
  }, [analyser]);

  if (!state.currentSongId || !song) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-cream-warm">
        <h2 className="font-display text-4xl mb-4 italic opacity-20">NOTHING IS FLESH</h2>
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Start a track from the library</p>
      </div>
    );
  }

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-8 lg:p-16 bg-cream-warm relative overflow-y-auto overflow-x-hidden">
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 md:gap-12 lg:gap-24 py-8">
        
        <div className="relative group shrink-0">
          <motion.div 
            animate={{ rotate: state.isPlaying ? 360 : 0 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="w-56 h-56 sm:w-72 sm:h-72 md:w-[420px] md:h-[420px] border-2 border-ink p-1 bg-ink shadow-brutal md:shadow-[12px_12px_0px_#1A0A0D] overflow-hidden relative z-10"
          >
            {song.picture ? (
              <img src={song.picture} alt="cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-crimson-dark text-cream">
                 <Disc className="w-24 h-24 md:w-32 md:h-32 opacity-20" />
              </div>
            )}
          </motion.div>
          
          <div className="absolute -top-3 -right-3 md:-top-4 md:-right-4 bg-crimson text-white font-ui text-[8px] md:text-[10px] px-3 md:px-4 py-1 md:py-1.5 border-2 border-ink shadow-brutal uppercase font-bold tracking-widest z-20">
             High Fidelity
          </div>

          <div className="absolute -bottom-6 -left-6 font-ui text-[8px] text-ink-muted uppercase tracking-[0.5em] origin-left -rotate-90 opacity-40 hidden md:block">
             ANALOG EXPRESSIONISM
          </div>
        </div>

        {/* Info & Visualizer Section */}
        <div className="flex-1 w-full max-w-2xl text-center lg:text-left">
          <div className="mb-6 md:mb-8">
            <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-[120px] mb-2 md:mb-4 leading-[0.9] uppercase tracking-tighter italic font-black text-ink block overflow-hidden">
               <div className={song.title.length > 15 ? 'marquee-content' : ''}>{song.title}</div>
            </h1>
            <h3 className="font-serif text-xl sm:text-2xl md:text-3xl lg:text-5xl text-crimson italic mb-4 md:mb-6">{song.artist}</h3>
            <div className="flex items-center justify-center lg:justify-start gap-3">
              <span className="font-ui text-[8px] md:text-[10px] bg-ink text-cream px-2 py-0.5 font-bold uppercase tracking-widest">ALBUM</span>
              <p className="font-ui text-[10px] md:text-xs text-ink uppercase tracking-widest font-bold underline decoration-crimson decoration-2 underline-offset-4 truncate max-w-[200px]">{song.album} — {song.year || 'N/A'}</p>
            </div>
          </div>

          <div className="h-16 md:h-20 w-full mb-8 md:mb-12 border-b-2 border-ink bg-cream-dark/20 p-2 flex items-end gap-[1px]">
            <canvas ref={canvasRef} width={800} height={80} className="w-full h-full" />
          </div>

          {/* Progress Section */}
          <div className="space-y-3 md:space-y-4 mb-10 md:mb-14">
            <div className="flex items-center justify-between font-numeric text-[10px] md:text-xs text-ink font-bold tracking-widest">
              <span>{formatTime(state.currentTime)}</span>
              <span>-{formatTime(Math.max(0, song.duration - state.currentTime))}</span>
            </div>
            <div className="h-4 border-2 border-ink bg-cream-dark relative group cursor-pointer overflow-hidden" 
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                seek(percent * song.duration);
              }}
            >
              <div 
                className="h-full bg-crimson border-r-2 border-ink transition-all duration-100 ease-linear" 
                style={{ width: `${(state.currentTime / (song.duration || 1)) * 100}%` }} 
              />
              {/* Notches */}
              <div className="absolute top-0 bottom-0 pointer-events-none w-[1px] bg-ink/10" style={{ left: '25%' }} />
              <div className="absolute top-0 bottom-0 pointer-events-none w-[1px] bg-ink/10" style={{ left: '50%' }} />
              <div className="absolute top-0 bottom-0 pointer-events-none w-[1px] bg-ink/10" style={{ left: '75%' }} />
            </div>
          </div>

          {/* Controls Section */}
          <div className="flex flex-col sm:flex-row items-center justify-between bg-cream-warm p-4 md:p-6 brutal-border brutal-shadow gap-6">
            <div className="flex items-center gap-4 border-b-2 sm:border-b-0 sm:border-r-2 border-ink pb-4 sm:pb-0 sm:pr-6 w-full sm:w-auto justify-center sm:justify-start">
               <div className="flex flex-col items-start mr-4">
                 <span className="font-ui text-[8px] uppercase font-bold opacity-40">Resonance</span>
                 <span className="font-numeric text-base md:text-lg">{isLiked ? '10/10' : '0/10'}</span>
               </div>
               <button 
                 onClick={handleLike}
                 className={`w-10 h-10 md:w-12 md:h-12 brutal-border brutal-shadow transition-all ${isLiked ? 'bg-gold text-white' : 'bg-cream'}`}
               >
                 <Heart className={`w-5 h-5 mx-auto ${isLiked ? 'fill-current' : ''}`} />
               </button>
            </div>

            <div className="flex items-center gap-6 md:gap-8">
              <button onClick={prev} className="w-10 h-10 md:w-12 md:h-12 brutal-border brutal-shadow bg-crimson text-white hover:bg-crimson-dark flex items-center justify-center">
                <SkipBack className="w-4 h-4 md:w-5 md:h-5 fill-current" />
              </button>
              <button 
                onClick={togglePlay}
                className="w-16 h-16 md:w-20 md:h-20 bg-crimson border-2 border-ink shadow-heavy flex items-center justify-center text-white active:shadow-pressed active:translate-x-1 active:translate-y-1 transition-all"
              >
                {state.isPlaying ? <Pause className="w-8 h-8 md:w-10 md:h-10 fill-current" /> : <Play className="w-8 h-8 md:w-10 md:h-10 fill-current ml-1" />}
              </button>
              <button onClick={next} className="w-10 h-10 md:w-12 md:h-12 brutal-border brutal-shadow bg-crimson text-white hover:bg-crimson-dark flex items-center justify-center">
                <SkipForward className="w-4 h-4 md:w-5 md:h-5 fill-current" />
              </button>
            </div>

            <div className="flex items-center gap-4 border-t-2 sm:border-t-0 sm:border-l-2 border-ink pt-4 sm:pt-0 sm:pl-8 w-full sm:w-auto justify-center sm:justify-end">
               <div className="flex flex-col items-end mr-4">
                 <span className="font-ui text-[8px] uppercase font-bold opacity-40">Gain</span>
                 <span className="font-numeric text-base md:text-lg">{Math.round(state.volume * 100)}%</span>
               </div>
               <div className="w-20 md:w-24 h-4 bg-cream-dark border-2 border-ink overflow-hidden">
                  <div className="h-full bg-ink" style={{ width: `${state.volume * 100}%` }} />
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NowPlaying;
