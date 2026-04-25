import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls, useMotionValue, animate } from 'motion/react';
import { 
  Play, Pause, SkipForward, SkipBack, Repeat, Shuffle, 
  Heart, Plus, Share2, List, Volume2, VolumeX, ChevronDown, Disc, MoreVertical, Info, Music2,
  GripVertical
} from 'lucide-react';
import { useAudio } from '../lib/AudioProvider';
import { db } from '../lib/db';
import { Song } from '../types';

import confetti from 'canvas-confetti';

const QueueItem: React.FC<{ song: Song; index: number; onPlay: () => void }> = ({ song, index, onPlay }) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={song}
      id={song.id}
      dragListener={false}
      dragControls={dragControls}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      whileDrag={{ 
        scale: 1.04, 
        backgroundColor: "var(--color-cream-warm)",
        boxShadow: "0px 20px 40px rgba(26, 10, 13, 0.15), 8px 8px 0px #1A0A0D",
        zIndex: 1000
      }}
      className="flex items-center gap-4 p-4 hover:bg-ink/5 border-2 border-transparent hover:border-ink/10 transition-colors group rounded-xl relative bg-cream select-none touch-none"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <motion.div 
        whileTap={{ scale: 0.9 }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragControls.start(e);
        }}
        className="cursor-grab active:cursor-grabbing p-2 -ml-2 text-ink/20 group-hover:text-ink/60 transition-colors touch-none"
      >
        <GripVertical size={20} />
      </motion.div>
      
      <div className="w-10 h-10 border-2 border-ink bg-cream-dark overflow-hidden shrink-0">
        {song.picture ? (
          <img src={song.picture} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-cream-dark text-ink/20">
            <Music2 size={16} />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 pointer-events-auto" onClick={onPlay}>
        <div className="font-display text-xs font-black uppercase truncate leading-tight">{song.title}</div>
        <div className="font-ui text-[8px] font-bold opacity-40 uppercase truncate leading-none mt-1">{song.artist}</div>
      </div>
    </Reorder.Item>
  );
};

const NowPlaying: React.FC<{ isExpanded: boolean; onMinimize?: () => void }> = ({ isExpanded, onMinimize }) => {
  const { state, playSong, togglePlay, next, prev, seek, setVolume, analyser, toggleMute, toggleShuffle, toggleRepeat, haptic, clearQueue, reorderQueue } = useAudio();
  const [song, setSong] = React.useState<Song | null>(null);
  const [nextSong, setNextSong] = React.useState<Song | null>(null);
  const [isLiked, setIsLiked] = React.useState(false);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);
  
  const [showQueue, setShowQueue] = React.useState(false);
  const [showVisualizer, setShowVisualizer] = React.useState(false);
  const [queueSongs, setQueueSongs] = React.useState<Song[]>([]);

  const songsCache = useRef<Map<string, Song>>(new Map());

  const [isReordering, setIsReordering] = React.useState(false);

  useEffect(() => {
    if (showQueue && state.queue.length > 0 && !isReordering) {
      const currentIndex = state.queue.indexOf(state.currentSongId || '');
      const upcomingIds = state.queue.slice(currentIndex + 1);
      
      const existingMap = new Map(queueSongs.map(s => [s.id, s]));
      
      Promise.all(upcomingIds.map(id => {
        if (existingMap.has(id)) return existingMap.get(id);
        if (songsCache.current.has(id)) return songsCache.current.get(id);
        return db.getSong(id);
      })).then(songs => {
        const validSongs = songs.filter((s): s is Song => s !== undefined);
        validSongs.forEach(s => songsCache.current.set(s.id, s));
        
        const currentIds = queueSongs.map(s => s.id).join(',');
        const incomingIds = validSongs.map(s => s.id).join(',');
        if (currentIds !== incomingIds) {
          setQueueSongs(validSongs);
        }
      });
    }
  }, [showQueue, state.queue, state.currentSongId]);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (state.currentSongId) {
      db.getSong(state.currentSongId).then(s => {
        setSong(s || null);
        setIsLiked(s?.liked === true || s?.rating === 5);
      });
    }

    if (state.queue && state.queue.length > 0) {
      const currentIndex = state.queue.indexOf(state.currentSongId || '');
      const nextId = state.queue[currentIndex + 1];
      if (nextId) {
        db.getSong(nextId).then(s => setNextSong(s || null));
      } else {
        setNextSong(null);
      }
    } else {
      setNextSong(null);
    }
  }, [state.currentSongId, state.queue]);

  const handleLike = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
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

    await db.toggleLike(song.id);
  };

  // Visualizer Logic
  useEffect(() => {
    if (!analyser || !canvasRef.current || !showVisualizer) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const renderFrame = () => {
      animationId = requestAnimationFrame(renderFrame);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barCount = 100;
      const barWidth = (canvas.width / barCount);
      let barHeight;
      let x = 0;

      for (let i = 0; i < barCount; i++) {
        barHeight = (dataArray[i * 2] / 255) * canvas.height;
        ctx.fillStyle = i % 2 === 0 ? '#C0152A' : '#D4A017';
        ctx.globalAlpha = 0.8;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };
    renderFrame();

    return () => cancelAnimationFrame(animationId);
  }, [analyser, showVisualizer]);

  const parentDragControls = useDragControls();

  const [isSeeking, setIsSeeking] = React.useState(false);
  const [seekTime, setSeekTime] = React.useState(0);

  const y = useMotionValue(0);
  const [isDragging, setIsDragging] = React.useState(false);

  if (!state.currentSongId || !song) return null;

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const currentTime = isSeeking ? seekTime : state.currentTime;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, rect: DOMRect) => {
    setIsSeeking(true);
    const updateSeek = (clientX: number) => {
      const x = clientX - rect.left - 16;
      const v = Math.max(0, Math.min(1, x / (rect.width - 32)));
      const nextTime = v * song.duration;
      setSeekTime(nextTime);
    };
    updateSeek(e.clientX);
    
    const onMove = (me: PointerEvent) => updateSeek(me.clientX);
    const onUp = (me: PointerEvent) => {
      const x = me.clientX - rect.left - 16;
      const v = Math.max(0, Math.min(1, x / (rect.width - 32)));
      seek(v * song.duration);
      setIsSeeking(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    haptic(10);
  };

  return (
    <>
      {/* Internal Scrim Overlay */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onMinimize}
            className="fixed inset-0 bg-ink/70 backdrop-blur-[6px] z-[90]"
          />
        )}
      </AnimatePresence>

      <motion.div 
        drag="y"
        dragControls={parentDragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: window.innerHeight }}
        dragElastic={{ top: 0, bottom: 0.1 }}
        style={{ 
          y,
          touchAction: 'none',
          pointerEvents: isExpanded ? 'auto' : 'none',
        }}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={(_, info) => {
          setIsDragging(false);
          if (info.offset.y > 150 || info.velocity.y > 600) {
            onMinimize?.();
          } else {
            animate(y, 0, { type: 'spring', damping: 30, stiffness: 300 });
          }
        }}
        animate={{ y: isExpanded ? 0 : window.innerHeight }}
        transition={{ 
          type: 'spring', 
          damping: 35, 
          stiffness: 350, 
          mass: 0.8,
          restDelta: 0.01
        }}
        className="fixed inset-0 z-[100] flex flex-col bg-cream shadow-2xl rounded-t-[40px] overflow-hidden"
      >

      {/* Drag Handle Indicator */}
      <div 
        className="w-full flex justify-center pt-3 pb-1 shrink-0 md:hidden cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => parentDragControls.start(e)}
      >
        <div className="w-10 h-1.5 bg-ink/10 rounded-full" />
      </div>

      <AnimatePresence>
        {showDetails && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-ink flex items-center justify-center p-6 sm:p-12"
          >
            <div className="absolute inset-0 noise-overlay opacity-10 pointer-events-none" />
            
            <button 
              onClick={() => setShowDetails(false)}
              className="absolute top-8 right-8 text-cream hover:bg-white/10 p-4 rounded-full transition-colors z-30"
            >
              <ChevronDown size={40} />
            </button>

            <div className="w-full max-w-2xl bg-white/5 border-2 border-white/10 rounded-[40px] p-8 md:p-16 backdrop-blur-3xl overflow-y-auto max-h-[85vh] relative z-10 text-cream">
              <div className="space-y-12">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                   <div className="w-32 h-32 md:w-48 md:h-48 border-4 border-white/20 rounded-3xl overflow-hidden shrink-0">
                      {song.picture ? <img src={song.picture} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-white/5"><Disc size={64}/></div>}
                   </div>
                   <div className="space-y-4">
                      <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none">{song.title}</h2>
                      <p className="text-xl md:text-3xl font-serif text-gold font-bold">{song.artist}</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8 border-y-2 border-white/10">
                   <div className="space-y-1">
                      <span className="font-ui text-[10px] font-black uppercase opacity-40 block tracking-widest">Album</span>
                      <span className="text-xl font-bold uppercase tracking-tight">{song.album || 'Unknown Signal'}</span>
                   </div>
                   <div className="space-y-1">
                      <span className="font-ui text-[10px] font-black uppercase opacity-40 block tracking-widest">Year</span>
                      <span className="text-xl font-bold font-numeric">{song.year || '2024'}</span>
                   </div>
                   <div className="space-y-1">
                      <span className="font-ui text-[10px] font-black uppercase opacity-40 block tracking-widest">Duration</span>
                      <span className="text-xl font-bold font-numeric">{Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}</span>
                   </div>
                   <div className="space-y-1">
                      <span className="font-ui text-[10px] font-black uppercase opacity-40 block tracking-widest">Codec & Rate</span>
                      <span className="text-xl font-bold uppercase tracking-widest">FLAC • 44.1kHz / 24bit</span>
                   </div>
                </div>

                <div className="space-y-6 pt-4">
                  <h4 className="font-ui text-xs font-black uppercase tracking-[0.3em] opacity-40">System Diagnostics</h4>
                  <div className="space-y-3 font-mono text-xs opacity-60">
                    <p>DEVICE_TYPE: REIMAGINED_HI_FI_v1._0</p>
                    <p>SIGNAL_ENCODING: LOSSLESS_MASTERS</p>
                    <p>TRANSMISSION_ID: {song.id.slice(0, 16)}...</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] bg-ink/60 backdrop-blur-sm"
              onClick={() => setIsMenuOpen(false)}
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-[120] bg-cream border-t-4 border-ink shadow-[0_-12px_40px_rgba(0,0,0,0.2)] rounded-t-[40px] px-6 pb-12 pt-8 md:max-w-xl md:mx-auto md:rounded-[40px] md:bottom-12 md:top-auto md:border-b-4"
            >
              <div className="w-12 h-1.5 bg-ink/10 rounded-full mx-auto mb-8 md:hidden" />
              <div className="flex flex-col gap-2">
                <button onClick={() => { handleLike(); setIsMenuOpen(false); }} className="flex items-center gap-4 p-5 hover:bg-ink/5 rounded-2xl transition-all group">
                  <div className={`w-12 h-12 rounded-xl bg-ink/5 flex items-center justify-center group-hover:scale-110 transition-transform ${isLiked ? 'text-gold fill-current' : ''}`}>
                    <Heart size={24} className={isLiked ? 'fill-current' : ''} />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-ui text-sm font-black uppercase tracking-widest">{isLiked ? 'Unlike Signal' : 'Like Signal'}</span>
                    <span className="font-mono text-[10px] opacity-40 uppercase">Add to your favorites</span>
                  </div>
                </button>
                <div className="h-[2px] bg-ink/5 mx-5 my-2" />
                
                {/* Volume Slider Tuning */}
                <div className="flex flex-col gap-4 p-5 bg-ink/5 rounded-2xl">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-3">
                      <Volume2 size={18} className="text-ink/60" />
                      <span className="font-ui text-sm font-black uppercase tracking-widest">Volume Tuning</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-crimson">{Math.round(state.volume * 100)}%</span>
                  </div>
                  <div 
                    className="h-12 flex items-center relative px-4 cursor-pointer touch-none"
                    onPointerDown={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const updateVolume = (clientX: number) => {
                        const x = clientX - rect.left - 16; // 16px padding (px-4)
                        const v = Math.max(0, Math.min(1, x / (rect.width - 32))); // rect.width - 32 (range)
                        setVolume(v);
                      };
                      
                      updateVolume(e.clientX);
                      
                      const onPointerMove = (moveEvent: PointerEvent) => {
                        updateVolume(moveEvent.clientX);
                      };
                      
                      const onPointerUp = () => {
                        window.removeEventListener('pointermove', onPointerMove);
                        window.removeEventListener('pointerup', onPointerUp);
                      };
                      
                      window.addEventListener('pointermove', onPointerMove);
                      window.addEventListener('pointerup', onPointerUp);
                      haptic(5);
                    }}
                  >
                    {/* Track Background */}
                    <div className="absolute h-3 left-4 right-4 bg-cream border-4 border-ink shadow-brutal rounded-full" />
                    
                    {/* Fill */}
                    <motion.div 
                      className="absolute h-3 left-4 bg-crimson border-y-4 border-ink first:rounded-l-full"
                      style={{ 
                        borderLeftWidth: '4px'
                      }}
                      animate={{ width: `calc(${state.volume} * (100% - 32px))` }}
                      transition={{ type: 'spring', bounce: 0, duration: 0.1 }}
                    />

                    {/* Handle */}
                    <motion.div 
                      className="absolute w-8 h-8 rounded-full border-4 border-ink bg-crimson shadow-brutal pointer-events-none z-10"
                      animate={{ left: `calc(16px + ${state.volume} * (100% - 32px))` }}
                      style={{ x: '-50%' }}
                      transition={{ type: 'spring', bounce: 0.1, duration: 0.1 }}
                    />

                    {/* Tick Marks */}
                    <div className="absolute inset-x-8 inset-y-0 pointer-events-none flex items-center justify-between opacity-20">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-1 w-0.5 bg-ink" />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="h-[2px] bg-ink/5 mx-5 my-2" />
                <button onClick={() => { setShowDetails(true); setIsMenuOpen(false); }} className="flex items-center gap-4 p-5 hover:bg-ink/10 bg-crimson/5 text-crimson rounded-2xl transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-crimson/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Info size={24} />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-ui text-sm font-black uppercase tracking-widest">Track Details</span>
                    <span className="font-mono text-[10px] opacity-40 uppercase">Technical Info</span>
                  </div>
                </button>
                <button onClick={() => setIsMenuOpen(false)} className="mt-4 w-full p-5 bg-ink text-cream font-ui font-black uppercase tracking-[0.2em] rounded-2xl hover:scale-95 transition-all active:scale-90">
                  Cancel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div 
        onPointerDown={(e) => {
          // Only start parent drag if not clicking buttons
          if ((e.target as HTMLElement).closest('button')) return;
          parentDragControls.start(e);
        }}
        className="flex justify-between items-center px-4 py-2 w-full max-w-xl mx-auto shrink-0 z-10 cursor-grab active:cursor-grabbing"
      >
        <button 
          onClick={onMinimize}
          className="w-9 h-9 rounded-full border-4 border-ink bg-crimson text-white flex items-center justify-center shadow-heavy active:translate-y-1 transition-all"
        >
          <ChevronDown size={20} strokeWidth={3} />
        </button>
        
        <h2 className="font-ui text-[10px] font-black uppercase tracking-[0.2em] text-ink opacity-60">Now Playing</h2>
        
        <div className="flex gap-2">
          <button 
            onClick={() => { haptic(10); toggleMute(); }}
            className="w-9 h-9 border-2 border-ink bg-cream flex items-center justify-center shadow-brutal hover:bg-cream-dark transition-colors rounded-lg"
          >
            {state.volume === 0 ? <VolumeX size={18} className="text-crimson" /> : <Volume2 size={18} />}
          </button>
          <button 
            onClick={() => { haptic(15); setShowVisualizer(!showVisualizer); }}
            className={`w-9 h-9 border-2 border-ink flex items-center justify-center shadow-brutal transition-colors rounded-lg ${showVisualizer ? 'bg-gold text-ink' : 'bg-cream hover:bg-cream-dark'}`}
          >
            <Disc size={18} className={state.isPlaying ? 'animate-spin-slow' : ''} />
          </button>
          <button 
            onClick={() => { haptic(20); setShowQueue(true); }}
            className={`w-9 h-9 border-2 border-ink flex items-center justify-center shadow-brutal transition-colors rounded-lg ${showQueue ? 'bg-crimson text-white' : 'bg-cream hover:bg-cream-dark'}`}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-2 overflow-hidden w-full max-w-xl mx-auto">
        <div className="w-full flex flex-col items-center gap-4">
          
          {/* Artwork & Peek - More Compact */}
          <div 
            onPointerDown={(e) => parentDragControls.start(e)}
            className="w-full flex items-center justify-center gap-3 px-6 relative cursor-grab active:cursor-grabbing"
          >
            <div className={`w-48 h-48 sm:w-60 sm:h-60 border-4 border-ink bg-cream shadow-heavy rounded-[20px] overflow-hidden relative shrink-0 transition-all duration-500 ${showVisualizer || isDragging ? 'scale-75 translate-y--4' : ''}`}>
              {song.picture ? (
                <img src={song.picture} alt="cover" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-cream-dark text-ink/20">
                   <Disc size={64} />
                </div>
              )}
            </div>

            {/* Visualizer Canvas overlay */}
            <AnimatePresence>
              {showVisualizer && !isDragging && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute inset-x-6 top-4 bottom-8 pointer-events-none flex items-end justify-center"
                >
                   <canvas ref={canvasRef} width={400} height={180} className="w-full h-full" />
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Peek Next Track */}
            <div className={`w-10 h-40 border-4 border-ink bg-cream shadow-heavy rounded-l-[20px] overflow-hidden hidden sm:block shrink-0 opacity-30 transition-opacity ${showVisualizer ? 'opacity-0' : 'opacity-30'}`}>
               {nextSong?.picture ? (
                 <img src={nextSong.picture} alt="" className="w-full h-full object-cover grayscale" />
               ) : (
                 <div className="w-full h-full bg-gradient-to-b from-cream-dark to-cream" />
               )}
            </div>
          </div>

          {/* Info Section - Smaller text */}
          <div className="w-full px-6 flex items-center justify-between gap-4">
            <div className="text-left space-y-0.5 overflow-hidden">
               <h1 className="text-lg md:text-xl font-black tracking-tight text-ink truncate leading-tight uppercase">
                 {song.title}
               </h1>
               <p className="text-sm md:text-base font-serif text-crimson font-bold">
                 {song.artist}
               </p>
            </div>
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="w-10 h-10 rounded-full bg-crimson border-4 border-ink flex items-center justify-center text-white shadow-heavy shrink-0 active:scale-90 transition-all"
            >
              <Music2 size={18} />
            </button>
          </div>

          {/* Progress Section - Tightened */}
          <div className="w-full px-6 space-y-3 relative">
             <div className="relative pt-4 pb-1">
                <div 
                  className="h-8 flex items-center relative cursor-pointer px-4 touch-none group"
                  onPointerDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    handlePointerDown(e, rect);
                  }}
                >
                  {/* Pixel Style Squiggly Progress Bar */}
                  <div className="absolute inset-x-4 inset-y-0 pointer-events-none flex items-center">
                    <svg width="100%" height="24" viewBox="0 0 400 24" preserveAspectRatio="none" className="overflow-visible">
                      <defs>
                        <clipPath id="played-mask">
                           <rect x="0" y="0" width={400 * (currentTime / (song.duration || 1))} height="24" />
                        </clipPath>
                        <clipPath id="unplayed-mask">
                           <rect x={400 * (currentTime / (song.duration || 1))} y="0" width="400" height="24" />
                        </clipPath>
                      </defs>

                      {/* Unplayed Track (Straight) */}
                      <line 
                        x1="0" y1="12" x2="400" y2="12" 
                        stroke="currentColor" strokeWidth="4" 
                        className="text-ink/10" 
                        strokeLinecap="round" 
                        clipPath="url(#unplayed-mask)"
                      />

                      {/* Played Track (Squiggly when playing, Straight when paused) */}
                      <motion.path
                        d={state.isPlaying && !isDragging 
                          ? `M 0 12 ${[...Array(20)].map((_, i) => `Q ${i * 20 + 10} ${i % 2 === 0 ? 4 : 20}, ${(i + 1) * 20} 12`).join(' ')}`
                          : "M 0 12 L 400 12"
                        }
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="text-crimson"
                        strokeLinecap="round"
                        clipPath="url(#played-mask)"
                        animate={state.isPlaying && !isDragging ? { 
                          d: [
                            `M 0 12 ${[...Array(20)].map((_, i) => `Q ${i * 20 + 10} ${i % 2 === 0 ? 4 : 20}, ${(i + 1) * 20} 12`).join(' ')}`,
                            `M 0 12 ${[...Array(20)].map((_, i) => `Q ${i * 20 + 10} ${i % 2 === 0 ? 20 : 4}, ${(i + 1) * 20} 12`).join(' ')}`,
                            `M 0 12 ${[...Array(20)].map((_, i) => `Q ${i * 20 + 10} ${i % 2 === 0 ? 4 : 20}, ${(i + 1) * 20} 12`).join(' ')}`
                          ]
                        } : { d: "M 0 12 L 400 12" }}
                        transition={state.isPlaying && !isDragging ? {
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "easeInOut"
                        } : { duration: 0.2 }}
                      />
                    </svg>
                  </div>

                  <motion.div 
                    className="absolute w-8 h-8 rounded-full border-4 border-ink bg-crimson shadow-brutal pointer-events-none z-10"
                    animate={{ left: `calc(16px + (${currentTime} / ${song.duration || 1}) * (100% - 32px))` }}
                    style={{ x: '-50%' }}
                    transition={{ type: 'tween', ease: 'linear', duration: isSeeking ? 0 : 0.1 }}
                  />
                </div>
             </div>
             
             <div className="flex justify-between items-center font-ui text-[8px] font-black uppercase tracking-widest text-ink">
               <span className="font-mono">{formatTime(currentTime)}</span>
               <div className="bg-cream border-2 border-ink px-2 py-0.5 rounded-md text-[7px] font-black shadow-sm flex items-center gap-1.5 opacity-60">
                  <div className="w-1 h-1 rounded-full bg-green-500" />
                  44.1 kHz • MP3
               </div>
               <span className="font-mono">{formatTime(song.duration)}</span>
             </div>
          </div>

          {/* Main Controls - Smaller buttons */}
          <div className="flex items-center justify-center gap-4 py-1">
             <button onClick={prev} className="w-14 h-14 rounded-full border-4 border-ink bg-cream text-ink hover:bg-cream-dark transition-all flex items-center justify-center active:translate-y-1 shadow-brutal">
               <SkipBack size={24} fill="currentColor" strokeWidth={0} />
             </button>

             <button 
               onClick={() => { haptic(30); togglePlay(); }}
               className="w-18 h-18 rounded-full border-4 border-ink bg-crimson text-white shadow-heavy flex items-center justify-center active:scale-95 transition-all"
             >
               {state.isPlaying ? <Pause size={32} fill="currentColor" strokeWidth={0} /> : <Play size={32} className="ml-1" fill="currentColor" strokeWidth={0} />}
             </button>

             <button onClick={next} className="w-14 h-14 rounded-full border-4 border-ink bg-cream text-ink hover:bg-cream-dark transition-all flex items-center justify-center active:translate-y-1 shadow-brutal">
               <SkipForward size={24} fill="currentColor" strokeWidth={0} />
             </button>
          </div>

          {/* Tray - Compacted */}
          <div className="w-full max-w-xs px-6 pb-2">
             <div className="flex border-4 border-ink bg-cream-warm shadow-heavy rounded-xl overflow-hidden h-11">
                <button 
                  onClick={toggleShuffle}
                  className={`flex-1 flex items-center justify-center border-r-4 border-ink transition-colors ${state.isShuffle ? 'bg-gold' : 'hover:bg-cream-dark'}`}
                >
                   <Shuffle size={18} className={state.isShuffle ? 'opacity-100' : 'opacity-40'} />
                </button>
                <button 
                  onClick={toggleRepeat}
                  className={`flex-1 flex items-center justify-center border-r-4 border-ink transition-colors ${state.isRepeat !== 'off' ? 'bg-gold' : 'hover:bg-cream-dark'}`}
                >
                   <div className="relative">
                      <Repeat size={18} className={state.isRepeat !== 'off' ? 'opacity-100' : 'opacity-40'} />
                      {state.isRepeat === 'one' && <span className="absolute -top-1 -right-1 bg-crimson text-white text-[7px] px-1 rounded-full">1</span>}
                   </div>
                </button>
                <button 
                  onClick={() => handleLike()}
                  className={`flex-1 flex items-center justify-center hover:bg-cream-dark transition-colors ${isLiked ? 'text-crimson' : 'opacity-20'}`}
                >
                   <Heart size={22} className={isLiked ? 'fill-current' : ''} />
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* Close Button Desktop */}
      <button 
        onClick={onMinimize}
        className="absolute top-8 right-8 w-14 h-14 border-4 border-ink bg-cream shadow-heavy hidden md:flex items-center justify-center hover:bg-gold hover:text-ink active:translate-y-1 active:shadow-none transition-all z-50 rounded-xl"
      >
        <ChevronDown size={32} strokeWidth={3} />
      </button>

      {/* Queue Drawer */}
      <AnimatePresence>
        {showQueue && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150] bg-ink/40 backdrop-blur-md"
              onClick={() => setShowQueue(false)}
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-[160] w-full max-w-md bg-cream shadow-heavy border-l-4 border-ink flex flex-col"
            >
               <div className="p-6 md:p-8 flex items-center justify-between border-b-4 border-ink bg-cream-dark">
                  <div className="flex-1">
                    <h3 className="font-display text-2xl md:text-3xl uppercase font-black leading-none">Transmission Queue</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="font-ui text-[10px] uppercase font-black opacity-40 tracking-widest">{queueSongs.length} Coming Next</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowQueue(false)}
                    className="p-3 bg-ink text-cream hover:bg-crimson transition-colors rounded-xl"
                  >
                    <ChevronDown size={24} className="rotate-[-90deg]" />
                  </button>
               </div>

               <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar">
                  {/* Current Song */}
                  <div className="space-y-3">
                    <div className="font-ui text-[9px] font-black uppercase tracking-[0.3em] opacity-40">Now Streaming</div>
                    <div className="flex items-center gap-4 p-4 bg-crimson text-white border-2 border-ink shadow-brutal rounded-xl">
                       <div className="w-12 h-12 border-2 border-white/20 bg-ink overflow-hidden shrink-0">
                          {song.picture ? <img src={song.picture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Disc size={24}/></div>}
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="font-display text-sm font-black uppercase truncate leading-tight">{song.title}</div>
                         <div className="font-ui text-[9px] font-bold opacity-60 uppercase truncate">{song.artist}</div>
                       </div>
                       <div className="w-3 h-3 flex items-center justify-center">
                          <motion.div 
                            animate={{ height: [4, 12, 6, 10, 4] }} 
                            transition={{ repeat: Infinity, duration: 0.6 }}
                            className="w-0.5 bg-white" 
                          />
                       </div>
                    </div>
                  </div>

                  {/* Following */}
                  <div className="space-y-3 pt-4">
                    <div className="font-ui text-[9px] font-black uppercase tracking-[0.3em] opacity-40">Coming Operations</div>
                    {queueSongs.length === 0 ? (
                      <p className="text-center py-10 font-serif text-ink/30 border-2 border-dashed border-ink rounded-xl">No subsequent signals detected.</p>
                    ) : (
                      <Reorder.Group 
                        axis="y" 
                        values={queueSongs} 
                        onReorder={(newSongs) => {
                          setQueueSongs(newSongs);
                          reorderQueue(newSongs.map(s => s.id));
                        }}
                        className="space-y-2"
                        onDragStart={() => setIsReordering(true)}
                        onDragEnd={() => setIsReordering(false)}
                      >
                        {queueSongs.map((s, idx) => (
                          <QueueItem 
                            key={s.id} 
                            song={s} 
                            index={idx}
                            onPlay={() => {
                              haptic(10);
                              db.getSong(s.id).then(song => {
                                if (song) playSong(song, state.queue);
                              });
                            }}
                          />
                        ))}
                      </Reorder.Group>
                    )}
                  </div>
               </div>

               <div className="p-6 border-t-4 border-ink bg-cream-dark space-y-3">
                  {queueSongs.length > 0 && (
                    <button 
                      onClick={() => { haptic(30); clearQueue(); }}
                      className="w-full brutal-btn !bg-crimson !text-white py-3 text-[10px] tracking-widest flex items-center justify-center gap-2"
                    >
                      <List size={16} />
                      <span>CLEAR ALL UPCOMING</span>
                    </button>
                  )}
                  <button 
                    onClick={() => { haptic(20); setShowQueue(false); next(); }}
                    className="w-full brutal-btn !bg-ink !text-cream py-4 text-xs tracking-widest flex items-center justify-center gap-2"
                  >
                    <SkipForward size={16} />
                    <span>FORCE NEXT SIGNAL</span>
                  </button>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
    </>
  );
};

export default NowPlaying;
