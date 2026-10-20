import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { useUiStore } from '@/store/useUiStore';
import { playSound } from '@/lib/sounds';
import { IconButton, Panel } from '@/components/pixel/ui';
import { ICONS } from '@/components/pixel/sprites';
import { useStage } from '@/components/pixel/Stage';

// --- PIEZAS COMUNES DE LOS MODALES ---

export const closeWithClick = () => {
  playSound('click');
  useUiStore.getState().closeModal();
};

// --- CAPA DE FONDO + VENTANA ---
export const Overlay = ({ onClose, children }: { onClose?: () => void; children: ReactNode }) => (
  <motion.div
    className="absolute inset-0 z-[200] flex items-center justify-center"
    style={{ background: 'rgba(11,13,12,0.7)' }}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
    onClick={onClose}
  >
    <motion.div
      onClick={e => e.stopPropagation()}
      initial={{ scale: 0.6, y: 30, rotateX: 40, opacity: 0 }}
      animate={{ scale: 1, y: 0, rotateX: 0, opacity: 1 }}
      exit={{ scale: 0.8, y: 20, opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      style={{ transformPerspective: 500 }}
    >
      {children}
    </motion.div>
  </motion.div>
);

/** Ventana con cabecera. En móvil vertical se ensancha y alarga para aprovechar la pantalla. */
export const Dialog = ({ title, width, height, actions, children }: { title: string; width: number; height: number; actions?: ReactNode; children: ReactNode }) => {
  const stage = useStage();
  const w = Math.min(width, stage.width - 12);
  const h = stage.mode === 'portrait' ? Math.min(stage.height - 40, Math.max(height, 360)) : Math.min(height, stage.height - 16);
  return (
    <Overlay onClose={closeWithClick}>
      <Panel
        title={
          <div className="flex items-center justify-between">
            <span>{title}</span>
          </div>
        }
        band="var(--c-chip)"
        style={{ width: w, height: h }}
        bodyClassName="flex flex-col"
      >
        <div className="absolute flex gap-[3px] z-10" style={{ right: 3, top: -14 }}>
          {actions}
          <IconButton icon={ICONS.close} onClick={closeWithClick} aria-label="close" className="!w-[13px] !h-[12px]" />
        </div>
        {children}
      </Panel>
    </Overlay>
  );
};

/** Bloque con título dentro de un modal */
export const Section = ({ title, children, className }: { title: string; children: ReactNode; className?: string }) => (
  <div className={clsx('px-inset p-[5px]', className)}>
    <div className="mb-[4px] pb-[2px] uppercase" style={{ color: 'var(--c-ui-muted)', boxShadow: '0 1px 0 0 var(--c-ui-panel-light)' }}>{title}</div>
    {children}
  </div>
);
