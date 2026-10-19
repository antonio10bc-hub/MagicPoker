import { create } from 'zustand';
import { StampId } from '@/lib/stamps';

// Estado de interfaz que no forma parte de la partida (qué modal está abierto, sellos
// recién ganados pendientes de mostrar)
export type ModalName = 'rules' | 'stats' | 'exit' | 'settings';

interface UiState {
  modal: ModalName | null;
  openModal: (modal: ModalName) => void;
  closeModal: () => void;
  stampQueue: StampId[];
  pushStamp: (id: StampId) => void;
  shiftStamp: () => void;
}

export const useUiStore = create<UiState>(set => ({
  modal: null,
  openModal: modal => set({ modal }),
  closeModal: () => set({ modal: null }),
  stampQueue: [],
  pushStamp: id => set(s => ({ stampQueue: [...s.stampQueue, id] })),
  shiftStamp: () => set(s => ({ stampQueue: s.stampQueue.slice(1) })),
}));
