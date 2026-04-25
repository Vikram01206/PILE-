/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, Music2, Disc, Mic2, Folder, Ghost, Heart, ListMusic, 
  Clock, TrendingUp, Search, Settings as SettingsIcon, 
  BarChart3, Menu, X, ChevronRight, Play, SkipForward, SkipBack, Volume2
} from 'lucide-react';
import { AudioProvider, useAudio } from './lib/AudioProvider';
import { db } from './lib/db';
import { Song, Playlist } from './types';
import { isNative, scanNativeMusic } from './lib/nativeScanner';
import { Preferences } from '@capacitor/preferences';
import NowPlaying from './components/NowPlaying';
import Library from './components/Library';
import PlaylistManager from './components/PlaylistManager';
import StatsView from './components/StatsView';
import SettingsView from './components/SettingsView';
import SearchOverlay from './components/SearchOverlay';
import MiniPlayer from './components/MiniPlayer';
import PWAStatus from './components/PWAStatus';

type Screen = 'home' | 'songs' | 'albums' | 'artists' | 'folders' | 'genres' | 'favorites' | 'playlists' | 'stats' | 'settings' | 'now-playing';

const SidebarItem: React.FC<{ 
  icon: React.ElementType; 
  label: string; 
  active: boolean; 
  onClick: () => void;
}> = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-6 py-4 font-ui text-[10px] tracking-widest uppercase font-bold transition-colors border-b-2 border-ink group ${
      active ? 'bg-crimson text-cream' : 'hover:bg-cream-dark text-ink'
    }`}
  >
    <Icon className={`w-4 h-4 ${active ? 'text-cream' : 'text-ink opacity-60 group-hover:opacity-100'}`} />
    <span>{label}</span>
  </button>
);

const AppContent: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { state: audioState, playSong } = useAudio();

  useEffect(() => {
    const loadSongs = async () => {
      const songs = await db.getAllSongs();
      setAllSongs(songs);
    };
    loadSongs();
  }, []);

  useEffect(() => {
    const initNativeScan = async () => {
      if (await isNative()) {
        const { value } = await Preferences.get({ key: 'has_initial_scan' });
        if (!value) {
          // Trigger a background scan on first launch
          scanNativeMusic().then(async () => {
             await Preferences.set({ key: 'has_initial_scan', value: 'true' });
             const songs = await db.getAllSongs();
             setAllSongs(songs);
          });
        }
      }
    };
    initNativeScan();
  }, []);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'stats': return <StatsView />;
      case 'settings': return <SettingsView />;
      case 'playlists': return <PlaylistManager allSongs={allSongs} />;
      case 'folders': return (
        <div className="p-4 md:p-8">
          <div className="bg-cream-dark border-4 border-ink p-6 md:p-10 shadow-heavy rounded-2xl mb-10 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-crimson rotate-45 translate-x-16 -translate-y-16 opacity-10" />
            <h2 className="text-4xl md:text-6xl font-black uppercase italic mb-4 tracking-tighter">Signal Scanner</h2>
            <p className="font-ui text-[10px] md:text-xs opacity-60 mb-8 uppercase font-bold tracking-[0.2em]">Map your local audio archive into the Piel ecosystem.</p>
            <Library screen="folders" songs={[]} onRefresh={() => db.getAllSongs().then(setAllSongs)} onPlay={() => { if(window.innerWidth < 768) setIsPlayerExpanded(true); }} />
          </div>
        </div>
      );
      default: return <Library screen={currentScreen} songs={allSongs} onRefresh={() => db.getAllSongs().then(setAllSongs)} onPlay={() => { if(window.innerWidth < 768) setIsPlayerExpanded(true); }} />;
    }
  };

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'folders', label: 'Scanner', icon: Disc },
    { id: 'favorites', label: 'Likes', icon: Heart },
    { id: 'playlists', label: 'Playlists', icon: ListMusic },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
  ];

  return (
    <div className="flex h-screen w-full bg-cream overflow-hidden relative">
      <div className="noise-overlay" />
      
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-cream-dark border-r-4 border-ink z-[70] md:hidden flex flex-col"
            >
              <div className="p-6 border-b-4 border-ink bg-crimson text-cream flex items-center justify-between">
                <div>
                  <h1 className="text-4xl italic leading-none mb-1">PIEL</h1>
                  <p className="font-ui text-[9px] tracking-[0.3em] uppercase opacity-80 font-bold">Mobile Nav</p>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 border-2 border-cream text-cream">
                  <X size={20} />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto">
                {navItems.map(item => (
                  <SidebarItem 
                    key={item.id}
                    icon={item.icon} 
                    label={item.label} 
                    active={currentScreen === item.id} 
                    onClick={() => { setCurrentScreen(item.id as Screen); setIsSidebarOpen(false); }} 
                  />
                ))}
                <SidebarItem icon={SettingsIcon} label="Settings" active={currentScreen === 'settings'} onClick={() => { setCurrentScreen('settings'); setIsSidebarOpen(false); }} />
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPlayerExpanded && (
          <NowPlaying onMinimize={() => setIsPlayerExpanded(false)} />
        )}
      </AnimatePresence>
      
      {/* Desktop Sidebar */}
      <aside className="w-64 border-r-2 border-ink bg-cream-dark flex flex-col overflow-hidden hidden md:flex">
        <div className="p-6 border-b-2 border-ink bg-crimson text-cream">
          <h1 className="text-4xl italic leading-none mb-1">PIEL</h1>
          <p className="font-ui text-[9px] tracking-[0.3em] uppercase opacity-80 font-bold">Vinyl Store v1.0</p>
        </div>
        
        <nav className="flex-1 overflow-y-auto border-r-0">
          <SidebarItem icon={Home} label="Home" active={currentScreen === 'home'} onClick={() => setCurrentScreen('home')} />
          <SidebarItem icon={Disc} label="Scanner" active={currentScreen === 'folders'} onClick={() => setCurrentScreen('folders')} />
          <SidebarItem icon={Heart} label="Liked" active={currentScreen === 'favorites'} onClick={() => setCurrentScreen('favorites')} />
          <SidebarItem icon={ListMusic} label="Playlists" active={currentScreen === 'playlists'} onClick={() => setCurrentScreen('playlists')} />
          <SidebarItem icon={BarChart3} label="Stats" active={currentScreen === 'stats'} onClick={() => setCurrentScreen('stats')} />
          <SidebarItem icon={SettingsIcon} label="Settings" active={currentScreen === 'settings'} onClick={() => setCurrentScreen('settings')} />
        </nav>

        <div className="p-6 border-t-2 border-ink bg-cream-warm">
          <div className="font-ui text-[9px] mb-2 uppercase opacity-60 font-bold tracking-widest">Library Mass</div>
          <div className="w-full h-4 bg-cream-dark border-2 border-ink shadow-brutal overflow-hidden">
            <div 
              className="bg-crimson h-full border-r-2 border-ink" 
              style={{ width: `${Math.min(100, (allSongs.length / 100) * 100)}%` }} 
            />
          </div>
          <div className="flex justify-between font-numeric text-[10px] mt-2 font-medium">
            <span>{allSongs.length} TRACKS</span>
            <span className="opacity-40">100 MAX</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-cream">
        {/* Header */}
        <header className="h-16 border-b-2 border-ink flex items-center justify-between px-4 md:px-8 bg-cream z-10 transition-colors">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 border-2 border-ink bg-cream-warm shadow-brutal md:hidden rounded-lg"
            >
              <Menu size={20} />
            </button>
            <div className="font-ui text-[10px] uppercase font-bold tracking-tight hidden sm:block">
               <span className="opacity-40">Library / </span>
               <span className="text-ink">{currentScreen}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="brutal-btn min-w-[120px] md:min-w-[160px] !bg-cream-warm !text-ink text-[10px] md:text-xs rounded-lg"
            >
              SEARCH [⌘K]
            </button>
            <div className="w-10 h-10 bg-gold border-2 border-ink shadow-brutal flex items-center justify-center text-ink cursor-pointer rounded-lg" onClick={() => setCurrentScreen('favorites')}>
               <Heart className="w-5 h-5 fill-current" />
            </div>
          </div>
        </header>

        {/* Screen Area */}
        <div className={`flex-1 overflow-y-auto bg-cream-warm ${audioState.currentSongId ? 'pb-44 md:pb-20' : 'pb-20 md:pb-6'}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentScreen}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="min-h-full"
            >
              {renderScreen()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Mini Player */}
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 md:sticky md:bottom-0 p-2 md:p-0 z-40 bg-gradient-to-t from-cream to-transparent pointer-events-none">
          <div className="pointer-events-auto">
            <MiniPlayer onExpand={() => setIsPlayerExpanded(true)} />
          </div>
        </div>

        {/* Mobile Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-cream border-t-2 border-ink flex md:hidden z-30">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentScreen(item.id as Screen)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
                currentScreen === item.id ? 'bg-crimson text-white' : 'text-ink opacity-60'
              }`}
            >
              <item.icon size={20} />
              <span className="text-[10px] font-ui font-bold uppercase tracking-tighter">{item.label}</span>
            </button>
          ))}
        </nav>
      </main>

      {/* Overlays */}
      {isSearchOpen && <SearchOverlay onClose={() => setIsSearchOpen(false)} songs={allSongs} />}
      <PWAStatus />
    </div>
  );
};

export default function App() {
  return (
    <AudioProvider>
      <AppContent />
    </AudioProvider>
  );
}

