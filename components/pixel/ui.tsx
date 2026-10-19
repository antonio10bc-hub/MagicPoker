import { CSSProperties, ReactNode, useEffect, useState } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { playSfx } from '@/lib/sounds';
import { clsx } from 'clsx';
import { PixelSprite, Sprite } from './PixelSprite';
import { ICONS } from './sprites';

// --- PANEL TIPO MENÚ DS ---
interface PanelProps {
  title?: ReactNode;
  /** Color de la banda de cabecera (variable CSS) */
  band?: string;
  dark?: boolean;
  className?: string;
  bodyClassName?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export const Panel = ({ title, band = 'var(--c-glass)', dark, className, bodyClassName, style, children }: PanelProps) => (
  <div className={clsx(dark ? 'px-panel-dark' : 'px-panel', 'px-round relative flex flex-col', className)} style={style}>
    {title !== undefined && (
      <div className="px-band text-outline shrink-0 m-[1px] mb-0 whitespace-nowrap" style={{ background: band }}>{title}</div>
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
    <PixelSprite sprite={icon} />
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
        <span className="absolute right-[4px] bottom-[3px] anim-blink"><PixelSprite sprite={ICONS.cursor} /></span>
      )}
    </>
  );
};

interface TextBoxProps {
  text: string;
  /** Contenido extra que aparece al terminar de escribir (p. ej. puntos animados) */
  suffix?: ReactNode;
  showCursor?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const TextBox = ({ text, suffix, showCursor = true, className, style }: TextBoxProps) => (
  <div className={clsx('px-panel px-round relative px-[5px] pt-[5px] pb-[8px] leading-[12px]', className)} style={style}>
    <TypedText key={text} text={text} showCursor={showCursor && !suffix} suffix={suffix} />
  </div>
);

// --- TEXTO ONDULANTE: cada letra flota con un pequeño desfase (títulos y carteles) ---
export const WavyText = ({ text, amplitude = 2, className, style }: { text: string; amplitude?: number; className?: string; style?: CSSProperties }) => (
  <span className={clsx('inline-flex', className)} style={style}>
    {text.split('').map((ch, i) => (
      <motion.span
        key={i}
        style={{ display: 'inline-block', whiteSpace: 'pre' }}
        animate={{ y: [0, -amplitude, 0, amplitude * 0.5, 0], rotate: [0, -3, 0, 3, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.08 }}
      >
        {ch}
      </motion.span>
    ))}
  </span>
);
