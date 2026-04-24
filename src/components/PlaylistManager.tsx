import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, ListMusic, MoreVertical, Trash2, Edit2, Play, Shuffle } from 'lucide-react';
import { db } from '../lib/db';
import { Song, Playlist } from '../types';

const PlaylistManager: React.FC = () => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  useEffect(() => {
    db.getAllPlaylists().then(setPlaylists);
  }, []);

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
    db.getAllPlaylists().then(setPlaylists);
  };

  const handleDelete = async (id: string) => {
    await db.deletePlaylist(id);
    db.getAllPlaylists().then(setPlaylists);
  };

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
            className="group brutal-border bg-white p-3 md:p-4 hover:shadow-heavy transition-all cursor-pointer relative"
          >
            <div className="aspect-square border-2 border-ink bg-cream-dark mb-4 shadow-brutal overflow-hidden relative">
               <div className="w-full h-full flex items-center justify-center font-display text-4xl md:text-7xl text-ink-muted opacity-30 select-none italic font-black">
                 {playlist.name[0]}
               </div>
               <div className="absolute inset-0 bg-crimson/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <button className="w-12 h-12 md:w-16 md:h-16 bg-white border-2 border-ink text-crimson hover:scale-110 transition-transform shadow-brutal flex items-center justify-center">
                    <Play className="w-6 h-6 md:w-8 md:h-8 fill-current" />
                  </button>
               </div>
            </div>
            
            <div className="space-y-1">
              <h3 className="font-display text-base md:text-2xl uppercase tracking-tight font-black italic truncate leading-none">{playlist.name}</h3>
              <div className="flex items-center justify-between">
                <p className="font-ui text-[8px] md:text-[10px] text-ink opacity-40 uppercase tracking-widest font-black truncate">{playlist.songIds.length} TRACKS</p>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(playlist.id); }}
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

      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
          <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
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
    </div>
  );
};

export default PlaylistManager;
