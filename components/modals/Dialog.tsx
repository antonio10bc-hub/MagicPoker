import { ReactNode, useEffect } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { useUiStore } from '@/store/useUiStore';
import { playSfx, playSound } from '@/lib/sounds';
import { IconButton, Panel, PxButton } from '@/components/pixel/ui';
import { ICONS } from '@/components/pixel/sprites';
import { useStage } from '@/components/pixel/Stage';
import { useTranslations } from '@/lib/i18n';
import { PixelSprite, Sprite } from '@/components/pixel/PixelSprite';
import { INK } from '@/theme/tokens';

// --- VENTANAS: UN SOLO SISTEMA ---
// Todas las ventanas comparten estructura: cabecera (banda con título y cerrar),
// cuerpo y, si hay acciones, un pie separado por una línea. Tres tamaños:
//  · sm: confirmaciones y elecciones cortas (pausa, salir, mejoras). Se ajusta al
//    contenido: nunca queda media ventana vacía.
//  · md: listas cortas con controles (ajustes). Al contenido, con tope y scroll.
//  · lg: contenido largo (reglas, estadísticas, colección, editor, catálogo). Alto
//    fijo, el cuerpo hace scroll.
// El tono cambia solo la banda: naranja (normal), carmesí (Castillo), azul (mercader).

export const closeWithClick = () => {
  playSound('click');
  useUiStore.getState().closeModal();
};

// --- CAPA DE FONDO ---
export const Overlay = ({ onClose, children }: { onClose?: () => void; children: ReactNode }) => (
  <motion.div
    className="absolute inset-0 z-[200] flex items-center justify-center"
    style={{ background: 'rgba(11,13,12,0.72)' }}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: 0.18 }}
    onClick={onClose}
  >
    <motion.div
      onClick={e => e.stopPropagation()}
      initial={{ scale: 0.9, y: 12, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={{ scale: 0.95, y: 6, opacity: 0, transition: { duration: 0.12 } }}
      transition={{ type: 'spring', stiffness: 480, damping: 30 }}
    >
      {children}
    </motion.div>
  </motion.div>
);

export type DialogSize = 'sm' | 'md' | 'lg';
const WIDTH: Record<DialogSize, number> = { sm: 210, md: 240, lg: 280 };

const BAND = { default: 'var(--c-chip)', castle: 'var(--ink-crimson)', merchant: 'var(--ink-azure)', amber: 'var(--ink-amber)' } as const;

interface DialogProps {
  title: string;
  size?: DialogSize;
  tone?: keyof typeof BAND;
  /** Botones pequeños junto a cerrar (p. ej. silenciar) */
  actions?: ReactNode;
  /** Acciones de la ventana: van al pie, separadas del contenido */
  footer?: ReactNode;
  /** Ancho a medida (por defecto, el del tamaño) */
  width?: number;
  /** Sin botón de cerrar ni cierre al tocar fuera (hay que elegir) */
  modal?: boolean;
  onClose?: () => void;
  children: ReactNode;
}

export const Dialog = ({ title, size = 'lg', tone = 'default', width, actions, footer, modal, onClose = closeWithClick, children }: DialogProps) => {
  const stage = useStage();
  const t = useTranslations();
  const portrait = stage.mode === 'portrait';
  const w = Math.min(width ?? WIDTH[size], stage.width - 16);
  const maxH = stage.height - (portrait ? 48 : 16);
  // Las grandes tienen alto fijo (en vertical aprovechan la pantalla); el resto, al contenido
  const height = size === 'lg' ? Math.min(portrait ? 420 : 270, maxH) : undefined;
  // En el ordenador, Esc cierra (igual que tocar fuera)
  useEffect(() => {
    if (modal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, onClose]);
  return (
    <Overlay onClose={modal ? undefined : onClose}>
      <Panel
        title={<span>{title}</span>}
        band={BAND[tone]}
        titleClassName={tone !== 'default' ? 'text-ink' : undefined}
        style={{ width: w, height, maxHeight: maxH }}
        bodyClassName="flex flex-col"
      >
        {!modal && (
          <div className="absolute flex gap-[3px] z-10" style={{ right: 2, top: -13 }}>
            {actions}
            <IconButton icon={ICONS.close} onClick={onClose} aria-label={t.aria_close} className="!w-[13px] !h-[11px]" />
          </div>
        )}
        <div className={clsx('flex-1 min-h-0 flex flex-col', size !== 'lg' && 'overflow-y-auto')}>{children}</div>
        {footer && (
          <div className="shrink-0 p-[6px] flex flex-col gap-[4px]" style={{ boxShadow: 'inset 0 1px 0 0 rgba(185,207,200,0.1)' }}>{footer}</div>
        )}
      </Panel>
    </Overlay>
  );
};

/** Cuerpo con scroll y el espaciado común */
export const DialogBody = ({ children, className, scroll = true }: { children: ReactNode; className?: string; scroll?: boolean }) => (
  <div className={clsx(scroll && 'px-scroll', 'flex-1 min-h-0 p-[6px] flex flex-col gap-[6px] leading-[11px]', className)}>{children}</div>
);

/** Bloque con título dentro de una ventana */
export const Section = ({ title, children, className }: { title: ReactNode; children: ReactNode; className?: string }) => (
  <div className={clsx('px-inset p-[5px]', className)}>
    <div className="t-section">{title}</div>
    {children}
  </div>
);

/** Pestañas (control segmentado): la activa en naranja, el resto en pizarra */
export const Tabs = <T extends string | number>({ value, options, onChange, className, icons }: {
  value: T; options: [T, string][]; onChange: (v: T) => void; className?: string;
  /** Iconos en vez de texto (cuando no caben: el Grimorio); el texto queda de etiqueta */
  icons?: Partial<Record<T, Sprite>>;
}) => (
  <div className={clsx('flex gap-[3px] shrink-0', className)}>
    {options.map(([v, label]) => (
      <PxButton key={String(v)} size="sm" tone={v === value ? 'roof' : 'white'} data-pressed={v === value} aria-label={`tab ${label}`} title={label}
        className="flex-1 min-w-0" onClick={() => { if (v !== value) { playSfx('select', 0.6); onChange(v); } }}>
        {icons?.[v] ? <PixelSprite sprite={icons[v]!} tint={v === value ? INK.black : INK.cream} />
          : <span className={clsx('truncate', v === value && 'text-outline')}>{label}</span>}
      </PxButton>
    ))}
  </div>
);

/** Fila de opción: etiqueta a la izquierda, control a la derecha */
export const OptionRow = ({ label, children }: { label: ReactNode; children: ReactNode }) => (
  <div className="flex items-center justify-between gap-[6px] min-h-[17px]">
    <span>{label}</span>
    <div className="flex items-center gap-[3px] shrink-0">{children}</div>
  </div>
);
