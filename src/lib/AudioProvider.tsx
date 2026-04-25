import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { Song, PlaybackState } from '../types';
import { db } from './db';

interface AudioContextType {
  state: PlaybackState;
  analyser: AnalyserNode | null;
  playSong: (song: Song, queue?: string[]) => void;
  addToQueue: (songId: string) => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
  setPlaybackSpeed: (s: number) => void;
  setEQBand: (index: number, gain: number) => void;
  toggleGapless: () => void;
  toggleNormalization: () => void;
  toggleMute: () => void;
  next: () => void;
  prev: () => void;
  clearQueue: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  reorderQueue: (newQueue: string[]) => void;
  haptic: (pattern?: number | number[]) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PlaybackState>({
    currentSongId: null,
    queue: [],
    history: [],
    isPlaying: false,
    isShuffle: false,
    isRepeat: 'off',
    volume: 0.8,
    playbackSpeed: 1,
    currentTime: 0,
    isGapless: true,
    isNormalized: false,
  });

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const eqNodesRef = useRef<BiquadFilterNode[]>([]);
  const gainNodeRef = useRef<GainNode | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const audio = new Audio();
    (audioRef as any).current = audio;

    const cleanup = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };

    audio.addEventListener('progress', () => {
      if (audio.buffered.length > 0) {
        setState(s => ({ ...s, bufferedTime: audio.buffered.end(audio.buffered.length - 1) }));
      }
    });

    audio.addEventListener('timeupdate', () => {
      const buffered = audio.buffered.length > 0 ? audio.buffered.end(audio.buffered.length - 1) : 0;
      // We still update on timeupdate as a fallback, but requestAnimationFrame will handle the smooth visuals
      setState(s => ({ ...s, currentTime: audio.currentTime, bufferedTime: buffered }));
    });

    let rafId: number;
    const updateProgress = () => {
      if (audio.paused) return;
      
      setState(s => ({ ...s, currentTime: audio.currentTime }));
      rafId = requestAnimationFrame(updateProgress);
    };

    audio.addEventListener('play', () => {
      rafId = requestAnimationFrame(updateProgress);
    });

    audio.addEventListener('pause', () => {
      cancelAnimationFrame(rafId);
    });

    audio.addEventListener('ended', () => {
      cancelAnimationFrame(rafId);
      handleNext();
    });

    audio.addEventListener('error', (e) => {
      console.error('Piel Engine: Audio stream corrupted or unreachable.', {
        error: audio.error,
        src: audio.src?.substring(0, 50) + '...'
      });
    });

    return () => {
      audio.pause();
      audio.src = '';
      cleanup();
    };
  }, []);

  const [lastVolume, setLastVolume] = useState(0.8);

  const haptic = (pattern: number | number[] = 15) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // Silently ignore
      }
    }
  };

  const handleNext = async () => {
    haptic([10, 5, 10]);
    
    // If we have a queue, try to find the next song
    if (state.queue.length > 0) {
      if (state.isShuffle) {
        const randomIndex = Math.floor(Math.random() * state.queue.length);
        const song = await db.getSong(state.queue[randomIndex]);
        if (song) {
          playSong(song, state.queue);
          return;
        }
      }

      const currentIndex = state.queue.indexOf(state.currentSongId || '');
      if (currentIndex !== -1 && currentIndex < state.queue.length - 1) {
        const nextId = state.queue[currentIndex + 1];
        const song = await db.getSong(nextId);
        if (song) {
          playSong(song, state.queue);
          return;
        }
      } else if (state.isRepeat === 'all' && state.queue.length > 0) {
        const song = await db.getSong(state.queue[0]);
        if (song) {
          playSong(song, state.queue);
          return;
        }
      }
    }

    // Autoplay Fallback: If queue is exhausted or empty, find a random song to keep the music playing
    try {
      const allSongs = await db.getAllSongs();
      if (allSongs.length > 0) {
        const nextRandom = allSongs[Math.floor(Math.random() * allSongs.length)];
        // Add it to the queue so the index-based logic works for the next skip
        setState(s => ({
          ...s,
          queue: [...s.queue, nextRandom.id]
        }));
        playSong(nextRandom);
      } else {
        setState(s => ({ ...s, isPlaying: false }));
        if (audioRef.current) audioRef.current.pause();
      }
    } catch (err) {
      setState(s => ({ ...s, isPlaying: false }));
      if (audioRef.current) audioRef.current.pause();
    }
  };

  const handlePrev = async () => {
    haptic([10, 5, 10]);
    // If more than 3s into song, just restart it. 
    // Reduced to 2s if user is frustrated, but 3s is standard. 
    // Let's stick with 3s or even 4s for common UX.
    if (audioRef.current && audioRef.current.currentTime > 3) {
      seek(0);
      return;
    }

    const currentIndex = state.queue.indexOf(state.currentSongId || '');
    if (currentIndex > 0) {
      const prevId = state.queue[currentIndex - 1];
      const song = await db.getSong(prevId);
      if (song) playSong(song, state.queue);
    } else {
      seek(0); // If first song, just go to start
    }
  };

  const toggleMute = () => {
    if (state.volume > 0) {
      setLastVolume(state.volume);
      setVolume(0);
    } else {
      setVolume(lastVolume || 0.8);
    }
  };

  const [eqSettings, setEqSettings] = useState<number[]>(new Array(10).fill(0));

  const initAudioCtx = () => {
    if (!audioCtxRef.current && audioRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize = 256;
      setAnalyser(analyserRef.current);

      sourceRef.current = ctx.createMediaElementSource(audioRef.current);

      // Create EQ Bands
      const frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
      const nodes = frequencies.map((freq, i) => {
        const node = ctx.createBiquadFilter();
        node.type = i === 0 ? 'lowshelf' : i === frequencies.length - 1 ? 'highshelf' : 'peaking';
        node.frequency.value = freq;
        node.Q.value = 1;
        node.gain.value = eqSettings[i]; // Apply preset settings
        return node;
      });
      eqNodesRef.current = nodes;

      gainNodeRef.current = ctx.createGain();
      gainNodeRef.current.gain.value = state.volume;

      // Connect chain: source -> EQ bands -> gain -> analyser -> destination
      let lastNode: AudioNode = sourceRef.current;
      nodes.forEach(node => {
        lastNode.connect(node);
        lastNode = node;
      });

      if (gainNodeRef.current) {
        lastNode.connect(gainNodeRef.current);
        lastNode = gainNodeRef.current;
      }

      if (analyserRef.current) {
        lastNode.connect(analyserRef.current);
        lastNode = analyserRef.current;
      }
      
      lastNode.connect(ctx.destination);
    }
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const setEQBand = (index: number, gain: number) => {
    setEqSettings(prev => {
      const next = [...prev];
      next[index] = gain;
      return next;
    });
    
    if (eqNodesRef.current[index]) {
      eqNodesRef.current[index].gain.setTargetAtTime(gain, audioCtxRef.current?.currentTime || 0, 0.01);
    }
  };

  const playSong = async (song: Song, queue: string[] = []) => {
    initAudioCtx();
    if (audioCtxRef.current?.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    const audio = audioRef.current;
    if (!audio) return;

    // Revoke old URL if it exists
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (song.data) {
      const url = URL.createObjectURL(song.data);
      objectUrlRef.current = url;
      audio.src = url;
    } else if (song.url) {
      audio.src = song.url;
    } else {
      console.error('Audio signal lost: No source data found for', song.title);
      return;
    }

    audio.playbackRate = state.playbackSpeed;
    audio.volume = state.volume;
    
    try {
      await audio.play();
      
      setCurrentSong(song);
      setState(s => ({
        ...s,
        currentSongId: song.id,
        isPlaying: true,
        queue: queue.length > 0 ? queue : s.queue,
        currentTime: 0,
      }));

      // Log play in background
      db.logPlay({ songId: song.id, timestamp: Date.now(), durationPlayed: 0 });
      // Update song stats
      db.saveSong({ ...song, playCount: (song.playCount || 0) + 1, lastPlayedAt: Date.now() });
    } catch (err) {
      console.error('Playback Error: Browser rejected the audio stream.', err);
    }
  };

  const togglePlay = () => {
    initAudioCtx();
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    const audio = audioRef.current;
    if (!audio || !state.currentSongId) return;

    if (state.isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setState(s => ({ ...s, isPlaying: !s.isPlaying }));
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setState(s => ({ ...s, currentTime: time }));
    }
  };

  const setVolume = (v: number) => {
    if (audioRef.current) {
      audioRef.current.volume = v;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(v, audioCtxRef.current?.currentTime || 0, 0.1);
    }
    setState(s => ({ ...s, volume: v }));
  };

  const setPlaybackSpeed = (speed: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
    setState(s => ({ ...s, playbackSpeed: speed }));
  };

  const addToQueue = (songId: string) => {
    setState(s => {
      const currentIndex = s.currentSongId ? s.queue.indexOf(s.currentSongId) : -1;
      const nextQueue = [...s.queue];
      if (currentIndex !== -1) {
        nextQueue.splice(currentIndex + 1, 0, songId);
      } else {
        nextQueue.push(songId);
      }
      return {
        ...s,
        queue: nextQueue
      };
    });
  };

  const clearQueue = () => {
    haptic(15);
    setState(s => {
      // Keep only current song in queue if playing
      const newQueue = s.currentSongId ? [s.currentSongId] : [];
      return {
        ...s,
        queue: newQueue
      };
    });
  };

  const reorderQueue = (newQueueIds: string[]) => {
    setState(s => {
      // We must ensure currentSongId remains in the head of the list if it was there,
      // but Reorder component usually handles the items passed to it.
      // NowPlaying filters the queue to only show upcoming songs.
      // So newQueueIds will likely be just the upcoming songs.
      
      const currentIndex = s.currentSongId ? s.queue.indexOf(s.currentSongId) : -1;
      const head = currentIndex !== -1 ? s.queue.slice(0, currentIndex + 1) : [];
      
      return {
        ...s,
        queue: [...head, ...newQueueIds]
      };
    });
  };

  return (
    <AudioContext.Provider value={{
      state,
      analyser,
      playSong,
      addToQueue,
      reorderQueue,
      clearQueue,
      togglePlay,
      seek,
      setVolume,
      setPlaybackSpeed,
      setEQBand,
      toggleGapless: () => setState(s => ({ ...s, isGapless: !s.isGapless })),
      toggleNormalization: () => setState(s => ({ ...s, isNormalized: !s.isNormalized })),
      toggleMute,
      next: handleNext,
      prev: handlePrev,
      haptic,
      toggleShuffle: () => {
        haptic(20);
        setState(s => ({ ...s, isShuffle: !s.isShuffle }));
      },
      toggleRepeat: () => {
        haptic(20);
        setState(s => ({
          ...s,
          isRepeat: s.isRepeat === 'off' ? 'all' : s.isRepeat === 'all' ? 'one' : 'off'
        }));
      },
    }}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) throw new Error('useAudio must be used within AudioProvider');
  return context;
};
