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

/**
 * Número/texto que salta: etiqueta de color que rebota, gira un poco y tiembla,
 * sube y se desvanece (estilo marcador de mesa de cartas).
 */
const FloatingText = ({ e }: { e: Extract<Effect, { kind: 'text' }> }) => {
  const tilt = ((e.id * 37) % 17) - 8;
  return (
    <motion.div
      className="absolute pointer-events-none whitespace-nowrap"
      style={{ left: e.x, top: e.y, translateX: '-50%', translateY: '-50%' }}
      initial={{ y: 6, scale: 0.2, rotate: tilt * 2, opacity: 0 }}
      animate={{ y: [6, -8, -10, -26], scale: [0.2, 1.5, 1, 0.9], rotate: [tilt * 2, -tilt, tilt * 0.5, 0], opacity: [0, 1, 1, 0] }}
      transition={{ duration: e.life / 1000, times: [0, 0.2, 0.6, 1], ease: 'easeOut' }}
    >
      <motion.div
        className={e.bg ? 'text-outline px-[4px] pt-[2px] pb-[1px]' : 'text-outline'}
        style={{
          color: e.bg ? 'var(--c-white)' : e.color, fontSize: e.size, lineHeight: `${e.size}px`,
          background: e.bg, borderRadius: 4,
          boxShadow: e.bg ? '0 2px 0 0 rgba(0,0,0,0.45), inset 0 1px 0 0 rgba(255,255,255,0.3)' : undefined,
        }}
        animate={{ x: [0, -1, 1, -1, 0] }}
        transition={{ duration: 0.25, repeat: 2 }}
      >
        {e.text}
      </motion.div>
    </motion.div>
  );
};

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
