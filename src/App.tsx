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
import { isNative, scanNativeMusic, getMediaStoreSongs } from './lib/nativeScanner';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
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
  const [isLoadingSongs, setIsLoadingSongs] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [fontTheme, setFontTheme] = useState('default');
  const { state: audioState, playSong } = useAudio();

  useEffect(() => {
    Preferences.get({ key: 'font_theme' }).then(({ value }) => {
      if (value) setFontTheme(value);
    });
  }, []);

  useEffect(() => {
    document.body.className = `theme-font-${fontTheme}`;
    Preferences.set({ key: 'font_theme', value: fontTheme });
  }, [fontTheme]);

  useEffect(() => {
    const loadSongs = async () => {
      setIsLoadingSongs(true);
      const songs = await db.getAllSongs();
      setAllSongs(songs);
      setIsLoadingSongs(false);
    };
    loadSongs();
  }, []);

  useEffect(() => {
    const initNativePermissions = async () => {
      const isNativeApp = Capacitor.isNativePlatform();
      console.log(`Piel Engine: Platform detected - ${isNativeApp ? 'NATIVE' : 'WEB'}`);
      
      if (isNativeApp) {
        try {
          const { checkPermission, requestPermissions, getMediaStoreSongs } = await import('./lib/nativeScanner');
          
          console.log('Piel Engine: Explicitly requesting permissions for MediaStore access...');
          const pStatus = await requestPermissions();
          console.log('Piel Engine: Startup Permission Status:', pStatus);
          
          if (pStatus === 'granted') {
             console.log('Piel Engine: Permission granted. Accessing media signals...');
             setIsLoadingSongs(true);
             const msSongs = await getMediaStoreSongs();
             console.log(`Piel Engine: Detected ${msSongs.length} signals via MediaStore.`);
             
             if (msSongs.length > 0) {
               for (const song of msSongs) {
                 await db.saveSong(song);
               }
               const songs = await db.getAllSongs();
               setAllSongs(songs);
             }
             setIsLoadingSongs(false);
          } else {
             console.warn('Piel Engine: Storage permission not granted. Native signals unavailable.');
          }
        } catch (err) {
          console.error('Piel Engine: Critical failure during native initialization:', err);
          setIsLoadingSongs(false);
        }
      }
    };
    initNativePermissions();
  }, []);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'stats': return <StatsView />;
      case 'settings': return <SettingsView fontTheme={fontTheme} onFontThemeChange={setFontTheme} />;
      case 'playlists': return <PlaylistManager allSongs={allSongs} />;
      default: return (
        <Library 
          screen={currentScreen} 
          songs={allSongs} 
          isLoading={isLoadingSongs}
          onRefresh={() => db.getAllSongs().then(setAllSongs)} 
          onPlay={() => { if(window.innerWidth < 768) setIsPlayerExpanded(true); }} 
        />
      );
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
    <div className="flex h-screen w-full bg-ink overflow-hidden relative">
      <div className="noise-overlay" />
      
      {/* Main Content Layout Wrapper */}
      <motion.div 
        className="flex h-full w-full relative bg-ink overflow-hidden"
        animate={{ 
          scale: isPlayerExpanded ? 0.94 : 1,
          opacity: isPlayerExpanded ? 0.5 : 1,
          borderRadius: isPlayerExpanded ? '32px' : '0px',
        }}
        transition={{ type: 'spring', damping: 35, stiffness: 300, mass: 1 }}
      >
        <div className="flex h-full w-full relative bg-cream overflow-hidden">
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
                      <h1 className="text-4xl leading-none mb-1">PIEL</h1>
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
          
          {/* Desktop Sidebar */}
          <aside className="w-64 border-r-2 border-ink bg-cream-dark flex flex-col overflow-hidden hidden md:flex">
            <div className="p-6 border-b-2 border-ink bg-crimson text-cream">
              <h1 className="text-4xl leading-none mb-1">PIEL</h1>
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

          {/* Main Content Area */}
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
            <AnimatePresence>
              {audioState.currentSongId && !isPlayerExpanded && (
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  className="fixed bottom-16 md:bottom-0 left-0 right-0 md:sticky md:bottom-0 p-2 md:p-0 z-40 bg-gradient-to-t from-cream to-transparent"
                >
                  <MiniPlayer onExpand={() => setIsPlayerExpanded(true)} />
                </motion.div>
              )}
            </AnimatePresence>

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
        </div>
      </motion.div>

      {/* Full Player Layer - Always mounted for smoothness */}
      <NowPlaying 
        isExpanded={isPlayerExpanded} 
        onMinimize={() => setIsPlayerExpanded(false)} 
      />


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

