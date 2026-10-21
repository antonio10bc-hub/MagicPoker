import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { useUiStore } from '@/store/useUiStore';
import { useTranslations } from '@/lib/i18n';
import { haptic, playSfx } from '@/lib/sounds';
import { INK } from '@/theme/tokens';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { HEART } from '@/components/pixel/sprites';
import { useGameLayout, useStage } from '@/components/pixel/Stage';
import { BossFigure } from './BossFigure';

// --- FASE 2 DEL SOBERANO (Castillo) ---
// Pausada, para que se entienda qué pasa y por qué:
//  1. warn  · se ve el golpe: su barra baja a la mitad (con su "-N"), sus corazones
//             parpadean y sale "¡MITAD DE VIDA!" junto a su panel.
//  2. rise  · se para todo: destello rojo, "FASE 2", él se alza temblando y su aura
//             dorada y carmesí estalla y crece.
//  3. heal  · la pantalla se aclara para ver su barra: los corazones que le faltan
//             nacen en el centro y vuelan uno a uno a su barra, que sube con cada uno.
//  4. done  · "EL SOBERANO DESPIERTA" y su frase. Se cierra tocando.
// La lógica ya le ha curado; el panel enseña las vidas que va animando la escena.

type Step = 'warn' | 'rise' | 'heal' | 'done';
const WARN_MS = 2600;
const RISE_MS = 3600;
const HEART_EVERY_MS = 520;
const HEART_FLIGHT_S = 0.8;

interface Flight { i: number; from: { x: number; y: number }; to: { x: number; y: number } }

export const Phase2Scene = () => {
  const t = useTranslations();
  const { height, width } = useStage();
  const { rivalPanel } = useGameLayout();
  const fx = useGameStore(s => s.phase2Fx);
  const [closed, setClosed] = useState<number | null>(null);
  const [step, setStep] = useState<Step>('warn');
  const [flights, setFlights] = useState<Flight[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const open = fx !== null && closed !== fx.id;
  const figureH = Math.min(140, Math.round(height * 0.3));

  // Mientras se ve, los avisos (logros) esperan
  useEffect(() => {
    useUiStore.getState().setCinematic(open);
    return () => useUiStore.getState().setCinematic(false);
  }, [open]);

  useEffect(() => {
    if (!fx) return;
    const ui = useUiStore.getState();
    setStep('warn');
    setFlights([]);
    ui.setRivalLivesShown(fx.from);
    const missing = fx.to - fx.from;
    const timers: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => { playSfx('hurt', 0.8, 0.7); }, 700),
      setTimeout(() => { setStep('rise'); playSfx('crush', 1, 0.5); haptic('lifeLost'); }, WARN_MS),
      setTimeout(() => { playSfx('zap', 0.9, 0.45); haptic('stamp'); }, WARN_MS + 1500),
      setTimeout(() => {
        setStep('heal');
        // Dónde van: los huecos de corazón de su panel (en coordenadas del escenario)
        const box = root.current?.getBoundingClientRect();
        const hearts = document.querySelector('[data-lives="opponent"]')?.children;
        const k = box ? box.width / width : 1;
        const spot = (i: number) => {
          const el = hearts?.[i] as HTMLElement | undefined;
          const r = el?.getBoundingClientRect();
          return r && box ? { x: (r.left + r.width / 2 - box.left) / k, y: (r.top + r.height / 2 - box.top) / k }
            : { x: rivalPanel.x + 40 + i * 10, y: rivalPanel.y + rivalPanel.h / 2 };
        };
        const center = { x: width / 2, y: height * 0.45 };
        setFlights(Array.from({ length: missing }, (_, n) => ({ i: fx.from + n, from: center, to: spot(fx.from + n) })));
      }, WARN_MS + RISE_MS),
      // Cada corazón que llega sube la barra
      ...Array.from({ length: missing }, (_, n) => setTimeout(() => {
        useUiStore.getState().setRivalLivesShown(fx.from + n + 1);
        playSfx('sparkle', 0.6, 0.9 + n * 0.12);
        haptic('stamp');
      }, WARN_MS + RISE_MS + n * HEART_EVERY_MS + HEART_FLIGHT_S * 1000)),
      setTimeout(() => setStep('done'), WARN_MS + RISE_MS + missing * HEART_EVERY_MS + HEART_FLIGHT_S * 1000 + 300),
    ];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx]);

  const close = () => {
    if (step !== 'done' || !fx) return;
    setClosed(fx.id);
    useUiStore.getState().setRivalLivesShown(null);
  };

  const dark = step === 'rise';
  return (
    <div ref={root} className="absolute inset-0 pointer-events-none z-[160]">
      <AnimatePresence>
        {open && fx && (
          <motion.button key={fx.id} aria-label="phase 2" className="absolute inset-0 pointer-events-auto cursor-pointer" onClick={close}
            exit={{ opacity: 0, transition: { duration: 0.8 } }}>
            {/* 1. Aviso junto a su panel: su barra a la mitad, parpadeando */}
            <AnimatePresence>
              {step === 'warn' && (
                <motion.div key="warn" className="absolute flex flex-col items-start gap-[2px]" exit={{ opacity: 0, transition: { duration: 0.4 } }}
                  style={{ left: rivalPanel.x, top: rivalPanel.y, width: rivalPanel.w, height: rivalPanel.h }}>
                  <motion.div className="absolute inset-0 rounded-[3px]" style={{ boxShadow: '0 0 0 2px var(--ink-crimson), 0 0 14px 4px rgba(255,31,75,0.6)' }}
                    animate={{ opacity: [0, 1, 0.3, 1, 0.3, 1] }} transition={{ duration: 2, delay: 0.4 }} />
                  <motion.span className="absolute font-display glow-crimson whitespace-nowrap px-[6px] py-[2px] rounded-[3px]"
                    style={{ left: 4, top: rivalPanel.h + 26, color: 'var(--ink-crimson)', fontSize: 12, letterSpacing: 1, background: 'rgba(11,13,12,0.92)', boxShadow: '0 0 0 1px var(--ink-crimson)' }}
                    initial={{ opacity: 0, y: -4, scale: 1.4 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.6, type: 'spring', stiffness: 380, damping: 14 }}>
                    {t.phase2_half}
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Fondo: en el aviso apenas oscurece; al alzarse, rojo oscuro; al curarse se aclara para ver su barra */}
            <motion.div className="absolute inset-0 -z-10"
              animate={{ opacity: step === 'warn' ? 0.2 : dark ? 1 : 0.35 }} transition={{ duration: step === 'rise' ? 0.6 : 1 }}
              style={{ background: 'radial-gradient(ellipse 65% 50% at 50% 45%, rgba(80,8,24,0.92) 0%, rgba(11,13,12,0.97) 72%)' }} />

            {step !== 'warn' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-[6px]">
                {/* Destello rojo al pararse todo */}
                <motion.div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--ink-crimson)' }}
                  initial={{ opacity: 0.7 }} animate={{ opacity: [0.7, 0, 0.45, 0] }} transition={{ duration: 1.8, times: [0, 0.3, 0.75, 1] }} />
                <motion.span className="relative z-10 mb-[10px] font-display glow-crimson" style={{ color: 'var(--ink-crimson)', fontSize: 12, letterSpacing: 3 }}
                  initial={{ opacity: 0, scale: 2 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 14 }}>
                  {t.phase2_tag}
                </motion.span>
                {/* Se alza temblando y su aura crece */}
                <motion.div style={{ transformOrigin: '50% 100%' }}
                  initial={{ y: 30, scale: 0.8, filter: 'brightness(0.4)' }}
                  animate={{ y: [30, 30, 0], scale: [0.8, 0.8, 1.08, 1], x: [0, -3, 3, -3, 3, 0, 0], filter: ['brightness(0.4)', 'brightness(0.6)', 'brightness(2.6)', 'brightness(1)'] }}
                  transition={{ duration: 2.4, times: [0, 0.35, 0.7, 1] }}>
                  <motion.div initial={{ scale: 0.6 }} animate={{ scale: [0.6, 0.6, 1.25, 1.1] }} transition={{ duration: 2.7, times: [0, 0.5, 0.8, 1] }}>
                    <BossFigure id="sovereign" height={figureH} evolved />
                  </motion.div>
                </motion.div>
                {/* Onda de oro al despertar */}
                <motion.div className="absolute rounded-full pointer-events-none" style={{ width: figureH, height: figureH, top: '45%', left: '50%', marginLeft: -figureH / 2, marginTop: -figureH / 2,
                  boxShadow: '0 0 0 3px rgba(232,182,74,0.95), 0 0 16px 4px rgba(255,31,75,0.6)' }}
                  initial={{ opacity: 0, scale: 0.2 }} animate={{ opacity: [0, 1, 0], scale: [0.2, 1.6, 2.6] }} transition={{ delay: 1.5, duration: 1.6, ease: 'easeOut' }} />
                <AnimatePresence>
                  {step === 'done' && (
                    <motion.div key="done" className="relative z-10 flex flex-col items-center gap-[6px]" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
                      <span className="text-title glow-crimson text-center" style={{ fontSize: 16, color: 'var(--ink-cream)', maxWidth: width - 24 }}>{t.phase2_title}</span>
                      <span className="px-[8px] py-[4px] rounded-[4px] text-center leading-[11px]"
                        style={{ background: 'var(--ink-cream)', color: 'var(--ink-black)', maxWidth: Math.min(220, width - 24) }}>
                        {t.phase2_line}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* 3. Los corazones que le faltan nacen en el centro y vuelan a su barra */}
            {flights.map((f, n) => (
              <motion.span key={f.i} className="absolute pointer-events-none" style={{ left: 0, top: 0 }}
                initial={{ x: f.from.x - 4, y: f.from.y - 4, scale: 0, opacity: 0 }}
                animate={{ x: [f.from.x - 4, f.from.x - 4, (f.from.x + f.to.x) / 2, f.to.x - 4], y: [f.from.y - 4, f.from.y - 14, Math.min(f.from.y, f.to.y) - 30, f.to.y - 4],
                  scale: [0, 2.6, 2, 1], opacity: [0, 1, 1, 0] }}
                transition={{ delay: (n * HEART_EVERY_MS) / 1000, duration: HEART_FLIGHT_S, times: [0, 0.25, 0.6, 1], ease: 'easeInOut' }}>
                <PixelSprite sprite={HEART} tint={INK.orange} className="bloom-shape" />
              </motion.span>
            ))}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
