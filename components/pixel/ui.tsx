import { ButtonHTMLAttributes, CSSProperties, ReactNode, useEffect, useState } from 'react';
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

interface PxButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
}

export const PxButton = ({ tone = 'white', className, children, ...rest }: PxButtonProps) => (
  <button className={clsx('px-btn px-round uppercase', tone !== 'white' && `px-btn-${tone}`, className)} {...rest}>
    {children}
  </button>
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

const TypedText = ({ text, showCursor }: { text: string; showCursor: boolean }) => {
  const { shown, done } = useTypewriter(text);
  return (
    <>
      <span>{shown}</span>
      {showCursor && done && (
        <span className="absolute right-[4px] bottom-[3px] anim-blink"><PixelSprite sprite={ICONS.cursor} /></span>
      )}
    </>
  );
};

interface TextBoxProps {
  text: string;
  showCursor?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const TextBox = ({ text, showCursor = true, className, style }: TextBoxProps) => (
  <div className={clsx('px-panel px-round relative px-[5px] pt-[5px] pb-[8px] leading-[12px]', className)} style={style}>
    <TypedText key={text} text={text} showCursor={showCursor} />
  </div>
);
