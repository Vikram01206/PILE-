import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function PWAStatus() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <AnimatePresence>
      {(offlineReady || needRefresh) && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-20 md:bottom-24 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm"
        >
          <div className="bg-ink text-cream border-4 border-gold shadow-heavy p-4 rounded-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {offlineReady ? (
                <WifiOff className="text-gold" size={20} />
              ) : (
                <RefreshCw className="text-gold animate-spin" size={20} />
              )}
              <div>
                <p className="font-display text-sm uppercase font-black">
                  {offlineReady ? 'READY FOR OFFLINE' : 'UPDATE AVAILABLE'}
                </p>
                <p className="font-ui text-[9px] uppercase tracking-widest opacity-60">
                  {offlineReady ? 'Broadcasts preserved in stasis' : 'New frequency detected'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {needRefresh && (
                <button 
                  onClick={() => updateServiceWorker(true)}
                  className="px-4 py-2 bg-crimson text-cream font-ui text-[10px] font-black uppercase rounded shadow-brutal active:translate-y-1 transition-all"
                >
                  SYNC
                </button>
              )}
              <button 
                onClick={close}
                className="p-2 hover:bg-cream/10 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
