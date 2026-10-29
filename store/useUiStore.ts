import { create } from 'zustand';
import { track } from '@/lib/analytics';
import { StampId } from '@/lib/stamps';
import type { Unlock } from '@/lib/bosses';
import type { Tier } from '@/lib/forest';

// Estado de interfaz que no forma parte de la partida (qué modal está abierto, sellos
// recién ganados pendientes de mostrar)
export type ModalName = 'rules' | 'stats' | 'exit' | 'settings' | 'collection' | 'deck' | 'pause' | 'boons' | 'challenges' | 'checkpoint' | 'summary' | 'debug' | 'bestiary';

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
  /** Cinemática a pantalla completa en curso (presentación, fase 2): los avisos esperan */
  cinematic: boolean;
  setCinematic: (on: boolean) => void;
  /** Vidas del rival que enseña el panel mientras una cinemática las anima (null = las reales) */
  rivalLivesShown: number | null;
  setRivalLivesShown: (n: number | null) => void;
  /** Depuración: el mapa repite la revelación de "acabas de vencer a tantos" (sin tocar el progreso) */
  mapReplay: number | null;
  setMapReplay: (defeated: number | null) => void;
  /** Depuración: repetir "el Bosque despierta" */
  forestReplay: boolean;
  setForestReplay: (on: boolean) => void;
  /** Depuración: quién sale en el próximo duelo del Bosque */
  forestForce: { id: string; tier: Tier } | null;
  setForestForce: (e: { id: string; tier: Tier } | null) => void;
}

export const useUiStore = create<UiState>(set => ({
  modal: null,
  openModal: modal => { track('modal_opened', { modal }); set({ modal }); },
  closeModal: () => set({ modal: null }),
  stampQueue: [],
  pushStamp: id => set(s => ({ stampQueue: [...s.stampQueue, id] })),
  shiftStamp: () => set(s => ({ stampQueue: s.stampQueue.slice(1) })),
  unlockQueue: [],
  pushUnlock: u => set(s => ({ unlockQueue: [...s.unlockQueue, u] })),
  shiftUnlock: () => set(s => ({ unlockQueue: s.unlockQueue.slice(1) })),
  menuBoss: null,
  setMenuBoss: menuBoss => set({ menuBoss }),
  cinematic: false,
  setCinematic: cinematic => set({ cinematic }),
  rivalLivesShown: null,
  setRivalLivesShown: rivalLivesShown => set({ rivalLivesShown }),
  mapReplay: null,
  setMapReplay: mapReplay => set({ mapReplay }),
  forestReplay: false,
  setForestReplay: forestReplay => set({ forestReplay }),
  forestForce: null,
  setForestForce: forestForce => set({ forestForce }),
}));
