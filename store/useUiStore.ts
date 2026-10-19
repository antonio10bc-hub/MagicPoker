import { create } from 'zustand';

// Estado de interfaz que no forma parte de la partida (qué modal está abierto)
export type ModalName = 'rules' | 'stats' | 'exit';

interface UiState {
  modal: ModalName | null;
  openModal: (modal: ModalName) => void;
  closeModal: () => void;
}

export const useUiStore = create<UiState>(set => ({
  modal: null,
  openModal: modal => set({ modal }),
  closeModal: () => set({ modal: null }),
}));
