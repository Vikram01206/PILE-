import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BarChart3, TrendingUp, Clock, Calendar, Music2, Mic2 } from 'lucide-react';
import { db } from '../lib/db';
import { Song, ListeningStat } from '../types';

const StatsView: React.FC = () => {
  const [stats, setStats] = useState<ListeningStat[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [topArtists, setTopArtists] = useState<{name: string, count: number}[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const [s, songs] = await Promise.all([db.getStats(), db.getAllSongs()]);
      setStats(s);
      setAllSongs(songs);

      // Process top artists
      const artistCounts: Record<string, number> = {};
      s.forEach(stat => {
        const song = songs.find(so => so.id === stat.songId);
        if (song) {
          const artist = song.artist;
          artistCounts[artist] = (artistCounts[artist] || 0) + 1;
        }
      });
      const top = Object.entries(artistCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setTopArtists(top);
    };
    loadData();
  }, []);

  const totalPlayTime = stats.length * 3.5; // Mocking average song duration or summing from stats if I had real duration
  
  // Heatmap generation (last 28 days)
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (27 - i));
    const count = stats.filter(s => {
      const date = new Date(s.timestamp);
      return date.toDateString() === d.toDateString();
    }).length;
    return { date: d, count };
  });

  return (
    <div className="p-6 md:p-8 lg:p-16 max-w-7xl mx-auto space-y-12 md:space-y-16">
      <div className="border-l-4 md:border-l-8 border-crimson pl-6 md:pl-8 mb-12 md:mb-16">
        <h2 className="text-5xl md:text-8xl italic font-black uppercase tracking-tighter leading-none mb-3 md:mb-4">ARCHIVE SCAN</h2>
        <p className="font-ui text-[10px] md:text-xs tracking-[0.3em] md:tracking-[0.5em] text-ink opacity-40 uppercase font-bold">Resonance Analysis & Consumption Metrics</p>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
        <div className="brutal-card p-6 md:p-10 bg-crimson text-white shadow-heavy">
           <div className="font-ui text-[8px] md:text-[10px] uppercase font-bold tracking-[0.3em] md:tracking-[0.4em] mb-4 md:mb-6 opacity-60">Total Signal Time</div>
           <div className="flex items-baseline gap-2">
             <div className="font-numeric text-5xl md:text-7xl font-black italic leading-none">{Math.round(totalPlayTime / 60)}</div>
             <div className="font-serif italic text-lg md:text-xl">m</div>
           </div>
           <Clock className="w-8 h-8 md:w-12 md:h-12 mt-6 md:mt-8 opacity-20" />
        </div>
        <div className="brutal-card p-6 md:p-10 bg-cream-warm shadow-heavy">
           <div className="font-ui text-[8px] md:text-[10px] uppercase font-bold tracking-[0.3em] md:tracking-[0.4em] mb-4 md:mb-6 opacity-40">Cycles Completed</div>
           <div className="flex items-baseline gap-2">
             <div className="font-numeric text-5xl md:text-7xl font-black italic leading-none">{stats.length}</div>
             <div className="font-serif italic text-lg md:text-xl">#</div>
           </div>
           <Music2 className="w-8 h-8 md:w-12 md:h-12 mt-6 md:mt-8 text-crimson opacity-20" />
        </div>
        <div className="brutal-card p-6 md:p-10 bg-ink text-cream shadow-heavy sm:col-span-2 lg:col-span-1">
           <div className="font-ui text-[8px] md:text-[10px] uppercase font-bold tracking-[0.3em] md:tracking-[0.4em] mb-4 md:mb-6 opacity-40">Total Registered</div>
           <div className="flex items-baseline gap-2 text-gold">
             <div className="font-numeric text-5xl md:text-7xl font-black italic leading-none">{allSongs.length}</div>
             <div className="font-serif italic text-lg md:text-xl">tr</div>
           </div>
           <TrendingUp className="w-8 h-8 md:w-12 md:h-12 mt-6 md:mt-8 opacity-20" />
        </div>
      </div>

      {/* Top Artists - Primary Focus Now */}
      <div className="brutal-card p-6 md:p-12 bg-cream-dark shadow-heavy">
        <h3 className="text-2xl md:text-4xl italic font-black uppercase tracking-tight mb-8 md:mb-12 border-b-2 md:border-b-4 border-ink pb-4 md:pb-6 flex items-center gap-4 text-crimson">
          <Mic2 className="w-6 h-6 md:w-8 md:h-8" />
          PRIMAL FREQUENCIES (TOP ARTISTS)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 md:gap-y-8">
          {topArtists.map((artist, i) => (
            <div key={i} className="flex items-center justify-between group cursor-default border-b border-ink/10 pb-4">
              <div className="flex items-center gap-4 md:gap-6">
                <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center font-numeric text-lg md:text-xl bg-ink text-cream border-2 border-ink shadow-brutal transform transition-transform group-hover:rotate-12 group-hover:bg-crimson">
                  {i + 1}
                </div>
                <div className="font-display text-xl md:text-3xl italic font-black uppercase tracking-tighter group-hover:text-crimson transition-colors truncate max-w-[150px] md:max-w-xs">{artist.name}</div>
              </div>
              <div className="font-numeric text-[10px] md:text-sm font-bold bg-cream px-2 md:px-3 py-1 border-2 border-ink shadow-brutal uppercase tracking-widest">{artist.count} PLAYS</div>
            </div>
          ))}
          {topArtists.length === 0 && <div className="col-span-full text-center font-ui py-20 text-ink opacity-20 uppercase tracking-[0.5em] font-bold italic">SIGNAL VOID</div>}
        </div>
      </div>
    </div>
  );
};

export default StatsView;
