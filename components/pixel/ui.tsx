import { CSSProperties, ReactNode, useEffect, useState } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { playSfx } from '@/lib/sounds';
import { clsx } from 'clsx';
import { PixelSprite, Sprite } from './PixelSprite';
import { ICONS } from './sprites';
import { INK } from '@/theme/tokens';

// --- PANEL TIPO MENÚ DS ---
interface PanelProps {
  title?: ReactNode;
  /** Color de la banda de cabecera (variable CSS) */
  band?: string;
  dark?: boolean;
  /** Clase del texto de la banda (por defecto, tinta crema) */
  titleClassName?: string;
  className?: string;
  bodyClassName?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/** Bandas de acento (naranjas): texto en silueta oscura y brillo */
const HOT_BAND = /orange|mult|gold|ember|roof|red|yellow|chip/;

export const Panel = ({ title, band = 'var(--ink-slate)', dark, titleClassName, className, bodyClassName, style, children }: PanelProps) => (
  <div className={clsx(dark ? 'px-panel-dark' : 'px-panel', 'px-round flex flex-col', !/\babsolute\b/.test(className ?? '') && 'relative', className)} style={style}>
    {title !== undefined && (
      <div className={clsx('px-band shrink-0 whitespace-nowrap', titleClassName ?? (HOT_BAND.test(band) ? 'text-ink' : 'text-outline'))}
        style={{ background: band, boxShadow: HOT_BAND.test(band) ? '0 -2px 6px rgba(255,74,28,0.35)' : undefined }}>{title}</div>
    )}
    <div className={clsx('relative flex-1 min-h-0', bodyClassName)}>{children}</div>
  </div>
);

// --- BOTONES ---
type Tone = 'white' | 'yellow' | 'green' | 'red' | 'blue' | 'roof';

interface PxButtonProps extends HTMLMotionProps<'button'> {
  tone?: Tone;
}

/** Botón con muelle: crece al pasar por encima, se hunde y aplasta al pulsar */
export const PxButton = ({ tone = 'white', className, children, onPointerEnter, ...rest }: PxButtonProps) => (
  <motion.button
    className={clsx('px-btn px-round uppercase', tone !== 'white' && `px-btn-${tone}`, className)}
    whileHover={{ scale: 1.06, y: -1 }}
    whileTap={{ scale: 0.9, y: 2 }}
    transition={{ type: 'spring', stiffness: 600, damping: 18 }}
    onPointerEnter={e => { playSfx('hover'); onPointerEnter?.(e); }}
    {...rest}
  >
    {children}
  </motion.button>
);

export const IconButton = ({ icon, className, ...rest }: PxButtonProps & { icon: Sprite }) => (
  <PxButton className={clsx('w-[18px] h-[18px]', className)} {...rest}>
    <PixelSprite sprite={icon} tint={INK.cream} />
  </PxButton>
);

// --- CUADRO DE TEXTO: aparición letra a letra + ▼ parpadeante ---
const TYPE_MS = 28;

/** Escribe el texto letra a letra. Montarlo con key={text} para reiniciar. */
const useTypewriter = (text: string) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setCount(c => (c >= text.length ? c : c + 1)), TYPE_MS);
    return () => clearInterval(timer);
  }, [text]);
  return { shown: text.slice(0, count), done: count >= text.length };
};

const TypedText = ({ text, showCursor, suffix }: { text: string; showCursor: boolean; suffix?: ReactNode }) => {
  const { shown, done } = useTypewriter(text);
  return (
    <>
      <span>{shown}</span>
      {done && suffix}
      {showCursor && done && (
        <span className="absolute right-[4px] bottom-[3px] anim-blink"><PixelSprite sprite={ICONS.cursor} tint={INK.ember} /></span>
      )}
    </>
  );
};

interface TextBoxProps {
  text: string;
  /** Una sola línea baja (móvil) */
  compact?: boolean;
  /** Contenido extra que aparece al terminar de escribir (p. ej. puntos animados) */
  suffix?: ReactNode;
  showCursor?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const TextBox = ({ text, suffix, compact, showCursor = true, className, style }: TextBoxProps) => (
  <div className={clsx('px-panel px-round relative leading-[12px] whitespace-nowrap overflow-hidden', compact ? 'px-[5px] pt-[3px] pb-[1px]' : 'px-[5px] pt-[5px] pb-[8px]', className)} style={style}>
    <TypedText key={text} text={text} showCursor={showCursor && !suffix && !compact} suffix={suffix} />
  </div>
);

// --- TEXTO ONDULANTE: cada letra flota con un pequeño desfase (títulos y carteles) ---
export const WavyText = ({ text, className, style }: { text: string; className?: string; style?: CSSProperties }) => (
  <span className={clsx('inline-flex', className)} style={style}>
    {text.split('').map((ch, i) => (
      // Bucle en CSS (compositor), con un pequeño desfase por letra
      <span key={i} className="anim-wave" style={{ animationDelay: `${i * 0.08}s` }}>
        {ch}
      </span>
    ))}
  </span>
);
