import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from '@/lib/i18n';
import { useUiStore } from '@/store/useUiStore';
import { ForestState, REALM_MARKS } from '@/lib/forest';
import { playSfx } from '@/lib/sounds';
import { useLowPower } from '@/lib/quality';
import { useStage } from '@/components/pixel/Stage';
import { ForestLayer, trunksFor } from './ForestScreen';
import { ForestLife } from './ForestLife';
import { Wisp, WispBubble, WispSmoke } from './SagaMap';

// --- VUELVE EL ENTE (al llegar a la última marca del Bosque) ---
// La primera vez que vuelves al menú con la marca de los renegados, la pantalla se funde
// con el bosque de noche. En el sendero, un humillo de brasa; de él sale el ente del
// prólogo, se queda mirándote y dice, despacio: "…", "…", "Qué lejos has llegado…", "…".
// Luego se desvanece y el bosque con él. Input bloqueado; se anota para no repetirlo.

const KEY = 'magic_poker_ente_return';
export const enteReturned = () => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return true; }
};
const markReturned = () => {
  try { localStorage.setItem(KEY, '1'); } catch { /* sin almacenamiento */ }
};
/** ¿Toca la visita? (con la marca de los renegados y sin haberla visto) */
export const enteReturnDue = (f: ForestState) => (f.bestMarks ?? 0) >= REALM_MARKS.renegade && !enteReturned();

type Step = 'dark' | 'smoke' | 'appear' | 'speak' | 'leave' | 'out';
const LINES = ['ente_far_1', 'ente_far_2', 'ente_far_3', 'ente_far_4'] as const;
/** Los puntos suspensivos salen muy despacio (es un silencio); la frase, a ritmo de voz */
const msPerChar = (text: string) => (/^[.…]+$/.test(text) ? 420 : 75);
/** Lo que se queda cada bocadillo ya escrito */
const HOLD_MS = 1300;

export const EnteReturn = ({ onDone, replay }: { onDone: () => void; replay?: boolean }) => {
  const t = useTranslations();
  const { width: W, height: H, mode } = useStage();
  const lowPower = useLowPower();
  const horizon = Math.round(H * (mode === 'portrait' ? 0.46 : 0.5));
  const layers = useMemo(() => {
    const trunks = trunksFor(W);
    return [trunks.filter(tr => tr.d < 0.35), trunks.filter(tr => tr.d >= 0.35 && tr.d < 0.8), trunks.filter(tr => tr.d >= 0.8)];
  }, [W]);
  const [step, setStep] = useState<Step>('dark');
  const [line, setLine] = useState(0);

  useEffect(() => {
    useUiStore.getState().setCinematic(true);
    const timers = [
      setTimeout(() => { setStep('smoke'); playSfx('heartbeat', 0.7); }, 1200),
      setTimeout(() => { setStep('appear'); playSfx('reveal', 0.6, 0.6); playSfx('whoosh', 0.4, 0.6); }, 3200),
      setTimeout(() => setStep('speak'), 5600),
    ];
    return () => { timers.forEach(clearTimeout); useUiStore.getState().setCinematic(false); };
  }, []);

  // Al terminar cada bocadillo: el siguiente, o se va
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };
  const spoken = () => {
    later(HOLD_MS, () => {
      if (line + 1 < LINES.length) { setLine(line + 1); playSfx('pop', 0.35, 0.6); return; }
      setStep('leave');
      playSfx('whoosh', 0.5, 0.8);
      later(1800, () => setStep('out'));
      later(3200, () => {
        if (!replay) markReturned();
        useUiStore.getState().setCinematic(false);
        onDone();
      });
    });
  };
  const text = t[LINES[line]];
  // Donde espera: en el sendero, a media distancia
  const at = { x: W / 2, y: horizon + Math.round(H * 0.16) };

  return (
    <motion.div aria-label="ente return" className="absolute inset-0 z-[450] overflow-hidden" style={{ background: 'var(--ink-black)' }}
      initial={{ opacity: 0 }} animate={{ opacity: step === 'out' ? 0 : 1 }} transition={{ duration: step === 'out' ? 1.3 : 1.2 }}>
      <ForestLayer W={W} H={H} horizon={horizon} trunks={layers[0]} kind="far" sway={0} zoom={1} />
      <ForestLife W={W} H={H} horizon={horizon} layer="back" busy />
      <ForestLayer W={W} H={H} horizon={horizon} trunks={layers[1]} kind="mid" sway={lowPower ? 0 : 1} zoom={1} />
      {/* Un claro de luz pálida donde va a estar */}
      <motion.div className="absolute pointer-events-none" style={{ left: at.x - 90, top: at.y - 70, width: 180, height: 110, borderRadius: '50%',
        background: 'radial-gradient(ellipse 50% 50% at 50% 60%, rgba(185,207,200,0.22) 0%, rgba(185,207,200,0.08) 45%, transparent 72%)' }}
        initial={{ opacity: 0 }} animate={{ opacity: step === 'dark' || step === 'smoke' ? 0.4 : step === 'leave' || step === 'out' ? 0 : 1 }} transition={{ duration: 1.6 }} />
      <div className="absolute" style={{ left: at.x, top: at.y, width: 0, height: 0 }}>
        {/* El ente, algo más grande que en el mapa (está cerca) */}
        <div className="absolute" style={{ left: 0, top: 0, transform: 'scale(1.6)', transformOrigin: '0 0' }}>
          {(step === 'smoke' || step === 'appear') && <WispSmoke parting={step === 'appear'} still={lowPower} />}
          {(step === 'appear' || step === 'speak' || step === 'leave' || step === 'out') && <Wisp leaving={step === 'leave' || step === 'out'} />}
        </div>
      </div>
      <ForestLife W={W} H={H} horizon={horizon} layer="front" busy />
      <ForestLayer W={W} H={H} horizon={horizon} trunks={layers[2]} kind="near" sway={lowPower ? 0 : 2} zoom={1} />
      {/* Viñeta: los bordes, más oscuros */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 75% 70% at 50% 55%, transparent 40%, rgba(11,13,12,0.85) 100%)' }} />
      {/* El bocadillo, por encima de todo (los troncos cercanos no lo tapan) */}
      <div className="absolute" style={{ left: at.x, top: at.y - 30, width: 0, height: 0 }}>
        <AnimatePresence>
          {step === 'speak' && <WispBubble key={line} text={text} onDone={spoken} msPerChar={msPerChar(text)} fit />}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
