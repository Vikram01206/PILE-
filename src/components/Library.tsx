import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { Upload, Filter, List, Grid, LayoutGrid, MoreVertical, Play, Heart, Star, Plus, Music2, X, ChevronRight, Music, Disc } from 'lucide-react';
import { Song, Playlist } from '../types';
import { parseSongFile, scanDirectory, scanLocalDirectory } from '../lib/libraryScanner';
import { db } from '../lib/db';
import { useAudio } from '../lib/AudioProvider';

interface LibraryProps {
  screen: string;
  songs: Song[];
  onRefresh: () => void;
  onPlay?: () => void;
}

const MenuAction: React.FC<{ 
  icon: React.ElementType; 
  label: string; 
  onClick: () => void; 
  active?: boolean;
  variant?: 'default' | 'danger';
}> = ({ icon: Icon, label, onClick, active, variant = 'default' }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`w-full flex items-center gap-3 px-3 py-2 text-[10px] uppercase font-bold tracking-widest hover:bg-ink/5 transition-colors ${variant === 'danger' ? 'text-crimson' : active ? 'text-gold' : 'text-ink'}`}
  >
    <Icon className="w-3 h-3" />
    <span>{label}</span>
  </button>
);

const SongListItem: React.FC<{
  song: Song;
  index: number;
  handlePlay: (song: Song, queueIds: string[]) => void;
  currentSongs: Song[];
  toggleLike: (songId: string) => void;
  addToQueue: (songId: string) => void;
  haptic: (pattern?: number | number[]) => void;
  deleteTrack: (songId: string) => void;
  activeMenu: string | null;
  setActiveMenu: (id: string | null) => void;
  setShowPlaylistPicker: (id: string | null) => void;
  formatDuration: (seconds: number) => string;
}> = ({ 
  song, 
  index, 
  handlePlay, 
  currentSongs, 
  toggleLike, 
  addToQueue, 
  haptic, 
  deleteTrack, 
  activeMenu, 
  setActiveMenu,
  setShowPlaylistPicker,
  formatDuration
}) => {
  const [justAdded, setJustAdded] = useState(false);
  const x = useMotionValue(0);
  const thresholdReached = useRef(false);
  
  // Transform drag distance into visual feedback
  const bgColor = useTransform(x, [0, 80], ['rgba(26, 10, 13, 0.05)', 'rgba(220, 38, 38, 1)']);
  const iconScale = useTransform(x, [0, 80], [0.8, 1.2]);
  const iconOpacity = useTransform(x, [0, 80], [0, 1]);
  const bgOpacity = useTransform(x, [0, 20], [0, 1]);

  return (
    <div className={`relative group mb-5 ${activeMenu === song.id ? 'z-[60]' : 'z-auto'}`}>
      {/* Swipe Background */}
      <motion.div 
        style={{ backgroundColor: bgColor, opacity: bgOpacity }}
        className="absolute inset-0 flex items-center px-6 text-white rounded-xl overflow-hidden pointer-events-none"
      >
         <motion.div 
           className="flex items-center gap-2"
           style={{ scale: iconScale, opacity: iconOpacity }}
         >
           <Plus size={18} strokeWidth={3} />
           <span className="font-ui text-[10px] font-black uppercase tracking-[0.2em]">Add to Queue</span>
         </motion.div>
      </motion.div>

      {/* Added Confirmation Overlay */}
      <AnimatePresence>
        {justAdded && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="absolute inset-0 z-20 bg-gold flex items-center justify-center gap-2 pointer-events-none rounded-xl border-2 border-ink"
          >
            <Plus size={16} strokeWidth={4} />
            <span className="font-display text-xs font-black uppercase">Signal Added to Sequence</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.02 }}
        drag="x"
        style={{ x }}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 150 }}
        dragElastic={0.1}
        dragSnapToOrigin
        onDrag={(_, info) => {
          // Subtle haptic when threshold crossed
          if (info.offset.x > 100 && !thresholdReached.current) {
            haptic(5);
            thresholdReached.current = true;
          } else if (info.offset.x <= 100 && thresholdReached.current) {
            thresholdReached.current = false;
          }
        }}
        onDragEnd={(_, info) => {
          thresholdReached.current = false;
          if (info.offset.x > 100) {
            addToQueue(song.id);
            haptic([10, 5, 10]);
            setJustAdded(true);
            setTimeout(() => setJustAdded(false), 2000);
          }
        }}
        onDoubleClick={() => handlePlay(song, currentSongs.map(s => s.id))}
        onClick={() => { 
          // Only trigger click if it wasn't a significant drag
          if (Math.abs(x.get()) > 10) return;
          
          if (activeMenu === song.id) {
            setActiveMenu(null);
            return;
          }
          if (window.innerWidth < 768) {
            handlePlay(song, currentSongs.map(s => s.id));
          }
        }}
        className="flex items-center px-3 py-4 md:px-4 md:py-4 bg-cream border-2 border-ink shadow-brutal rounded-xl group hover:bg-cream-warm transition-all cursor-pointer relative z-10 select-none touch-none"
      >
        <div className="w-8 md:w-12 text-center font-numeric text-[10px] md:text-xs text-ink-muted group-hover:text-crimson">
          {index + 1}
        </div>
        <div className="flex-1 flex items-center gap-3 min-w-0">
           <div className="w-10 h-10 md:w-12 md:h-12 border-2 border-ink bg-ink overflow-hidden flex-shrink-0">
              {song.picture ? <img src={song.picture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-cream-dark text-ink/20"><Music size={12} strokeWidth={3} /></div>}
           </div>
           <div className="min-w-0">
             <div className="font-display text-sm md:text-base font-black uppercase leading-none truncate tracking-tight">{song.title}</div>
             <div className="font-ui text-[9px] md:text-[10px] font-bold text-ink opacity-40 truncate uppercase tracking-widest mt-1">{song.artist}</div>
           </div>
        </div>
        <div className="flex-1 hidden md:block font-serif text-sm text-ink-muted truncate pr-4">
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
        <div className="w-8 md:w-12 flex justify-end relative z-30">
            <button 
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { 
                e.stopPropagation(); 
                haptic(10);
                setActiveMenu(activeMenu === song.id ? null : song.id); 
              }}
              className={`p-3 -mr-2 transition-all rounded-full hover:bg-ink/5 flex items-center justify-center ${activeMenu === song.id ? 'text-crimson opacity-100' : 'text-ink-muted opacity-40 md:opacity-0 group-hover:opacity-100'}`}
            >
              <MoreVertical className="w-5 h-5" />
            </button>

           <AnimatePresence>
             {activeMenu === song.id && (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.95, y: -10 }}
                 animate={{ opacity: 1, scale: 1, y: 0 }}
                 exit={{ opacity: 0, scale: 0.95, y: -10 }}
                 className="absolute right-0 top-12 w-56 bg-cream border-4 border-ink shadow-heavy z-50 p-2 rounded-xl"
               >
                 <MenuAction icon={Play} label="Play Now" onClick={() => handlePlay(song, currentSongs.map(s => s.id))} />
                 <MenuAction icon={Heart} label={song.liked ? "Unlike Track" : "Like Track"} active={song.liked} onClick={() => toggleLike(song.id)} />
                 <MenuAction icon={Plus} label="Add to Playlist" onClick={() => { setShowPlaylistPicker(song.id); setActiveMenu(null); }} />
                 <MenuAction icon={Plus} label="Add to Queue" onClick={() => { addToQueue(song.id); setActiveMenu(null); }} />
                 <div className="h-[2px] bg-ink my-2 opacity-10" />
                 <MenuAction icon={Upload} label="Share Track" onClick={() => {
                   navigator.clipboard.writeText(`${song.title} by ${song.artist}`);
                   setActiveMenu(null);
                 }} />
                 <MenuAction icon={Music2} label="Track Details" onClick={() => { setActiveMenu(null); }} />
                 <div className="h-[2px] bg-ink my-2 opacity-20" />
                 <MenuAction icon={Filter} label="Clear from Device" onClick={() => deleteTrack(song.id)} variant="danger" />
               </motion.div>
             )}
           </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

const Library: React.FC<LibraryProps> = ({ screen, songs, onRefresh, onPlay }) => {
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'compact'>('list');
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { playSong, addToQueue, haptic } = useAudio();

  const handlePlay = (song: Song, queueIds: string[]) => {
    playSong(song, queueIds);
    if (onPlay) onPlay();
  };

  const handleScanning = async () => {
    setIsScanning(true);
    try {
      let newSongs: Song[] = [];
      
      // Try Native Scanner First if on mobile
      const { isNative, scanNativeMusic } = await import('../lib/nativeScanner');
      if (await isNative()) {
        newSongs = await scanNativeMusic();
      } else if ('showDirectoryPicker' in window) {
        // Use File System Access API on Desktop
        newSongs = await scanLocalDirectory();
      } else {
        // Fallback to hidden folder input
        folderInputRef.current?.click();
        return;
      }

      if (newSongs.length > 0) {
        for (const song of newSongs) {
          await db.saveSong(song);
        }
        onRefresh();
      }
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || isScanning) return;
    setIsScanning(true);
    try {
      const filesArray = Array.from(e.target.files) as File[];
      const newSongs = await scanDirectory(filesArray);
      for (const song of newSongs) {
        await db.saveSong(song);
      }
      onRefresh();
    } catch (err) {
      console.error('Piel Engine: Scanning aborted.', err);
    } finally {
      setIsScanning(false);
      e.target.value = ''; 
    }
  };

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const [libraryTab, setLibraryTab] = useState<'folders' | 'songs' | 'recent' | 'liked'>(
    screen === 'folders' ? 'folders' : (screen === 'favorites' ? 'liked' : 'songs')
  );
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  useEffect(() => {
    setActiveMenu(null);
    setSelectedFolder(null);
    if (screen === 'home') setLibraryTab('songs');
    else if (screen === 'folders') setLibraryTab('folders');
    else if (screen === 'favorites') setLibraryTab('liked');
    else setLibraryTab('songs');
  }, [screen]);

  const getFolder = (song: Song) => {
    if (song.nativePath && song.nativePath.includes('/')) {
      const parts = song.nativePath.split('/');
      return parts[parts.length - 2];
    }
    return 'Music';
  };

  const filteredSongs = songs.filter(s => {
    if (selectedFolder) return getFolder(s) === selectedFolder;
    if (libraryTab === 'liked') return s.liked === true || s.rating === 5;
    if (libraryTab === 'recent') return true; 
    return true;
  });

  const getScreenTitle = () => {
    if (selectedFolder) return selectedFolder;
    if (libraryTab === 'folders') return 'Scanner';
    if (libraryTab === 'liked' || screen === 'favorites') return 'Liked';
    if (screen === 'home') return 'Home';
    return 'Library';
  };

  const folders = Array.from(new Set(songs.map(s => getFolder(s)))) as string[];
  const folderCounts = folders.reduce((acc, folder: string) => {
    acc[folder] = songs.filter(s => getFolder(s) === folder).length;
    return acc;
  }, {} as Record<string, number>);

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showNewPlaylistInput, setShowNewPlaylistInput] = useState(false);

  useEffect(() => {
    db.getAllPlaylists().then(setPlaylists);
  }, []);

  const addToPlaylist = async (playlistId: string) => {
    if (showPlaylistPicker) {
      haptic(20);
      await db.addSongToPlaylist(playlistId, showPlaylistPicker);
      setShowPlaylistPicker(null);
    }
  };

  const createAndAdd = async () => {
    if (!newPlaylistName.trim() || !showPlaylistPicker) return;
    haptic(30);
    const p: Playlist = {
      id: crypto.randomUUID(),
      name: newPlaylistName,
      songIds: [showPlaylistPicker],
      isSmart: false,
      createdAt: Date.now(),
    };
    await db.savePlaylist(p);
    setNewPlaylistName('');
    setShowNewPlaylistInput(false);
    setShowPlaylistPicker(null);
    db.getAllPlaylists().then(setPlaylists);
  };

  const toggleLike = async (songId: string) => {
    await db.toggleLike(songId);
    onRefresh();
  };

  const deleteTrack = async (songId: string) => {
    await db.deleteSong(songId);
    onRefresh();
    setActiveMenu(null);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto min-h-screen">
      {/* Global Backdrop for Song Menus */}
      <AnimatePresence>
        {activeMenu && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[45] bg-transparent cursor-default"
            onPointerDown={() => setActiveMenu(null)}
            onClick={() => setActiveMenu(null)}
            onTouchStart={() => setActiveMenu(null)}
          />
        )}
      </AnimatePresence>

      {/* Redesigned Header to match Image */}
      <div className="flex justify-between items-start mb-6 md:mb-8 px-1">
        <div className="flex gap-3 md:gap-4">
          <div className="space-y-0.5">
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter leading-none uppercase">
              {getScreenTitle()}
            </h2>
            <div className="text-crimson font-black text-[8px] md:text-[9px] uppercase tracking-[0.2em] leading-none opacity-80">
              {screen === 'folders' ? 'Deep System Analysis' : 'Your Personal High-Fidelity Stream'}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {screen === 'folders' && (
            <button 
              onClick={handleScanning}
              disabled={isScanning}
              className={`p-2 border-2 border-ink bg-gold text-ink shadow-brutal rounded-xl hover:bg-ink hover:text-gold transition-colors active:translate-y-0.5 active:shadow-none ${isScanning ? 'animate-pulse opacity-50' : ''}`}
              title="System Scan"
            >
               <Upload size={18} strokeWidth={2.5} />
            </button>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            multiple 
            className="hidden" 
            accept="audio/*"
          />
          <input 
            type="file" 
            ref={folderInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            {...({ webkitdirectory: "", directory: "" } as any)}
          />
          <button className="p-2 border-2 border-ink bg-cream shadow-brutal rounded-xl hover:bg-gold transition-colors active:translate-y-0.5 active:shadow-none transition-all">
             <Filter size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Tabs matching Image */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 no-scrollbar">
         {[
           { id: 'folders', label: 'FOLDERS' },
           { id: 'songs', label: 'ALL MUSIC' },
           { id: 'recent', label: 'RECENT' },
           { id: 'liked', label: 'LIKED' },
         ].map(tab => (
           <button
             key={tab.id}
             onClick={() => { haptic(15); setLibraryTab(tab.id as any); setSelectedFolder(null); }}
             className={`px-5 py-1.5 border-2 border-ink rounded-full font-bold text-[10px] uppercase tracking-widest whitespace-nowrap shadow-brutal transition-all active:translate-y-0.5 active:shadow-none ${libraryTab === tab.id ? 'bg-crimson text-cream' : 'bg-cream text-ink'}`}
           >
             {tab.label}
           </button>
         ))}
      </div>

      {!selectedFolder && libraryTab === 'folders' ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
           {folders.length === 0 ? (
             <div className="col-span-full h-64 border-4 border-dashed border-ink flex flex-col items-center justify-center bg-cream-warm p-8 text-center rounded-2xl">
               <div className="w-16 h-16 mb-4 text-ink-muted opacity-30"><Music2 size={64} /></div>
               <p className="font-display text-xl mb-4 text-ink-muted uppercase">Scanning for local frequencies...</p>
               <button 
                 onClick={handleScanning} 
                 disabled={isScanning}
                 className={`brutal-btn uppercase text-xs ${isScanning ? 'opacity-50' : ''}`}
               >
                 {isScanning ? 'Analyzing...' : 'Deep Scan'}
               </button>
             </div>
           ) : (
             folders.map(folder => (
               <motion.button
                 key={folder}
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 whileHover={{ x: 4 }}
                 whileTap={{ scale: 0.98 }}
                 onClick={() => { haptic(20); setSelectedFolder(folder); }}
                 className="w-full brutal-card p-2 md:p-3 flex items-center gap-3 md:gap-4 bg-cream hover:bg-gold transition-colors group text-left relative overflow-hidden"
               >
                  <div className="w-12 h-10 md:w-14 md:h-12 bg-crimson border-2 border-ink shadow-brutal rounded-xl flex items-center justify-center shrink-0">
                     <LayoutGrid className="w-5 h-5 md:w-6 md:h-6 text-cream" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                     <h4 className="font-serif text-xl md:text-2xl font-black text-ink leading-none truncate">{folder}</h4>
                     <p className="text-crimson font-bold text-[8px] md:text-[9px] uppercase tracking-widest mt-1 opacity-80">{folderCounts[folder]} SIGNALS DETECTED</p>
                  </div>
                  <ChevronRight size={16} className="text-ink opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all" strokeWidth={3} />
                  
                  {/* Decorative line matching the style */}
                  <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-ink opacity-5" />
               </motion.button>
             ))
           )}
        </div>
      ) : (
        <div className="space-y-4">
          {selectedFolder && (
            <div className="flex items-center gap-4 mb-6">
               <button 
                 onClick={() => setSelectedFolder(null)}
                 className="p-2 border-2 border-ink bg-ink text-cream rounded-lg"
               >
                 <X size={16} />
               </button>
               <h3 className="text-2xl font-black uppercase text-crimson">{selectedFolder}</h3>
            </div>
          )}
          
          {filteredSongs.map((song, i) => (
            <SongListItem 
              key={song.id}
              song={song}
              index={i}
              handlePlay={handlePlay}
              currentSongs={filteredSongs}
              toggleLike={toggleLike}
              addToQueue={addToQueue}
              haptic={haptic}
              deleteTrack={deleteTrack}
              activeMenu={activeMenu}
              setActiveMenu={setActiveMenu}
              setShowPlaylistPicker={setShowPlaylistPicker}
              formatDuration={formatDuration}
            />
          ))}
          {filteredSongs.length === 0 && (
            <div className="py-20 border-2 border-dashed border-ink/20 flex flex-col items-center justify-center opacity-30 rounded-2xl">
               <Music2 size={48} className="mb-4" />
               <p className="font-display text-xl uppercase font-black">Signals Not Found</p>
               <p className="font-ui text-[10px] uppercase tracking-widest mt-2">Adjust scan parameters or refresh index.</p>
            </div>
          )}
        </div>
      )}

      {/* Playlist Picker Modal */}
      <AnimatePresence>
        {showPlaylistPicker && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-ink/60 backdrop-blur-sm" 
              onClick={() => setShowPlaylistPicker(null)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-cream border-4 border-ink shadow-heavy p-6 rounded-2xl"
            >
              <div className="flex items-center justify-between mb-6 border-b-2 border-ink pb-2">
                <h3 className="font-display text-2xl uppercase font-black">Add to Collection</h3>
                <button 
                  onClick={() => setShowNewPlaylistInput(!showNewPlaylistInput)}
                  className={`p-2 border-2 border-ink transition-colors rounded-lg ${showNewPlaylistInput ? 'bg-crimson text-white' : 'bg-gold text-ink'}`}
                >
                   {showNewPlaylistInput ? <X size={16} /> : <Plus size={16} />}
                </button>
              </div>

              {showNewPlaylistInput ? (
                <div className="space-y-4">
                   <label className="font-ui text-[9px] uppercase font-black opacity-40 tracking-widest">Manifest Name</label>
                   <input 
                     autoFocus
                     type="text"
                     value={newPlaylistName}
                     onChange={(e) => setNewPlaylistName(e.target.value)}
                     className="brutal-input w-full text-lg px-4 py-2 border-2"
                     placeholder="e.g. DATA STREAM"
                     onKeyDown={(e) => e.key === 'Enter' && createAndAdd()}
                   />
                   <button 
                    onClick={createAndAdd}
                    className="w-full brutal-btn !bg-crimson !text-white text-xs py-3"
                   >
                     Create & Register
                   </button>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {playlists.map(playlist => (
                    <button
                      key={playlist.id}
                      onClick={() => addToPlaylist(playlist.id)}
                      className="w-full flex items-center justify-between p-3 bg-cream-warm border-2 border-ink hover:bg-crimson hover:text-white transition-all group rounded-xl"
                    >
                      <span className="font-ui text-xs font-black uppercase tracking-widest">{playlist.name}</span>
                      <span className="font-numeric text-[10px] opacity-40 group-hover:opacity-100">{playlist.songIds.length} tracks</span>
                    </button>
                  ))}
                  {playlists.length === 0 && (
                    <p className="text-center py-8 font-serif text-ink/40">No collections registered.</p>
                  )}
                </div>
              )}

              {!showNewPlaylistInput && (
                <button 
                  onClick={() => setShowPlaylistPicker(null)}
                  className="w-full mt-6 brutal-btn !bg-ink !text-cream text-xs py-3"
                >
                  Abort
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Library;
