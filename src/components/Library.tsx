import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Filter, List, Grid, LayoutGrid, MoreVertical, Play, Heart, Star, Plus, Music2, X } from 'lucide-react';
import { Song, Playlist } from '../types';
import { parseSongFile, scanDirectory } from '../lib/libraryScanner';
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
    className={`w-full flex items-center gap-3 px-3 py-2 text-[10px] uppercase font-bold tracking-widest hover:bg-cream-dark transition-colors ${variant === 'danger' ? 'text-crimson' : active ? 'text-gold' : 'text-ink'}`}
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
  const [isSwiping, setIsSwiping] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  return (
    <div className={`relative group mb-5 ${activeMenu === song.id ? 'z-[60]' : 'z-auto'}`}>
      {/* Swipe Background */}
      <div className={`absolute inset-0 flex items-center px-6 text-white transition-all duration-300 rounded-xl overflow-hidden ${isSwiping ? 'bg-crimson shadow-inner' : 'bg-ink/5 opacity-0'}`}>
         <motion.div 
           className="flex items-center gap-2"
           animate={{
             scale: isSwiping ? 1.1 : 0.9,
             opacity: isSwiping ? 1 : 0
           }}
         >
           <Plus size={18} strokeWidth={3} />
           <span className="font-ui text-[10px] font-black uppercase tracking-[0.2em]">Add to Queue</span>
         </motion.div>
      </div>

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
            <span className="font-display text-xs font-black uppercase italic">Signal Added to Sequence</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.02 }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.7 }}
        dragSnapToOrigin
        onDrag={(e, info) => {
          if (info.offset.x > 80) {
            if (!isSwiping) haptic(5);
            setIsSwiping(true);
          } else {
            setIsSwiping(false);
          }
        }}
        onDragEnd={(_, info) => {
          if (info.offset.x > 80) {
            addToQueue(song.id);
            haptic([10, 5, 10]);
            setJustAdded(true);
            setTimeout(() => setJustAdded(false), 2000);
          }
          setIsSwiping(false);
        }}
        onDoubleClick={() => handlePlay(song, currentSongs.map(s => s.id))}
        onClick={() => { 
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
              {song.picture ? <img src={song.picture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-display text-[10px] text-cream opacity-20">P</div>}
           </div>
           <div className="min-w-0">
             <div className="font-display text-sm md:text-base font-black italic uppercase leading-none truncate tracking-tight">{song.title}</div>
             <div className="font-ui text-[9px] md:text-[10px] font-bold text-ink opacity-40 truncate uppercase tracking-widest mt-1">{song.artist}</div>
           </div>
        </div>
        <div className="flex-1 hidden md:block font-serif text-sm italic text-ink-muted truncate pr-4">
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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || isScanning) return;
    setIsScanning(true);
    try {
      console.log(`Piel Engine: Indexing ${e.target.files.length} signals...`);
      const newSongs = await scanDirectory(e.target.files);
      console.log(`Piel Engine: Identified ${newSongs.length} valid audio paths.`);
      for (const song of newSongs) {
        await db.saveSong(song);
      }
      onRefresh();
    } catch (err) {
      console.error('Piel Engine: Scanning aborted due to unexpected signal interference.', err);
    } finally {
      setIsScanning(false);
      if (e.target) e.target.value = ''; // Reset input
    }
  };

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const currentSongs = songs.filter(s => {
    if (screen === 'favorites') return s.liked === true || s.rating === 5;
    return true;
  });

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
    <div className="p-4 md:p-8">
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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 md:mb-12">
        <div className="border-l-4 border-crimson pl-4 md:pl-6">
          <h2 className="text-4xl md:text-6xl uppercase tracking-tighter italic font-black leading-none mb-2">{screen}</h2>
          <div className="font-ui text-[9px] md:text-[10px] text-ink opacity-60 uppercase font-bold tracking-[0.4em]">
            {currentSongs.length} REGISTERED TRACKS
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:gap-6">
          {(screen === 'home' || screen === 'folders') && (
            <>
              <input
                type="file"
                ref={folderInputRef}
                webkitdirectory=""
                directory=""
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="audio/*,.mp3,.flac,.wav,.aac,.ogg,.m4a"
                className="hidden"
                onChange={handleFileUpload}
              />
              
              <div className="flex gap-2 w-full md:w-auto">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isScanning}
                  className="brutal-btn flex-1 md:flex-none text-xs bg-cream-warm text-ink"
                >
                  <Plus className="inline-block mr-2 w-3 h-3" />
                  FILES
                </button>
                <button 
                  onClick={() => folderInputRef.current?.click()}
                  disabled={isScanning}
                  className="brutal-btn flex-1 md:flex-none text-xs"
                >
                  {isScanning ? 'INDEXING...' : 'FOLDER'}
                </button>
              </div>
            </>
          )}
          
          <div className="flex border-2 border-ink brutal-shadow bg-cream overflow-hidden">
             {[
               { id: 'list', icon: List },
               { id: 'grid', icon: LayoutGrid },
               { id: 'compact', icon: Grid }
             ].map(({ id, icon: Icon }) => (
               <button
                 key={id}
                 onClick={() => setViewMode(id as any)}
                 className={`p-2.5 md:p-3 transition-colors ${viewMode === id ? 'bg-crimson text-white' : 'hover:bg-cream-dark text-ink'}`}
               >
                 <Icon className="w-4 h-4 md:w-5 md:h-5" />
               </button>
             ))}
          </div>
        </div>
      </div>

      {currentSongs.length === 0 ? (
        <div className="h-64 border-2 border-dashed border-ink flex flex-col items-center justify-center bg-cream-warm p-8 text-center">
          <div className="w-16 h-16 mb-4 text-ink-muted opacity-30"><Music2 size={64} /></div>
          <p className="font-display text-xl mb-4 text-ink-muted uppercase">Your library is skin and bones.</p>
          <button onClick={() => folderInputRef.current?.click()} className="brutal-btn uppercase text-xs">Begin Deep Scan (Folder)</button>
          <button onClick={() => fileInputRef.current?.click()} className="mt-4 font-ui text-[10px] uppercase font-bold text-crimson hover:underline">Or Select Individual Files</button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header Row */}
          <div className="flex items-center px-4 py-2 font-mono text-[9px] md:text-[10px] text-ink-muted tracking-widest uppercase border-b-2 border-ink mb-4">
             <div className="w-8 md:w-12 text-center">#</div>
             <div className="flex-1">Title & Artist</div>
             <div className="flex-1 hidden md:block">Album</div>
             <div className="w-20 md:w-24 text-right">Duration</div>
             <div className="w-32 text-center hidden lg:block">Rating</div>
             <div className="w-8 md:w-12"></div>
          </div>

          {currentSongs.map((song, i) => (
            <SongListItem 
              key={song.id}
              song={song}
              index={i}
              handlePlay={handlePlay}
              currentSongs={currentSongs}
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
                <h3 className="font-display text-2xl uppercase italic font-black">Add to Collection</h3>
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
                    <p className="text-center py-8 font-serif italic text-ink/40">No collections registered.</p>
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
