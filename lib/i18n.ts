import { useSyncExternalStore } from 'react';

// --- DICCIONARIO DE TRADUCCIONES ---
// Para añadir un idioma, añade su bloque: TypeScript obliga a que tenga todas las claves de `es`.
const es = {
  play: "JUGAR",
  difficulty: "DIFICULTAD",
  easy: "Fácil",
  normal: "Normal",
  hard: "Difícil",
  waiting: "ESPERANDO...",
  resolve: "¡RESOLVER!",
  stand: "PLANTARSE",
  continue: "CONTINUAR",
  fight: "¡PELEA!",
  your_turn: "TU TURNO",
  round: "RONDA",
  rival_turn: "RIVAL...",
  rival: "RIVAL",
  you: "TÚ",
  win: "¡VICTORIA!",
  draw: "¡EMPATE!",
  loss: "FIN DEL JUEGO",
  win_sub: "¡Has aplastado a tu rival!",
  draw_sub: "¡Nadie gana esta vez!",
  loss_sub: "Te han hecho puré...",
  play_again: "¡OTRA PARTIDA!",
  exit_menu: "Salir al Menú",
  confirm_exit_title: "¿Salir al Menú?",
  confirm_exit_desc: "Perderás el progreso de la partida actual.",
  yes_exit: "SÍ, SALIR",
  cancel: "CANCELAR",
  stats_title: "ESTADÍSTICAS",
  wins: "Victorias",
  global: "Globales",
  total_games: "Partidas Totales:",
  cards_played: "Cartas Jugadas:",
  cards_destroyed: "Cartas Destruidas:",
  achievement_republicana: "La Republicana",
  achievement_desc: "Limpia J, Q y K enemigas con un AS.",
  rules_title: "CÓMO JUGAR",
  obj_title: "1. El Objetivo",
  obj_desc: "Gana el primero que reduzca las vidas del oponente a 0.",
  turn_title: "2. Tu Turno",
  turn_desc_1: "Coloca tantas cartas como quieras en los 4 huecos que tienes disponibles.",
  turn_desc_2: "Cuando termines, pulsa \"PLANTARSE\". El rival jugará después. Cuando ambos paséis, ¡comienza la fase de pelea!",
  fight_title: "3. Fase de Pelea",
  fight_li_1: "Las cartas se enfrentan cara a cara. La carta con el número más alto gana y destruye a la otra.",
  fight_li_2: "Si tu carta se enfrenta a un hueco vacío directamente, le haces 1 punto de daño directo.",
  special_title: "4. Cartas Especiales",
  special_ace: "El As (A): Limpia el tablero (elimina todas las cartas de ambos jugadores).",
  special_king: "El Rey (K): Ataca a las 3 posiciones que tiene en frente a la vez.",
  special_queen: "La Reina (Q): Ataca a las 2 posiciones en diagonal a la vez.",
  special_jack: "El Príncipe (J): Ataca 1 posición aleatoria entre las que tiene en frente.",
  special_joker: "El Joker: No hace daño, pero te permite robar 2 cartas extra."
};

const en: Translations = {
  play: "PLAY",
  difficulty: "DIFFICULTY",
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
  waiting: "WAITING...",
  resolve: "RESOLVE!",
  stand: "STAND",
  continue: "CONTINUE",
  fight: "FIGHT!",
  your_turn: "YOUR TURN",
  round: "ROUND",
  rival_turn: "RIVAL...",
  rival: "RIVAL",
  you: "YOU",
  win: "VICTORY!",
  draw: "DRAW!",
  loss: "GAME OVER",
  win_sub: "You crushed your rival!",
  draw_sub: "Nobody wins this time!",
  loss_sub: "You got mashed...",
  play_again: "PLAY AGAIN!",
  exit_menu: "Exit to Menu",
  confirm_exit_title: "Exit to Menu?",
  confirm_exit_desc: "You will lose current game progress.",
  yes_exit: "YES, EXIT",
  cancel: "CANCEL",
  stats_title: "STATISTICS",
  wins: "Wins",
  global: "Globals",
  total_games: "Total Games:",
  cards_played: "Cards Played:",
  cards_destroyed: "Cards Destroyed:",
  achievement_republicana: "The Republican",
  achievement_desc: "Wipe enemy J, Q and K with an ACE.",
  rules_title: "HOW TO PLAY",
  obj_title: "1. The Objective",
  obj_desc: "The first one to reduce opponent's lives to 0 wins.",
  turn_title: "2. Your Turn",
  turn_desc_1: "Place as many cards as you want in your 4 available slots.",
  turn_desc_2: "When done, press \"STAND\". The rival plays next. When both pass, the fight phase begins!",
  fight_title: "3. Fight Phase",
  fight_li_1: "Cards face each other. The highest number wins and destroys the other.",
  fight_li_2: "If your card faces an empty slot, you deal 1 direct damage.",
  special_title: "4. Special Cards",
  special_ace: "The Ace (A): Wipes the board (removes all cards from both players).",
  special_king: "The King (K): Attacks the 3 positions in front at once.",
  special_queen: "The Queen (Q): Attacks the 2 diagonal positions at once.",
  special_jack: "The Jack (J): Attacks 1 random position among those in front.",
  special_joker: "The Joker: Deals no damage, but lets you draw 2 extra cards."
};

export type Translations = typeof es;
export type Lang = 'es' | 'en';

const TRANSLATIONS: Record<Lang, Translations> = { es, en };

// --- DETECCIÓN DE IDIOMA ---
// En servidor se renderiza en español; en cliente se usa el idioma del navegador.
const noopSubscribe = () => () => {};
const getBrowserLang = (): Lang => (navigator.language.split('-')[0] === 'es' ? 'es' : 'en');
const getServerLang = (): Lang => 'es';

export const useTranslations = (): Translations =>
  TRANSLATIONS[useSyncExternalStore(noopSubscribe, getBrowserLang, getServerLang)];
