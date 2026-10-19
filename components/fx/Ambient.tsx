import { CSSProperties, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useStage } from '@/components/pixel/Stage';
import { playSfx } from '@/lib/sounds';

// --- AMBIENTE ---

/** Motas de polvo que suben despacio: el escenario nunca está quieto del todo */
const MOTES = Array.from({ length: 14 }, (_, i) => ({
  fx: ((i * 53) % 100) / 100,
  fy: 0.35 + ((i * 29) % 60) / 100,
  delay: -((i * 37) % 70) / 10,
  duration: 6 + ((i * 17) % 50) / 10,
  drift: ((i * 13) % 30) - 15,
  size: i % 4 === 0 ? 2 : 1,
}));

export const AmbientDust = () => {
  const { width, height } = useStage();
  return (
    <div className="absolute inset-0 pointer-events-none z-[5] overflow-hidden">
      {MOTES.map((m, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: Math.round(m.fx * width), top: Math.round(m.fy * height), width: m.size, height: m.size,
            background: 'rgba(244, 244, 240, 0.8)',
            animation: `dust-rise ${m.duration}s linear ${m.delay}s infinite`,
            '--drift': `${m.drift}px`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
};

/** Bordes rojos que laten y latido de corazón cuando te queda una vida */
export const LowHealth = ({ active }: { active: boolean }) => {
  useEffect(() => {
    if (!active) return;
    const beat = () => playSfx('heartbeat', 0.8);
    beat();
    const id = setInterval(beat, 1100);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none z-[70]"
      style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(192, 40, 28, 0.55) 100%)' }}
      animate={{ opacity: [0.35, 0.85, 0.4, 0.7, 0.35] }}
      transition={{ duration: 1.1, repeat: Infinity, times: [0, 0.12, 0.25, 0.37, 1] }}
    />
  );
};
