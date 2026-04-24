import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, ListMusic, MoreVertical, Trash2, Edit2, Play, Shuffle, ChevronLeft, Search, Music2, X } from 'lucide-react';
import { db } from '../lib/db';
import { Song, Playlist } from '../types';
import { useAudio } from '../lib/AudioProvider';

interface PlaylistManagerProps {
  allSongs: Song[];
}

const PlaylistManager: React.FC<PlaylistManagerProps> = ({ allSongs }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showAddSongs, setShowAddSongs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { playSong, haptic } = useAudio();

  useEffect(() => {
    db.getAllPlaylists().then(setPlaylists);
  }, []);

  const refreshPlaylists = () => {
    db.getAllPlaylists().then(setPlaylists);
  };

  const handleCreate = async () => {
    if (!newPlaylistName.trim()) return;
    const p: Playlist = {
      id: crypto.randomUUID(),
      name: newPlaylistName,
      songIds: [],
      isSmart: false,
      createdAt: Date.now(),
    };
    await db.savePlaylist(p);
    setNewPlaylistName('');
    setShowCreateModal(false);
    refreshPlaylists();
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await db.deletePlaylist(id);
    if (selectedPlaylistId === id) setSelectedPlaylistId(null);
    refreshPlaylists();
  };

  const handleAddSong = async (playlistId: string, songId: string) => {
    await db.addSongToPlaylist(playlistId, songId);
    refreshPlaylists();
  };

  const handleRemoveSong = async (playlistId: string, songId: string) => {
    await db.removeSongFromPlaylist(playlistId, songId);
    refreshPlaylists();
  };

  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId);
  const playlistSongs = selectedPlaylist 
    ? allSongs.filter(s => selectedPlaylist.songIds.includes(s.id))
    : [];
  
  const songsToPick = allSongs.filter(s => 
    selectedPlaylist && 
    !selectedPlaylist.songIds.includes(s.id) &&
    (searchQuery === '' || 
     s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
     s.artist.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (selectedPlaylistId && selectedPlaylist) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 md:mb-12">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedPlaylistId(null)}
              className="p-3 border-2 border-ink bg-cream-warm shadow-brutal hover:bg-crimson hover:text-white transition-all rounded-xl"
            >
              <ChevronLeft size={24} />
            </button>
            <div>
              <div className="font-ui text-[10px] uppercase font-black opacity-40 tracking-widest mb-1">Collection</div>
              <h2 className="text-4xl md:text-6xl uppercase tracking-tighter italic font-black leading-none">{selectedPlaylist.name}</h2>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => { haptic(30); setShowAddSongs(true); }}
              className="brutal-btn flex items-center gap-2 bg-gold text-ink"
            >
              <Plus size={20} />
              <span>ADD SIGNALS</span>
            </button>
            {playlistSongs.length > 0 && (
              <button 
                onClick={() => { haptic(50); playSong(playlistSongs[0], playlistSongs.map(s => s.id)); }}
                className="brutal-btn !bg-crimson !text-cream flex items-center gap-2"
              >
                <Play size={18} fill="currentColor" />
                <span>LAUNCH</span>
              </button>
            )}
          </div>
        </div>

        <div className="max-w-4xl">
          {/* List of songs */}
          <div className="space-y-4">
             {playlistSongs.length === 0 ? (
               <div className="py-20 border-4 border-dashed border-ink flex flex-col items-center justify-center opacity-30 italic bg-cream-dark/5 shadow-inner">
                 <Music2 size={64} className="mb-6 opacity-40" />
                 <p className="font-display text-2xl uppercase font-black">Array Vacancy</p>
                 <p className="font-ui text-[10px] uppercase tracking-widest mt-2">Register signals to populate this set.</p>
                 <button 
                   onClick={() => setShowAddSongs(true)}
                   className="mt-8 px-8 py-3 bg-ink text-cream font-ui font-black uppercase text-[10px] tracking-[0.3em] hover:bg-crimson transition-colors rounded-lg"
                 >
                   Open Manifest
                 </button>
               </div>
             ) : (
               <div className="space-y-2">
                 {playlistSongs.map((song, i) => (
                   <div 
                    key={song.id} 
                    onClick={() => playSong(song, playlistSongs.map(s => s.id))}
                    className="flex items-center gap-4 p-3 md:p-4 bg-cream border-2 border-ink shadow-brutal group hover:bg-cream-warm transition-all cursor-pointer rounded-xl"
                   >
                     <div className="w-8 text-center font-numeric text-xs opacity-40">{i + 1}</div>
                     <div className="w-10 h-10 md:w-12 md:h-12 border-2 border-ink bg-ink flex-shrink-0 overflow-hidden">
                        {song.picture ? <img src={song.picture} className="w-full h-full object-cover" /> : <div className="w-full h-full" />}
                     </div>
                     <div className="flex-1 min-w-0">
                       <div className="font-display text-sm md:text-base font-black italic uppercase truncate leading-none">{song.title}</div>
                       <div className="font-ui text-[9px] md:text-[10px] font-bold text-ink opacity-40 uppercase truncate tracking-widest mt-1">{song.artist}</div>
                     </div>
                     <div className="hidden sm:block font-numeric text-[10px] opacity-40">
                        {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                     </div>
                     <button 
                      onClick={(e) => { e.stopPropagation(); haptic(10); handleRemoveSong(selectedPlaylist.id, song.id); }}
                      className="p-3 text-ink/20 hover:text-crimson transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
                     >
                        <Trash2 size={18} />
                     </button>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>

        {/* Add Songs Picker Modal */}
        <AnimatePresence>
          {showAddSongs && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-ink/80 backdrop-blur-md" 
                onClick={() => setShowAddSongs(false)} 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 50 }}
                className="relative w-full max-w-2xl bg-cream border-4 border-ink shadow-heavy flex flex-col max-h-[80vh] rounded-3xl overflow-hidden"
              >
                <div className="p-6 md:p-8 border-b-4 border-ink bg-cream-dark flex flex-col gap-4">
                   <div className="flex items-center justify-between">
                     <h3 className="font-display text-2xl md:text-3xl uppercase font-black italic leading-none">Signal Ingestion</h3>
                     <button onClick={() => setShowAddSongs(false)} className="p-2 hover:bg-ink/5 rounded-full"><X size={24} /></button>
                   </div>
                   
                   <div className="relative">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink opacity-30" size={16} />
                     <input 
                       autoFocus
                       type="text" 
                       placeholder="FILTER BROADCASTS..."
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                       className="w-full bg-cream border-2 border-ink pl-12 pr-4 py-3 font-ui text-xs font-black uppercase tracking-widest rounded-xl focus:ring-0 outline-none"
                     />
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 custom-scrollbar">
                   {songsToPick.map(song => (
                     <div key={song.id} className="flex items-center gap-4 p-3 bg-cream-warm border-2 border-ink hover:bg-gold/10 transition-colors group rounded-xl">
                        <div className="w-10 h-10 border-2 border-ink bg-ink flex-shrink-0">
                          {song.picture ? <img src={song.picture} className="w-full h-full object-cover" /> : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-display text-xs font-black uppercase truncate italic leading-none">{song.title}</div>
                          <div className="font-ui text-[8px] font-bold opacity-40 uppercase truncate mt-1 tracking-widest">{song.artist}</div>
                        </div>
                        <button 
                          onClick={() => { haptic(20); handleAddSong(selectedPlaylist.id, song.id); }}
                          className="px-4 py-2 bg-ink text-cream hover:bg-crimson font-ui text-[9px] font-black uppercase tracking-tighter transition-all rounded-lg"
                        >
                          Ingest
                        </button>
                     </div>
                   ))}
                   {songsToPick.length === 0 && searchQuery && (
                     <div className="py-20 text-center italic opacity-30">No signals match your frequency.</div>
                   )}
                   {songsToPick.length === 0 && !searchQuery && (
                     <div className="py-20 text-center italic opacity-30">All signals registered in this array.</div>
                   )}
                </div>

                <div className="p-6 border-t-4 border-ink bg-cream-dark text-center">
                   <p className="font-ui text-[10px] font-black uppercase tracking-[0.2em] opacity-40">End of Manifest</p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 lg:p-16 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 md:mb-12 border-b-4 border-ink pb-8 md:pb-12">
        <div className="border-l-4 border-crimson pl-4 md:pl-6">
          <h2 className="text-4xl md:text-6xl uppercase tracking-tighter italic font-black leading-none mb-2">Playlists</h2>
          <p className="font-ui text-[9px] md:text-[10px] text-ink opacity-40 uppercase tracking-[0.3em] font-bold">Curated Sound Collections</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="brutal-btn flex items-center justify-center gap-2 text-xs md:text-lg">
          <Plus size={20} />
          <span>New Collection</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8">
        {playlists.map((playlist) => (
          <motion.div
            key={playlist.id}
            whileHover={{ scale: 1.02 }}
            onClick={() => setSelectedPlaylistId(playlist.id)}
            className="group brutal-border bg-cream p-3 md:p-4 hover:shadow-heavy transition-all cursor-pointer relative"
          >
            <div className="aspect-square border-2 border-ink bg-cream-dark mb-4 shadow-brutal overflow-hidden relative">
               <div className="w-full h-full flex items-center justify-center font-display text-4xl md:text-7xl text-ink-muted opacity-30 select-none italic font-black">
                 {playlist.name[0]}
               </div>
               <div className="absolute inset-0 bg-crimson/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const pSongs = allSongs.filter(s => playlist.songIds.includes(s.id));
                      if (pSongs.length > 0) playSong(pSongs[0], pSongs.map(s => s.id));
                    }}
                    className="w-12 h-12 md:w-16 md:h-16 bg-cream border-2 border-ink text-crimson hover:scale-110 transition-transform shadow-brutal flex items-center justify-center"
                  >
                    <Play className="w-6 h-6 md:w-8 md:h-8 fill-current" />
                  </button>
               </div>
            </div>
            
            <div className="space-y-1">
              <h3 className="font-display text-base md:text-2xl uppercase tracking-tight font-black italic truncate leading-none">{playlist.name}</h3>
              <div className="flex items-center justify-between">
                <p className="font-ui text-[8px] md:text-[10px] text-ink opacity-40 uppercase tracking-widest font-black truncate">{playlist.songIds.length} TRACKS</p>
                <button 
                  onClick={(e) => handleDelete(playlist.id, e)}
                  className="p-1 md:opacity-0 md:group-hover:opacity-100 hover:text-crimson transition-all text-ink/40 hover:text-crimson"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}

        {playlists.length === 0 && (
          <div className="col-span-full border-2 border-dashed border-ink p-12 md:p-24 flex flex-col items-center justify-center text-ink opacity-10 italic">
            <ListMusic size={64} className="mb-4" />
            <p className="font-display text-2xl md:text-4xl uppercase font-black text-center">Silence Has No Curator</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-ink/60 backdrop-blur-sm" 
              onClick={() => setShowCreateModal(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-cream-warm border-4 border-ink shadow-heavy p-6 md:p-10"
            >
              <h3 className="font-display text-2xl md:text-4xl uppercase tracking-tighter mb-8 italic font-black">Define Collection</h3>
              <div className="space-y-6 md:space-y-8">
                <div>
                  <label className="font-ui text-[9px] md:text-[10px] text-ink opacity-40 uppercase tracking-[0.4em] font-bold block mb-3">Manifest Name</label>
                  <input 
                    autoFocus
                    type="text" 
                    value={newPlaylistName} 
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    className="brutal-input text-xl md:text-3xl bg-cream border-4 border-ink w-full px-4 py-3" 
                    placeholder="e.g. SONIC GRID"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button onClick={handleCreate} className="brutal-btn !bg-crimson !text-cream flex-1 py-4 text-sm md:text-lg">Register</button>
                  <button onClick={() => setShowCreateModal(false)} className="brutal-btn bg-ink text-cream hover:opacity-80 flex-1 py-4 text-sm md:text-lg">Abort</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PlaylistManager;
