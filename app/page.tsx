'use client';

import { useGameStore } from '@/store/useGameStore';
import { Card } from '@/components/game/GameCardLOLO';
import { useEffect, useState, useRef } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, X, Volume2, VolumeX, Home as HomeIcon, Trophy } from 'lucide-react';
import { playSound, toggleMute, getMuteState, playMusic, stopMusic } from '@/lib/sounds';
import Confetti from 'react-confetti';
import { getStats, GameStats } from '@/lib/stats';

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

export default function Home() {
  const { 
    screen, difficulty, setDifficulty, goToMenu,
    player, opponent, turn, phase, recentDamage, gameResult,
    startGame, resetGame, placeCard, passTurn, finishCombatPhase, roundNumber
  } = useGameStore();

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [showRules, setShowRules] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [statsData, setStatsData] = useState<GameStats | null>(null);
  const [isMutedUI, setIsMutedUI] = useState(getMuteState());
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  useEffect(() => {
      if (screen === 'menu') {
          playMusic('menu_music', 0.4);
      } else if (screen === 'game') {
          if (phase === 'end') {
              stopMusic();
          } else {
              playMusic('game_music', 0.3);
          }
      }
  }, [screen, phase]);

  useEffect(() => {
    if (screen === 'game' && phase === 'start') {
        startGame();
    }
  }, [screen, phase]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phase === 'combat-reveal') {
        setCountdown(5); 
        timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    finishCombatPhase(); 
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }
    return () => {
        if (timer) clearInterval(timer);
    };
  }, [phase, finishCombatPhase]);

  const isPlacementPhase = phase === 'placement';
  const isCombatRevealPhase = phase === 'combat-reveal';
  const canPlay = turn === 'player' && !player.isPassed && isPlacementPhase;
  const canInteract = canPlay || isCombatRevealPhase;

  // --- HANDLERS ---
  const handleHandCardClick = (id: string) => {
    if (!canPlay) return;
    playSound('click', 0.5);
    setSelectedCardId(prev => prev === id ? null : id);
  };

  const handleBoardSlotClick = (slotIndex: number) => {
    if (!selectedCardId) return;
    playSound('click', 0.5);
    placeCard(selectedCardId, slotIndex);
    setSelectedCardId(null);
  };

  const handleToggleMute = () => {
      const newState = toggleMute();
      setIsMutedUI(newState);
      if (!newState) playSound('click');
  };

  const handleHomeClick = () => {
      playSound('click');
      const hasCardsOnBoard = player.board.some(s => s.card !== null);
      if (roundNumber > 1 || hasCardsOnBoard) {
          setShowExitConfirm(true);
      } else {
          goToMenu();
      }
  };

  const confirmExit = () => {
      playSound('click');
      setShowExitConfirm(false);
      resetGame(); 
      goToMenu();
  };

  const handleOpenStats = () => {
      playSound('click');
      setStatsData(getStats());
      setShowStats(true);
  };

  // --- MENU SCREEN ---
  if (screen === 'menu') {
      return (
        <main className="h-svh w-full flex items-center justify-center bg-[#F7F5E6] relative select-none font-comic pattern-grid-lg text-black">
            <div className="flex flex-col gap-6 w-full max-w-md px-4">
                <motion.button 
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => { playSound('click'); startGame(); }}
                    className="bg-white p-8 rounded-lg border-[6px] border-black shadow-[12px_12px_0_#000] text-center hover:bg-yellow-300 transition-colors cursor-pointer"
                >
                    <h1 className="text-6xl font-black text-[#8e0dff] drop-shadow-[3px_3px_0_#000] uppercase">JUGAR</h1>
                </motion.button>

                <div className="bg-white p-6 rounded-lg border-[6px] border-black shadow-[12px_12px_0_#000] flex flex-col items-center gap-4">
                    <h2 className="text-3xl font-black text-[#ff590d] uppercase drop-shadow-[2px_2px_0_#000]">DIFICULTAD</h2>
                    <div className="flex justify-between w-full gap-2">
                        {(['easy', 'normal', 'hard'] as const).map((d) => (
                            <button
                                key={d}
                                onClick={() => { playSound('click'); setDifficulty(d); }}
                                className={clsx(
                                    "flex-1 py-3 rounded-md border-[4px] border-black font-black uppercase text-lg transition-all shadow-[4px_4px_0_#000] active:translate-y-[2px] active:shadow-[2px_2px_0_#000]",
                                    difficulty === d ? "bg-[#8e0dff] text-white scale-105" : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                                )}
                            >
                                {d === 'easy' ? 'Fácil' : d === 'normal' ? 'Normal' : 'Difícil'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </main>
      );
  }

  // --- GAME SCREEN ---
  let buttonText = "ESPERANDO...";
  let buttonAction: () => void | Promise<void> = passTurn;
  let buttonColorClass = "bg-gray-300 text-gray-600 border-black cursor-not-allowed pattern-diagonal-lines-sm opacity-70";
  let buttonAnimation = {};

  if (isPlacementPhase) {
    if (opponent.isPassed) {
        buttonText = "¡RESOLVER!";
        buttonColorClass = "bg-orange-500 text-white border-black hover:bg-orange-400 hover:-translate-y-1 hover:shadow-[6px_6px_0_#000] active:translate-y-1 active:shadow-[2px_2px_0_#000]";
    } else {
        buttonText = "PLANTARSE";
        buttonColorClass = "bg-green-500 text-white border-black hover:bg-green-400 hover:-translate-y-1 hover:shadow-[6px_6px_0_#000] active:translate-y-1 active:shadow-[2px_2px_0_#000]";
    }
  } else if (isCombatRevealPhase) {
    buttonText = `CONTINUAR (${countdown}s)`;
    buttonAction = finishCombatPhase;
    buttonColorClass = "bg-[#8e0dff] text-white border-black shadow-[4px_4px_0_#000]";
    buttonAnimation = { scale: [1, 1.05, 1], transition: { duration: 0.8, repeat: Infinity } };
  }

  const slotStyle = "w-full h-full aspect-[2/3] relative flex items-center justify-center rounded-md transition-all border-[2px] sm:border-[4px] border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]";
  const emptySlotInteractStyle = (selectedCardId && isPlacementPhase) 
    ? "border-dashed border-[#8e0dff] bg-purple-100 animate-[wiggle_1s_ease-in-out_infinite] cursor-pointer hover:bg-purple-200" 
    : "border-dashed border-black/40 bg-black/5";

  if (phase === 'end') {
    const isWin = gameResult === 'win';
    const isDraw = gameResult === 'draw';
    let titleText = isDraw ? "¡EMPATE! 🤝" : isWin ? "¡VICTORIA! 🎉" : "💥 FIN DEL JUEGO 💥";
    let subText = isDraw ? "¡Nadie gana esta vez!" : isWin ? "¡Has aplastado a tu rival!" : "Te han hecho puré...";
    let titleColorClass = isDraw ? "text-gray-700" : isWin ? "text-[#8e0dff]" : "text-[#ff590d]";

    return (
        <main className="h-svh w-full flex items-center justify-center bg-[#F7F5E6] relative select-none font-comic pattern-grid-lg text-black overflow-hidden">
            {isWin && <Confetti numberOfPieces={300} recycle={false} />}
            <div className="bg-white p-8 rounded-lg border-[6px] border-black shadow-[12px_12px_0_#000] text-center max-w-md w-full mx-4 flex flex-col gap-6 relative overflow-hidden transform rotate-2 z-10">
                <h1 className={clsx("text-5xl sm:text-6xl font-black drop-shadow-[3px_3px_0_#000] uppercase", titleColorClass)}>{titleText}</h1>
                <h2 className="text-2xl font-bold border-b-4 border-black pb-4">{subText}</h2>
                <div className="flex flex-col gap-3">
                    <button onClick={() => { playSound('click'); resetGame(); }} className="w-full py-4 px-6 bg-yellow-400 hover:bg-yellow-300 rounded-md font-black text-2xl border-[4px] border-black shadow-[6px_6px_0_#000] active:translate-y-[4px] active:shadow-[2px_2px_0_#000] transition-all uppercase">¡OTRA PARTIDA!</button>
                    <button onClick={() => { playSound('click'); resetGame(); goToMenu(); }} className="w-full py-2 px-6 bg-gray-200 hover:bg-gray-300 rounded-md font-bold text-lg border-[4px] border-black shadow-[4px_4px_0_#000] active:translate-y-[2px] active:shadow-[2px_2px_0_#000] uppercase">Salir al Menú</button>
                </div>
            </div>
        </main>
    )
  }

  return (
    <main className="h-svh w-full flex flex-col bg-[#F7F5E6] text-black overflow-hidden relative select-none font-comic pattern-dots-sm">
      
      {/* --- MODALES --- */}
      <AnimatePresence>
        {showExitConfirm && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white p-6 rounded-lg border-[6px] border-black shadow-[12px_12px_0_#000] text-center max-w-sm w-full">
                    <h2 className="text-2xl font-black mb-4">¿Salir al Menú?</h2>
                    <p className="mb-6 font-medium">Perderás el progreso de la partida actual.</p>
                    <div className="flex gap-4 justify-center">
                        <button onClick={confirmExit} className="bg-red-500 text-white px-6 py-2 rounded border-[3px] border-black font-bold shadow-[4px_4px_0_#000]">SÍ, SALIR</button>
                        <button onClick={() => setShowExitConfirm(false)} className="bg-gray-200 px-6 py-2 rounded border-[3px] border-black font-bold shadow-[4px_4px_0_#000]">CANCELAR</button>
                    </div>
                </div>
            </motion.div>
        )}
        {showStats && statsData && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { playSound('click'); setShowStats(false); }}>
                <motion.div initial={{ scale: 0.8, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 50 }} onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-lg overflow-y-auto rounded-lg border-[6px] border-black shadow-[12px_12px_0_#000] relative flex flex-col">
                    <div className="flex justify-between items-center p-4 border-b-[4px] border-black bg-yellow-300 sticky top-0 z-10">
                        <h2 className="text-2xl font-black uppercase tracking-wider flex items-center gap-2"><Trophy className="w-8 h-8 stroke-[3px]" /> ESTADÍSTICAS</h2>
                        <button onClick={() => { playSound('click'); setShowStats(false); }} className="bg-white hover:bg-red-100 p-2 rounded-md border-[3px] border-black shadow-[3px_3px_0_#000] active:translate-y-1 active:shadow-none transition-all"><X className="w-6 h-6 stroke-[3px]" /></button>
                    </div>
                    <div className="p-6 space-y-4 text-lg font-bold">
                        <div className="bg-gray-100 p-4 rounded-md border-[3px] border-black shadow-[4px_4px_0_#000]">
                            <h3 className="text-xl uppercase border-b-2 border-black pb-2 mb-3">Victorias</h3>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div><div className="text-sm text-gray-500">FÁCIL</div><div className="text-2xl text-green-600">{statsData.wins.easy}</div></div>
                                <div><div className="text-sm text-gray-500">NORMAL</div><div className="text-2xl text-yellow-600">{statsData.wins.normal}</div></div>
                                <div><div className="text-sm text-gray-500">DIFÍCIL</div><div className="text-2xl text-red-600">{statsData.wins.hard}</div></div>
                            </div>
                        </div>
                        <div className="bg-gray-100 p-4 rounded-md border-[3px] border-black shadow-[4px_4px_0_#000]">
                            <h3 className="text-xl uppercase border-b-2 border-black pb-2 mb-3">Globales</h3>
                            <div className="flex justify-between"><span>Partidas Totales:</span><span>{statsData.totalGames}</span></div>
                            <div className="flex justify-between"><span>Cartas Jugadas:</span><span>{statsData.cardsPlayed}</span></div>
                            <div className="flex justify-between"><span>Cartas Destruidas:</span><span>{statsData.cardsDestroyed}</span></div>
                        </div>
                        <div className={clsx("p-4 rounded-md border-[3px] border-black shadow-[4px_4px_0_#000] transition-colors", statsData.achievementRepublicana ? "bg-[#8e0dff] text-white" : "bg-gray-200 text-gray-400 grayscale")}>
                            <div className="flex items-center gap-3"><span className="text-3xl">🏆</span><div><div className="uppercase font-black">La Republicana</div><div className="text-sm font-medium leading-tight opacity-80">Limpia J, Q y K enemigas con un AS.</div></div></div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        )}
        {showRules && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { playSound('click'); setShowRules(false); }}>
                <motion.div initial={{ scale: 0.8, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 50 }} onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg border-[6px] border-black shadow-[12px_12px_0_#000] relative flex flex-col">
                    <div className="flex justify-between items-center p-4 sm:p-6 border-b-[4px] border-black bg-yellow-300 sticky top-0 z-10">
                        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider drop-shadow-[2px_2px_0_#fff]">CÓMO JUGAR</h2>
                        <div className="flex gap-3">
                            <button onClick={handleToggleMute} className={clsx("p-2 rounded-md border-[3px] border-black shadow-[3px_3px_0_#000] active:translate-y-1 active:shadow-none transition-all", isMutedUI ? "bg-black text-white" : "bg-[#F7F5E6] text-black")}>
                                {isMutedUI ? <VolumeX className="w-6 h-6 stroke-[3px]" /> : <Volume2 className="w-6 h-6 stroke-[3px]" />}
                            </button>
                            <button onClick={() => { playSound('click'); setShowRules(false); }} className="bg-white hover:bg-red-100 p-2 rounded-md border-[3px] border-black shadow-[3px_3px_0_#000] active:translate-y-1 active:shadow-none transition-all"><X className="w-6 h-6 sm:w-8 sm:h-8 stroke-[3px]" /></button>
                        </div>
                    </div>
                    <div className="p-6 space-y-6 text-lg sm:text-xl font-medium leading-relaxed">
                        <section><h3 className="font-black text-xl mb-2 bg-[#8e0dff] text-white inline-block px-2 border-[2px] border-black shadow-[3px_3px_0_#000] -rotate-1">1. El Objetivo</h3><p>Gana el primero que reduzca las vidas del oponente a 0.</p></section>
                        <section><h3 className="font-black text-xl mb-2 bg-[#ff590d] text-white inline-block px-2 border-[2px] border-black shadow-[3px_3px_0_#000] rotate-1">2. Tu Turno</h3><p>Coloca tantas cartas como quieras en los 4 huecos que tienes disponibles.</p><p className="mt-2">Cuando termines, pulsa <span className="font-bold text-green-600">"PLANTARSE"</span>. El rival jugará después. Cuando ambos paséis, ¡comienza la fase de pelea!</p></section>
                        <section>
                            <h3 className="font-black text-xl mb-2 bg-yellow-400 text-black inline-block px-2 border-[2px] border-black shadow-[3px_3px_0_#000] -rotate-1">3. Fase de Pelea</h3>
                            <ul className="list-disc pl-5 space-y-2 text-base sm:text-lg">
                                <li>Las cartas se enfrentan cara a cara. La carta con el número más alto gana y destruye a la otra.</li>
                                <li>Si tu carta se enfrenta a un hueco vacío directamente, le haces <strong>1 punto de daño</strong> directo.</li>
                                <li className="pt-2"><strong>🅰️ El As (A):</strong> Limpia el tablero, tanto las cartas del enemigo como las tuyas, evitando cualquier golpe.</li>
                                <li><strong>👑 El Rey (K):</strong> Ataca a las 3 posiciones que tiene en frente a la vez.</li>
                                <li><strong>👸 La Reina (Q):</strong> Ataca a las 2 posiciones en diagonal a la vez.</li>
                                <li><strong>🤴 El Príncipe (J):</strong> Ataca 1 posición aleatoria entre las que tiene en frente.</li>
                                <li><strong>🃏 El Joker:</strong> No hace daño, pero te permite robar 2 cartas extra.</li>
                            </ul>
                        </section>
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* BOTONES FLOTANTES */}
      <div className="fixed bottom-20 sm:bottom-32 left-4 z-50 flex flex-row gap-3">
          <motion.button onClick={() => { playSound('click'); setShowRules(true); }} whileHover={{ scale: 1.1, rotate: 5 }} whileTap={{ scale: 0.9 }} className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full border-[3px] border-black shadow-[3px_3px_0_#000] flex items-center justify-center hover:bg-yellow-100 transition-colors">
            <Info className="w-6 h-6 sm:w-8 sm:h-8 stroke-[3px]" />
          </motion.button>
          <motion.button onClick={handleOpenStats} whileHover={{ scale: 1.1, rotate: -5 }} whileTap={{ scale: 0.9 }} className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full border-[3px] border-black shadow-[3px_3px_0_#000] flex items-center justify-center hover:bg-yellow-100 transition-colors">
            <Trophy className="w-6 h-6 sm:w-8 sm:h-8 stroke-[3px]" />
          </motion.button>
      </div>

      {/* BOTÓN PLANTARSE FLOTANTE */}
      <AnimatePresence>
        {canInteract && (
            <motion.div 
                initial={{ y: 100, opacity: 0 }} 
                animate={{ y: 0, opacity: 1 }} 
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-20 sm:bottom-32 right-4 z-50"
            >
                <motion.button 
                    key={buttonText}
                    animate={{ ...buttonAnimation }}
                    onClick={() => { playSound('click'); buttonAction(); }}
                    className={clsx(
                        "px-4 py-2 sm:px-6 sm:py-3 rounded-full font-black tracking-wider text-sm sm:text-base border-[3px] sm:border-[4px] border-black uppercase transition-all",
                        buttonColorClass
                    )}
                >
                    {buttonText}
                </motion.button>
            </motion.div>
        )}
      </AnimatePresence>

      {/* CARTEL FLOTANTE DE "TU TURNO" - AJUSTADO POSICIÓN MÓVIL */}
      <div className="fixed top-28 sm:top-14 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className={clsx("px-4 py-1.5 sm:px-6 sm:py-2 rounded-md text-xl sm:text-2xl font-black tracking-wider transition-all shadow-[3px_3px_0_#000] sm:shadow-[6px_6px_0_#000] uppercase border-[3px] sm:border-[4px] border-black whitespace-nowrap relative -rotate-2", (phase === 'combat' || phase === 'combat-reveal') ? "bg-yellow-400 text-black animate-[wiggle_0.5s_infinite]" : turn === 'player' ? "bg-[#8e0dff] text-white" : "bg-white text-[#ff590d]")}>
                {(phase === 'combat' || phase === 'combat-reveal') ? "💥 ¡PELEA! 💥" : turn === 'player' ? "TU TURNO" : "RIVAL..."}
          </div>
      </div>

      {/* HEADER (RIVAL) */}
      <header className="flex-none h-14 sm:h-20 p-2 sm:p-4 flex justify-between items-center relative z-10 border-b-[3px] sm:border-b-[4px] border-black bg-[#ff590d] shadow-[0_4px_0_#000] sm:shadow-[0_6px_0_#000]">
        <div className="flex items-center relative gap-3 sm:gap-4">
            <button onClick={handleHomeClick} className="bg-white p-1.5 sm:p-2 rounded-md border-[2px] sm:border-[3px] border-black shadow-[2px_2px_0_#000] sm:shadow-[3px_3px_0_#000] active:translate-y-1 active:shadow-none hover:bg-gray-100 transition-all scale-75 sm:scale-100 origin-left">
                <HomeIcon className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3px]" />
            </button>
            <div className="flex gap-2 sm:gap-4 items-center pl-0 sm:pl-2 scale-75 sm:scale-100 origin-left">
                <div className="relative w-8 h-10 sm:w-12 sm:h-16 bg-[#ff590d] rounded-md border-[2px] sm:border-[3px] border-black flex items-center justify-center shadow-[2px_2px_0_#000] sm:shadow-[4px_4px_0_#000]">
                    <span className="z-10 font-black text-white text-base sm:text-xl drop-shadow-[1px_1px_0_#000] sm:drop-shadow-[2px_2px_0_#000]">{opponent.deck.length}</span>
                </div>
                <div className="flex -space-x-4 sm:-space-x-7 pl-1 sm:pl-2">
                    {opponent.hand.map((c, i) => (
                        <div key={c.id} className="w-6 h-8 sm:w-10 sm:h-14 bg-[#ff590d] rounded-sm border-[2px] sm:border-[3px] border-black shadow-[2px_2px_0_#000] sm:shadow-[3px_3px_0_#000] relative pattern-diagonal-lines-sm text-black/30" style={{ zIndex: i, transform: `rotate(${(i - 1) * 8}deg)` }}></div>
                    ))}
                </div>
            </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-4 scale-75 sm:scale-100 origin-right">
             <div className="flex text-xl sm:text-4xl gap-0.5 sm:gap-1 drop-shadow-[1px_1px_0_#000] sm:drop-shadow-[2px_2px_0_#000]">
                {Array(4).fill(0).map((_, i) => (<span key={i} className={i < (4 - opponent.lives) ? "text-black/40 grayscale" : "text-white scale-110"}>{i < (4 - opponent.lives) ? '💔' : '❤️'}</span>))}
            </div>
            <span className="text-xl sm:text-4xl text-white font-black uppercase tracking-wider drop-shadow-[1px_1px_0_#000] sm:drop-shadow-[2px_2px_0_#000]">RIVAL</span>
        </div>
      </header>

      {/* TABLERO */}
      <section className="flex-1 flex items-center justify-center p-1 sm:p-4 overflow-hidden min-h-0 relative py-2 sm:py-8">
        <div className="w-full max-w-lg bg-white rounded-lg border-[4px] sm:border-[6px] border-black shadow-[8px_8px_0_#000] sm:shadow-[12px_12px_0_#000] relative flex flex-col p-2 sm:p-4 shrink-0 scale-90 sm:scale-100 origin-center">
          <div className="flex-1 grid grid-cols-4 gap-1 sm:gap-4 items-center justify-items-center">
            {opponent.board.map((slot) => (
              <div key={`opp-${slot.index}`} className={slotStyle}>
                <AnimatePresence mode="popLayout">{slot.card && <Card key={slot.card.id} card={slot.card} className="z-10" />}</AnimatePresence>
                {recentDamage?.opponentSlots[slot.index] !== undefined && (
                    <motion.div initial={{ opacity: 0, scale: 0.5, rotate: -45 }} animate={{ opacity: 1, scale: 1.2, rotate: 0 }} exit={{ opacity: 0, scale: 0 }} className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                        <div className="relative flex items-center justify-center"><span className="absolute inset-0 text-yellow-400 text-5xl scale-125 z-0 animate-ping">💥</span><span className="text-3xl font-black text-[#FF2222] drop-shadow-[2px_2px_0_#000] relative z-10" style={{ WebkitTextStroke: '1px black' }}>-{recentDamage.opponentSlots[slot.index]}</span></div>
                    </motion.div>
                )}
              </div>
            ))}
          </div>
          <div className="h-2 sm:h-4 w-full my-1 sm:my-2 flex justify-center items-center relative border-t-[3px] sm:border-t-[4px] border-b-[3px] sm:border-b-[4px] border-black border-dashed bg-gray-200"></div>
          <div className="flex-1 grid grid-cols-4 gap-1 sm:gap-4 items-center justify-items-center">
            {player.board.map((slot) => (
              <div key={`player-${slot.index}`} className={slotStyle}>
                <AnimatePresence mode="popLayout">
                  {slot.card ? (<Card key={slot.card.id} card={slot.card} className="z-10" />) : (
                     <motion.div key="empty" onClick={() => handleBoardSlotClick(slot.index)} className={clsx("absolute inset-0 rounded-md border-[2px] sm:border-[4px] transition-all duration-300 m-0.5 sm:m-1", emptySlotInteractStyle, !isPlacementPhase && "pointer-events-none opacity-50 border-solid")}>
                        {selectedCardId && isPlacementPhase && (<div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl sm:text-4xl text-[#8e0dff] animate-bounce font-black">+</span></div>)}
                      </motion.div>
                  )}
                </AnimatePresence>
                 {recentDamage?.playerSlots[slot.index] !== undefined && (
                    <motion.div initial={{ opacity: 0, scale: 0.5, rotate: 45 }} animate={{ opacity: 1, scale: 1.2, rotate: 0 }} exit={{ opacity: 0, scale: 0 }} className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                        <div className="relative flex items-center justify-center"><span className="absolute inset-0 text-black text-5xl scale-125 z-0 animate-ping">💥</span><span className="text-3xl font-black text-[#8e0dff] drop-shadow-[2px_2px_0_#000] relative z-10" style={{ WebkitTextStroke: '1px black' }}>-{recentDamage.playerSlots[slot.index]}</span></div>
                    </motion.div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. FOOTER (JUGADOR) */}
      <section className="flex-none h-16 sm:h-28 bg-[#8e0dff] border-t-[3px] sm:border-t-[4px] border-black relative z-20 px-2 sm:px-4 grid grid-cols-3 items-center shadow-[0_-6px_0_#000]">
        
        {/* Lado Izq: Vidas + Cartel TÚ */}
        <div className="flex items-center gap-1 sm:gap-4 pl-1 sm:pl-4 relative scale-75 sm:scale-100 origin-left">
             <span className="text-xl sm:text-4xl text-white font-black uppercase tracking-wider drop-shadow-[1px_1px_0_#000] sm:drop-shadow-[2px_2px_0_#000]">TÚ</span>
             <div className="flex text-xl sm:text-4xl gap-0.5 sm:gap-1 drop-shadow-[1px_1px_0_#000] sm:drop-shadow-[2px_2px_0_#000]">
                {Array(4).fill(0).map((_, i) => (<span key={i} className={i < player.lives ? "text-white scale-110" : "text-black/40 grayscale"}>{i < player.lives ? '❤️' : '💔'}</span>))}
            </div>
        </div>

        {/* Centro: Mano de Cartas */}
        <div className="flex justify-center items-center h-full pb-2 sm:pb-4 z-30 col-span-1">
             <div className="flex justify-center gap-1 sm:gap-2 h-16 sm:h-24 w-full items-center">
                <AnimatePresence>
                {player.hand.map((card) => (
                    <motion.div key={card.id} initial={{ opacity: 0, y: 100, rotate: 15 }} animate={{ opacity: 1, y: 0, rotate: (Math.random() * 6 - 3) }} exit={{ opacity: 0, y: 50 }} transition={{ duration: 0.2 }} whileHover={canPlay ? { y: -20, scale: 1.1, rotate: 0, transition: { duration: 0.1 } } : {}} className="h-[90%] aspect-[2/3] origin-bottom transition-all filter drop-shadow-[2px_2px_0_#000] sm:drop-shadow-[4px_4px_0_#000]">
                        <Card card={card} onClick={() => handleHandCardClick(card.id)} isSelected={selectedCardId === card.id} isInHand={true} />
                    </motion.div>
                ))}
                </AnimatePresence>
             </div>
        </div>

         {/* Lado Dcho: Mazo */}
         <div className="flex items-center justify-end pl-1 sm:pl-4 pr-2 sm:pr-2">
            <div className="relative w-8 h-10 sm:w-12 sm:h-16 bg-[#8e0dff] rounded-md border-[2px] sm:border-[3px] border-black flex items-center justify-center shadow-[2px_2px_0_#000] sm:shadow-[4px_4px_0_#000] mr-1 sm:mr-0">
                <span className="z-10 font-black text-white text-base sm:text-xl drop-shadow-[1px_1px_0_#000] sm:drop-shadow-[2px_2px_0_#000]">{player.deck.length}</span>
            </div>
         </div>
      </section>
    </main>
  );
}