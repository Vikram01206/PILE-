import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { Song, PlaybackState } from '../types';
import { db } from './db';

interface AudioContextType {
  state: PlaybackState;
  analyser: AnalyserNode | null;
  playSong: (song: Song, queue?: string[]) => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
  setPlaybackSpeed: (s: number) => void;
  setEQBand: (index: number, gain: number) => void;
  toggleGapless: () => void;
  toggleNormalization: () => void;
  next: () => void;
  prev: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
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
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const eqNodesRef = useRef<BiquadFilterNode[]>([]);
  const gainNodeRef = useRef<GainNode | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);

  useEffect(() => {
    const audio = new Audio();
    (audioRef as any).current = audio;

    audio.addEventListener('timeupdate', () => {
      setState(s => ({ ...s, currentTime: audio.currentTime }));
    });

    audio.addEventListener('ended', () => {
      handleNext();
    });

    audio.addEventListener('error', (e) => {
      console.error('Piel Engine: Audio stream corrupted or unreachable.', audio.error);
    });

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  const handleNext = () => {
    // Basic next logic
    setState(s => {
      if (s.queue.length > 0) {
        const nextId = s.queue[0];
        const newQueue = s.queue.slice(1);
        // This is a bit tricky since we need the actual Song object
        // In this architecture, it's better to fetch from DB if needed
        return { ...s, queue: newQueue };
      }
      return { ...s, isPlaying: false };
    });
  };

  const [eqSettings, setEqSettings] = useState<number[]>(new Array(10).fill(0));

  const initAudioCtx = () => {
    if (!audioCtxRef.current && audioRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize = 256;

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
    const audio = audioRef.current;
    if (!audio) return;

    if (song.data) {
      const url = URL.createObjectURL(song.data);
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

  return (
    <AudioContext.Provider value={{
      state,
      analyser: analyserRef.current,
      playSong,
      togglePlay,
      seek,
      setVolume,
      setPlaybackSpeed,
      setEQBand,
      toggleGapless: () => setState(s => ({ ...s, isGapless: !s.isGapless })),
      toggleNormalization: () => setState(s => ({ ...s, isNormalized: !s.isNormalized })),
      next: handleNext,
      prev: () => {}, 
      toggleShuffle: () => setState(s => ({ ...s, isShuffle: !s.isShuffle })),
      toggleRepeat: () => setState(s => ({
        ...s,
        isRepeat: s.isRepeat === 'off' ? 'all' : s.isRepeat === 'all' ? 'one' : 'off'
      })),
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
