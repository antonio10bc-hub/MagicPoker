import { memo } from 'react';
import { motion } from 'framer-motion';
import { Effect, FxLayer as Layer, useFxStore } from './fxStore';

// --- RENDER DE EFECTOS ---
// Partículas con física sencilla (impulso + gravedad), textos que suben y se
// desvanecen, y ondas de choque. Movimiento suave; los píxeles siguen siendo cuadrados.

const Particles = ({ e }: { e: Extract<Effect, { kind: 'particles' }> }) => (
  <>
    {e.particles.map((p, i) => (
      <motion.div
        key={i}
        className="absolute pointer-events-none"
        style={{ left: e.x, top: e.y, width: p.size, height: p.size, background: p.color, boxShadow: '0 0 0 0.5px var(--c-outline)' }}
        initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
        animate={{
          x: [0, p.dx * 0.6, p.dx],
          y: [0, p.dy * 0.6 + e.gravity * 0.1, p.dy + e.gravity * 0.5],
          rotate: p.rot,
          opacity: [1, 1, 0],
          scale: [1, 1, 0.4],
        }}
        transition={{ duration: e.life / 1000, delay: p.delay, ease: 'easeOut', times: [0, 0.5, 1] }}
      />
    ))}
  </>
);

const FloatingText = ({ e }: { e: Extract<Effect, { kind: 'text' }> }) => (
  <motion.div
    className="absolute pointer-events-none text-outline whitespace-nowrap"
    style={{ left: e.x, top: e.y, color: e.color, fontSize: e.size, lineHeight: `${e.size}px`, translateX: '-50%', translateY: '-50%' }}
    initial={{ y: 4, scale: 0.3, opacity: 0 }}
    animate={{ y: [4, -10, -22], scale: [0.3, 1.35, 1], opacity: [0, 1, 0] }}
    transition={{ duration: e.life / 1000, times: [0, 0.25, 1], ease: 'easeOut' }}
  >
    {e.text}
  </motion.div>
);

const Ring = ({ e }: { e: Extract<Effect, { kind: 'ring' }> }) => (
  <motion.div
    className="absolute pointer-events-none rounded-full"
    style={{ left: e.x - e.radius, top: e.y - e.radius, width: e.radius * 2, height: e.radius * 2, boxShadow: `0 0 0 2px ${e.color}, inset 0 0 0 1px ${e.color}` }}
    initial={{ scale: 0.1, opacity: 1 }}
    animate={{ scale: 1, opacity: 0 }}
    transition={{ duration: e.life / 1000, ease: [0.1, 0.8, 0.3, 1] }}
  />
);

const EffectView = memo(({ e }: { e: Effect }) =>
  e.kind === 'particles' ? <Particles e={e} /> : e.kind === 'text' ? <FloatingText e={e} /> : <Ring e={e} />
);
EffectView.displayName = 'EffectView';

export const FxLayer = ({ layer }: { layer: Layer }) => {
  const effects = useFxStore(s => s.effects);
  return (
    <div className="absolute inset-0 pointer-events-none z-[60]">
      {effects.filter(e => e.layer === layer).map(e => <EffectView key={e.id} e={e} />)}
    </div>
  );
};
