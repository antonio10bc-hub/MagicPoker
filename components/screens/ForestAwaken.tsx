import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from '@/lib/i18n';
import { useUiStore } from '@/store/useUiStore';
import { haptic, playSfx } from '@/lib/sounds';

// --- EL BOSQUE DESPIERTA (al conquistar el Castillo por primera vez) ---
// Por fases y con el input bloqueado: se apaga todo, en la oscuridad se abren unos ojos
// ámbar que parpadean, aparece "EL BOSQUE DESPIERTA" y, al irse, el botón del Bosque
// entra en el menú. Lo ya contado se anota para no repetirlo.

const KEY = 'magic_poker_forest_seen';
const DONE_MS = 5600;

export const forestAnnounced = () => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return true; }
};
const markAnnounced = () => {
  try { localStorage.setItem(KEY, '1'); } catch { /* sin almacenamiento */ }
};

export const ForestAwaken = ({ onDone, replay }: { onDone: () => void; replay?: boolean }) => {
  const t = useTranslations();
  const [step, setStep] = useState<'dark' | 'eyes' | 'title' | 'out'>('dark');
  useEffect(() => {
    useUiStore.getState().setCinematic(true);
    const timers = [
      setTimeout(() => { setStep('eyes'); playSfx('heartbeat', 0.9); }, 900),
      setTimeout(() => { setStep('title'); playSfx('reveal', 0.8, 0.6); haptic('stamp'); }, 2400),
      setTimeout(() => setStep('out'), 4600),
      setTimeout(() => { if (!replay) markAnnounced(); useUiStore.getState().setCinematic(false); onDone(); }, DONE_MS),
    ];
    return () => { timers.forEach(clearTimeout); useUiStore.getState().setCinematic(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const eye = { width: 4, height: 2, background: 'var(--ink-amber)', boxShadow: '0 0 4px rgba(255,194,51,0.95), 0 0 12px 2px rgba(255,194,51,0.5)' };
  return (
    <motion.div aria-label="forest awaken" className="absolute inset-0 z-[450] flex flex-col items-center justify-center gap-[14px]"
      style={{ background: 'rgba(11,13,12,0.94)' }}
      initial={{ opacity: 0 }} animate={{ opacity: step === 'out' ? 0 : 1 }} transition={{ duration: step === 'out' ? 1 : 0.8 }}>
      <AnimatePresence>
        {step !== 'dark' && (
          <motion.div key="eyes" className="flex gap-[7px]"
            initial={{ opacity: 0, scaleY: 0.1 }} animate={{ opacity: 1, scaleY: [0.1, 1, 1, 0.1, 1] }}
            transition={{ duration: 1.6, times: [0, 0.2, 0.7, 0.8, 1] }}>
            <span style={eye} /><span style={eye} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {(step === 'title' || step === 'out') && (
          <motion.div key="title" className="flex flex-col items-center gap-[4px] px-[16px]"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <span className="font-display glow-amber text-center" style={{ color: 'var(--ink-amber)', fontSize: 17, letterSpacing: 2 }}>{t.forest_unlock_title}</span>
            <span className="t-micro text-center" style={{ color: 'var(--ink-mint)' }}>{t.forest_unlock_sub}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
