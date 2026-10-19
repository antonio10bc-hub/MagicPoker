import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

interface OverlayProps {
  onClose?: () => void;
  className?: string;
  children: ReactNode;
}

/** Fondo oscuro a pantalla completa para modales */
export const Overlay = ({ onClose, className = 'z-[100]', children }: OverlayProps) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className={clsx("fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4", className)}
    onClick={onClose}
  >
    {children}
  </motion.div>
);

interface DialogProps {
  title: ReactNode;
  onClose: () => void;
  /** Botones extra a la izquierda del de cerrar */
  actions?: ReactNode;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  closeIconClassName?: string;
  children: ReactNode;
}

/** Ventana con cabecera amarilla y botón de cerrar. Cerrar al pulsar fuera. */
export const Dialog = ({
  title, onClose, actions, className, headerClassName = 'p-4', titleClassName, closeIconClassName = 'w-6 h-6', children,
}: DialogProps) => (
  <Overlay onClose={onClose}>
    <motion.div
      initial={{ scale: 0.8, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 50 }}
      onClick={e => e.stopPropagation()}
      className={clsx("bg-white w-full overflow-y-auto rounded-lg border-[6px] border-black shadow-[12px_12px_0_#000] relative flex flex-col", className)}
    >
      <div className={clsx("flex justify-between items-center border-b-[4px] border-black bg-yellow-300 sticky top-0 z-10", headerClassName)}>
        <h2 className={clsx("font-black uppercase tracking-wider", titleClassName)}>{title}</h2>
        <div className="flex gap-3">
          {actions}
          <button onClick={onClose} className="bg-white hover:bg-red-100 p-2 rounded-md border-[3px] border-black shadow-[3px_3px_0_#000] active:translate-y-1 active:shadow-none transition-all">
            <X className={clsx(closeIconClassName, "stroke-[3px]")} />
          </button>
        </div>
      </div>
      {children}
    </motion.div>
  </Overlay>
);
