import { create } from 'zustand';
import { StampId } from '@/lib/stamps';
import type { Unlock } from '@/lib/bosses';

// Estado de interfaz que no forma parte de la partida (qué modal está abierto, sellos
// recién ganados pendientes de mostrar)
export type ModalName = 'rules' | 'stats' | 'exit' | 'settings' | 'collection';

interface UiState {
  modal: ModalName | null;
  openModal: (modal: ModalName) => void;
  closeModal: () => void;
  stampQueue: StampId[];
  pushStamp: (id: StampId) => void;
  shiftStamp: () => void;
  /** Desbloqueos de boss pendientes de celebrar (colección, sello nuevo) */
  unlockQueue: Unlock[];
  pushUnlock: (u: Unlock) => void;
  shiftUnlock: () => void;
  /** Boss que se ve en el carrusel del menú (null = el actual) */
  menuBoss: number | null;
  setMenuBoss: (i: number) => void;
}

export const useUiStore = create<UiState>(set => ({
  modal: null,
  openModal: modal => set({ modal }),
  closeModal: () => set({ modal: null }),
  stampQueue: [],
  pushStamp: id => set(s => ({ stampQueue: [...s.stampQueue, id] })),
  shiftStamp: () => set(s => ({ stampQueue: s.stampQueue.slice(1) })),
  unlockQueue: [],
  pushUnlock: u => set(s => ({ unlockQueue: [...s.unlockQueue, u] })),
  shiftUnlock: () => set(s => ({ unlockQueue: s.unlockQueue.slice(1) })),
  menuBoss: null,
  setMenuBoss: menuBoss => set({ menuBoss }),
}));
