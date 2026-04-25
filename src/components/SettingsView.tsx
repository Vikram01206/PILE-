import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Volume2, Shield, Monitor, HardDrive, Trash2, Cpu, Activity, Smartphone, Download, Search, RefreshCw, Music } from 'lucide-react';
import { db } from '../lib/db';
import { useAudio } from '../lib/AudioProvider';
import { isNative, scanNativeMusic } from '../lib/nativeScanner';

const SettingsView: React.FC = () => {
  const [confirmClear, setConfirmClear] = React.useState(false);
  const { state, setEQBand, toggleGapless, toggleNormalization, haptic } = useAudio();
  const [eqGains, setEqGains] = React.useState<number[]>(new Array(10).fill(0));
  const [isScanning, setIsScanning] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [isNativeDevice, setIsNativeDevice] = useState(false);

  useEffect(() => {
    isNative().then(setIsNativeDevice);
  }, []);

  const handleScan = async () => {
    try {
      haptic(30);
      setIsScanning(true);
      setScanCount(0);
      await scanNativeMusic((count) => setScanCount(count));
      haptic(50);
      alert(`Piel scan complete. Found and indexed ${scanCount} new signals.`);
    } catch (e) {
      console.error(e);
      alert('Scan transmission failed. Ensure storage permissions are granted.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleEQChange = (index: number, value: number) => {
    setEqGains(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setEQBand(index, value);
  };

  const clearLibrary = async () => {
    await db.clearAll();
    window.location.reload(); 
  };

  const frequencies = ['60', '170', '310', '600', '1k', '3k', '6k', '12k', '14k', '16k'];

  return (
    <div className="px-6 py-10 md:px-12 md:py-16 max-w-4xl mx-auto space-y-16">
      <div className="border-l-8 border-crimson pl-8 mb-12">
        <h2 className="text-3xl md:text-5xl uppercase tracking-tighter italic font-black leading-tight mb-2">Configuration</h2>
        <p className="font-ui text-[9px] md:text-[11px] tracking-[0.4em] text-ink opacity-60 uppercase font-bold">Engine Tuning & Resonance</p>
      </div>

      <section className="space-y-8">
         <div className="flex items-center gap-4 border-b-4 border-ink pb-4">
           <Activity className="w-6 h-6 text-crimson" />
           <h3 className="font-display text-xl md:text-2xl uppercase italic font-black">10-Band Equalizer</h3>
         </div>
         
         <div className="brutal-card p-8 md:p-12 bg-cream-warm">
            <div className="flex justify-between items-end h-48 md:h-64 gap-1.5 md:gap-5">
               {eqGains.map((gain, i) => (
                 <div key={i} className="flex-1 flex flex-col items-center gap-3 md:gap-4 h-full">
                    <div 
                      className="flex-1 w-2 md:w-6 bg-ink/5 relative brutal-border overflow-hidden group cursor-ns-resize"
                      onMouseDown={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const update = (clientY: number) => {
                          const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
                          const val = Math.round(( (1 - y) * 24 - 12 ) * 2) / 2;
                          handleEQChange(i, val);
                        };
                        const moveHandler = (moveEvent: MouseEvent) => update(moveEvent.clientY);
                        const stop = () => {
                          window.removeEventListener('mousemove', moveHandler);
                          window.removeEventListener('mouseup', stop);
                        };
                        window.addEventListener('mousemove', moveHandler);
                        window.addEventListener('mouseup', stop);
                        update(e.clientY);
                      }}
                      onTouchStart={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const update = (clientY: number) => {
                          const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
                          const val = Math.round(( (1 - y) * 24 - 12 ) * 2) / 2;
                          handleEQChange(i, val);
                        };
                        const moveHandler = (touchEvent: TouchEvent) => {
                          update(touchEvent.touches[0].clientY);
                        };
                        const stop = () => {
                          window.removeEventListener('touchmove', moveHandler);
                          window.removeEventListener('touchend', stop);
                        };
                        window.addEventListener('touchmove', moveHandler, { passive: false });
                        window.addEventListener('touchend', stop);
                        update(e.touches[0].clientY);
                      }}
                    >
                       <div 
                         className="absolute bottom-0 left-0 right-0 bg-crimson transition-all pointer-events-none"
                         style={{ height: `${((gain + 12) / 24) * 100}%` }}
                       />
                       <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-ink/10 pointer-events-none" />
                    </div>
                    <div className="font-mono text-[8px] md:text-[9px] uppercase font-bold opacity-60">
                       {frequencies[i]}
                    </div>
                    <div className="font-numeric text-[8px] md:text-[9px] font-bold text-crimson">
                       {gain > 0 ? `+${gain}` : gain}
                    </div>
                 </div>
               ))}
            </div>
            <div className="mt-10 flex justify-center">
               <button 
                onClick={() => eqGains.forEach((_, i) => handleEQChange(i, 0))}
                className="brutal-btn text-[10px] px-8 py-3 bg-ink text-cream hover:bg-crimson"
               >
                 FLATTEN SPECTRUM
               </button>
            </div>
         </div>
      </section>

      <section className="space-y-8">
         <div className="flex items-center gap-4 border-b-2 border-ink pb-4">
           <Volume2 className="w-6 h-6 text-crimson" />
           <h3 className="font-display text-2xl uppercase italic font-black">Playback</h3>
         </div>
         
         <div className="grid gap-6 md:gap-8">
            <div className="flex items-center justify-between brutal-card p-6 md:p-8 bg-cream">
               <div className="space-y-2">
                  <div className="font-display text-xl md:text-2xl uppercase italic font-black leading-tight">Gapless Playback</div>
                  <div className="font-ui text-[10px] md:text-xs text-ink opacity-50 uppercase tracking-widest font-black font-bold">Seamless Transitions</div>
               </div>
               <div 
                onClick={toggleGapless}
                className={`w-12 h-6 border-2 border-ink relative cursor-pointer transition-colors ${state.isGapless ? 'bg-crimson' : 'bg-cream'}`}
               >
                  <div className={`absolute top-1 bottom-1 w-4 bg-ink transition-all ${state.isGapless ? 'right-1' : 'left-1'}`} />
               </div>
            </div>

            <div className="flex items-center justify-between brutal-card p-6 md:p-8 bg-cream">
               <div className="space-y-2">
                  <div className="font-display text-xl md:text-2xl uppercase italic font-black leading-tight">Normalization</div>
                  <div className="font-ui text-[10px] md:text-xs text-ink opacity-50 uppercase tracking-widest font-black font-bold">Consistent Volume Floor</div>
               </div>
               <div 
                onClick={toggleNormalization}
                className={`w-12 h-6 border-2 border-ink relative cursor-pointer transition-colors ${state.isNormalized ? 'bg-crimson' : 'bg-cream'}`}
               >
                  <div className={`absolute top-1 bottom-1 w-4 bg-ink transition-all ${state.isNormalized ? 'right-1' : 'left-1'}`} />
               </div>
            </div>
         </div>
      </section>

      <section className="space-y-8">
         <div className="flex items-center gap-4 border-b-2 border-ink pb-4">
           <Monitor className="w-6 h-6 text-crimson" />
           <h3 className="font-display text-2xl uppercase italic font-black">Interface</h3>
         </div>
         
         <div className="grid gap-6 md:gap-8">
            <div className="flex items-center justify-between brutal-card p-6 md:p-8 bg-cream">
               <div className="space-y-2">
                  <div className="font-display text-xl md:text-2xl uppercase italic font-black leading-tight">Brutalist Shadows</div>
                  <div className="font-ui text-[10px] md:text-xs text-ink opacity-50 uppercase tracking-widest font-black font-bold">High-Offset Visual Depth</div>
               </div>
               <div className="brutal-btn p-1.5 px-5 text-[10px] font-black italic">ALWAYS ON</div>
            </div>

            <div className="flex items-center justify-between brutal-card p-6 md:p-8 bg-cream">
               <div className="space-y-2">
                  <div className="font-display text-xl md:text-2xl uppercase italic font-black leading-tight">Visualizer</div>
                  <div className="font-ui text-[10px] md:text-xs text-ink opacity-50 uppercase tracking-widest font-black font-bold">Real-time Spectral Wave</div>
               </div>
               <div className="w-12 h-6 bg-crimson border-2 border-ink relative cursor-pointer">
                  <div className="absolute right-1 top-1 bottom-1 w-4 bg-ink" />
               </div>
            </div>
         </div>
      </section>
      
      {isNativeDevice && (
        <section className="space-y-8">
           <div className="flex items-center gap-4 border-b-2 border-ink pb-4">
             <Search className="w-6 h-6 text-crimson" />
             <h3 className="font-display text-2xl uppercase italic font-black">Native Scan</h3>
           </div>
           
           <div className="brutal-card p-6 md:p-8 bg-gold">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                 <div className="space-y-2">
                    <h4 className="font-display text-2xl uppercase italic font-black text-ink leading-tight">Autonomous Retrieval</h4>
                    <p className="font-serif text-sm italic text-ink/70 max-w-md">Search your local device storage for music signals and ingest them into the Piel database.</p>
                 </div>
                 <button 
                   disabled={isScanning}
                   onClick={handleScan}
                   className={`brutal-btn min-w-[200px] flex items-center justify-center gap-3 py-4 ${isScanning ? 'bg-ink/20 cursor-wait' : 'bg-ink text-cream hover:bg-crimson'}`}
                 >
                   {isScanning ? (
                     <>
                        <RefreshCw size={18} className="animate-spin" />
                        <span>INGESTING {scanCount}</span>
                     </>
                   ) : (
                     <>
                        <Music size={18} />
                        <span>INDEX LOCAL STORAGE</span>
                     </>
                   )}
                 </button>
              </div>
           </div>
        </section>
      )}

      <section className="space-y-8">
         <div className="flex items-center gap-4 border-b-2 border-ink pb-4">
           <Smartphone className="w-6 h-6 text-crimson" />
           <h3 className="font-display text-2xl uppercase italic font-black">Mobile Transmission</h3>
         </div>
         
         <div className="brutal-card p-6 md:p-8 bg-gold/10">
            <div className="flex items-start gap-6">
               <div className="p-4 bg-gold border-4 border-ink shadow-brutal rounded-2xl hidden sm:block">
                  <Download size={32} className="text-ink" />
               </div>
               <div className="flex-1 space-y-4">
                  <h4 className="font-display text-2xl uppercase italic font-black leading-tight">Install Piel as App</h4>
                  <p className="font-serif text-sm italic opacity-70 leading-relaxed">Piel is a Progressive Web App. You can install it directly onto your mobile device for an APK-like experience with full offline support.</p>
                  
                  <div className="space-y-3">
                     <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-ink text-cream flex items-center justify-center font-mono text-[10px] font-bold">1</div>
                        <p className="font-ui text-[10px] uppercase font-bold tracking-widest">Open this page on your mobile browser</p>
                     </div>
                     <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-ink text-cream flex items-center justify-center font-mono text-[10px] font-bold">2</div>
                        <p className="font-ui text-[10px] uppercase font-bold tracking-widest">Select "Add to Home Screen" from menu</p>
                     </div>
                     <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-ink text-cream flex items-center justify-center font-mono text-[10px] font-bold">3</div>
                        <p className="font-ui text-[10px] uppercase font-bold tracking-widest">Launch Piel from your app drawer</p>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </section>

      <section className="space-y-8">
         <div className="flex items-center gap-4 border-b-2 border-ink pb-4 text-crimson">
           <Trash2 className="w-6 h-6" />
           <h3 className="font-display text-2xl uppercase italic font-black">Destruction</h3>
         </div>
         
         <div className="brutal-card p-8 md:p-12 border-crimson border-4 bg-crimson/5">
            <h4 className="font-display text-2xl md:text-3xl mb-4 text-crimson uppercase italic font-black">Purge Library State</h4>
            <p className="font-serif text-base italic mb-10 opacity-70 leading-relaxed">Wipe all analysed metadata, ratings, and play history from this device. Piel's sonic memory will be erased reset to a zero state.</p>
            
            {confirmClear ? (
              <div className="flex gap-4">
                <button onClick={clearLibrary} className="brutal-btn !bg-crimson !text-cream px-8">CONFIRM PURGE</button>
                <button onClick={() => setConfirmClear(false)} className="brutal-btn bg-cream text-ink px-8">CANCEL</button>
              </div>
            ) : (
              <button onClick={() => setConfirmClear(true)} className="brutal-btn bg-ink text-cream hover:bg-crimson px-10">RESET DATABASE</button>
            )}
         </div>
      </section>

      <div className="flex justify-center flex-col items-center gap-2 opacity-30 py-12">
         <div className="font-display text-4xl">PIEL v1.0</div>
         <div className="font-mono text-[10px] tracking-[0.5em] uppercase">Built for resonance</div>
      </div>
    </div>
  );
};

export default SettingsView;
