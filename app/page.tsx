'use client';

import { useGameStore } from '@/store/useGameStore';
import { Card } from '@/components/game/Card';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const { 
    player, opponent, turn, phase, recentDamage,
    startGame, resetGame, placeCard, passTurn, finishCombatPhase
  } = useGameStore();

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    startGame();
  }, []);

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

  const handleHandCardClick = (id: string) => {
    if (turn !== 'player' || player.isPassed || phase !== 'placement') return;
    setSelectedCardId(prev => prev === id ? null : id);
  };

  const handleBoardSlotClick = (slotIndex: number) => {
    if (!selectedCardId) return;
    placeCard(selectedCardId, slotIndex);
    setSelectedCardId(null);
  };

  const isPlacementPhase = phase === 'placement';
  const isCombatRevealPhase = phase === 'combat-reveal';
  const canInteract = (turn === 'player' && !player.isPassed && isPlacementPhase) || isCombatRevealPhase;

  // --- ESTILOS DE BOTONES ---
  let buttonText = "ESPERANDO...";
  let buttonAction = passTurn;
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
    buttonText = `¡PELEA! (${countdown}s)`;
    buttonAction = finishCombatPhase;
    buttonColorClass = "bg-[#0066FF] text-white border-black shadow-[4px_4px_0_#000]";
    buttonAnimation = {
        scale: [1, 1.05, 1],
        transition: { duration: 0.8, repeat: Infinity }
    };
  }

  // --- ESTILO DE LOS HUECOS ---
  const slotStyle = "w-full h-full aspect-[2/3] relative flex items-center justify-center rounded-md transition-all border-[4px] border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]";
  
  const emptySlotInteractStyle = (selectedCardId && isPlacementPhase) 
    ? "border-dashed border-[#0066FF] bg-yellow-100 animate-[wiggle_1s_ease-in-out_infinite] cursor-pointer hover:bg-yellow-200" 
    : "border-dashed border-black/40 bg-black/5";

  // --- MODAL FIN ---
  if (phase === 'end') {
    const playerWon = opponent.lives === 0;
    return (
        <main className="h-svh w-full flex items-center justify-center bg-[#F7F5E6] relative select-none font-comic pattern-grid-lg text-black">
            <div className="bg-white p-8 rounded-lg border-[6px] border-black shadow-[12px_12px_0_#000] text-center max-w-md w-full mx-4 flex flex-col gap-6 relative overflow-hidden transform rotate-2">
                <h1 className={clsx("text-6xl font-black drop-shadow-[3px_3px_0_#000] uppercase", playerWon ? "text-green-500" : "text-[#FF2222]")}>
                    {playerWon ? "¡VICTORIA! 🎉" : "💥 FIN DEL JUEGO 💥"}
                </h1>
                <h2 className="text-2xl font-bold border-b-4 border-black pb-4">
                    {playerWon ? "¡Has aplastado a tu rival!" : "Te han hecho puré..."}
                </h2>
                <button onClick={resetGame} className="w-full py-4 px-6 bg-yellow-400 hover:bg-yellow-300 rounded-md font-black text-2xl border-[4px] border-black shadow-[6px_6px_0_#000] active:translate-y-[4px] active:shadow-[2px_2px_0_#000] transition-all uppercase">
                    ¡OTRA PARTIDA!
                </button>
            </div>
        </main>
    )
  }

  return (
    <main className="h-svh w-full flex flex-col bg-[#F7F5E6] text-black overflow-hidden relative select-none font-comic pattern-dots-sm">
      
      {/* 1. HEADER (RIVAL) */}
      <header className="flex-none h-20 sm:h-24 p-4 flex justify-between items-center relative z-10 border-b-[4px] border-black bg-[#FF2222] shadow-[0_6px_0_#000]">
        <div className="flex gap-4 items-center relative">
            {/* Mazo Rival */}
            <div className="relative w-10 h-14 sm:w-12 sm:h-16 bg-[#FF2222] rounded-md border-[3px] border-black flex items-center justify-center shadow-[4px_4px_0_#000]">
                <span className="z-10 font-black text-white text-xl drop-shadow-[2px_2px_0_#000]">{opponent.deck.length}</span>
            </div>
            {/* Mano Rival */}
            <div className="flex -space-x-5 sm:-space-x-7 pl-2">
                {opponent.hand.map((c, i) => (
                    <div key={c.id} className="w-8 h-11 sm:w-10 sm:h-14 bg-[#FF2222] rounded-sm border-[3px] border-black shadow-[3px_3px_0_#000] relative pattern-diagonal-lines-sm text-black/30" style={{ zIndex: i, transform: `rotate(${(i - 1) * 8}deg)` }}></div>
                ))}
            </div>
        </div>
        
        {/* Cartel Central */}
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-50">
          <div className={clsx(
            "px-6 py-2 rounded-md text-xl sm:text-2xl font-black tracking-wider transition-all shadow-[6px_6px_0_#000] uppercase border-[4px] border-black whitespace-nowrap relative -rotate-2",
            (phase === 'combat' || phase === 'combat-reveal') ? "bg-yellow-400 text-black animate-[wiggle_0.5s_infinite]" : 
            turn === 'player' ? "bg-[#0066FF] text-white" : "bg-white text-[#FF2222]"
          )}>
                {(phase === 'combat' || phase === 'combat-reveal') ? "💥 ¡PELEA! 💥" : turn === 'player' ? "TU TURNO" : "RIVAL..."}
          </div>
        </div>

        {/* Vidas Rival */}
        <div className="flex flex-col items-end">
          <span className="text-sm sm:text-base text-white font-black uppercase tracking-wider mb-1 drop-shadow-[2px_2px_0_#000]">Rival</span>
          <div className="flex text-3xl sm:text-4xl gap-1 drop-shadow-[2px_2px_0_#000]">
            {Array(4).fill(0).map((_, i) => (
              <span key={i} className={i < opponent.lives ? "text-white scale-110" : "text-black/40 grayscale"}>
                {i < opponent.lives ? '💀' : '☠️'}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* 2. TABLERO CENTRAL */}
      <section className="flex-1 flex items-center justify-center p-4 overflow-hidden min-h-0 relative py-12">
        
        <div className="w-full max-w-xl bg-white rounded-lg border-[6px] border-black shadow-[12px_12px_0_#000] relative flex flex-col p-4 shrink-0">
          
          {/* LADO RIVAL */}
          <div className="flex-1 grid grid-cols-4 gap-2 sm:gap-4 items-center justify-items-center">
            {opponent.board.map((slot) => (
              <div key={`opp-${slot.index}`} className={slotStyle}>
                <AnimatePresence mode="popLayout">
                  {slot.card && <Card key={slot.card.id} card={slot.card} className="z-10" />}
                </AnimatePresence>
                
                {/* DAÑO FLOTANTE RIVAL (REDUCIDO 50%) */}
                {recentDamage?.opponentSlots[slot.index] !== undefined && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                        animate={{ opacity: 1, scale: 1.2, rotate: 0 }} 
                        exit={{ opacity: 0, scale: 0 }}
                        className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
                    >
                        <div className="relative">
                            <span className="absolute inset-0 text-yellow-400 text-5xl scale-125 z-0 animate-ping">💥</span>
                            <span className="text-3xl font-black text-[#FF2222] drop-shadow-[2px_2px_0_#000] relative z-10" style={{ WebkitTextStroke: '1px black' }}>
                                -{recentDamage.opponentSlots[slot.index]}
                            </span>
                        </div>
                    </motion.div>
                )}
              </div>
            ))}
          </div>

          {/* DIVISOR CENTRAL */}
          <div className="h-4 w-full my-2 flex justify-center items-center relative border-t-[4px] border-b-[4px] border-black border-dashed bg-gray-200">
          </div>

          {/* LADO JUGADOR */}
          <div className="flex-1 grid grid-cols-4 gap-2 sm:gap-4 items-center justify-items-center">
            {player.board.map((slot) => (
              <div key={`player-${slot.index}`} className={slotStyle}>
                <AnimatePresence mode="popLayout">
                  {slot.card ? (
                     <Card key={slot.card.id} card={slot.card} className="z-10" />
                  ) : (
                     // HUECO VACÍO INTERACTIVO
                     <motion.div 
                        key="empty"
                        onClick={() => handleBoardSlotClick(slot.index)}
                        className={clsx(
                          "absolute inset-0 rounded-md border-[4px] transition-all duration-300 m-1",
                          emptySlotInteractStyle,
                          !isPlacementPhase && "pointer-events-none opacity-50 border-solid"
                        )}
                      >
                        {selectedCardId && isPlacementPhase && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-4xl text-[#0066FF] animate-bounce font-black">+</span>
                            </div>
                        )}
                      </motion.div>
                  )}
                </AnimatePresence>
                 
                 {/* DAÑO FLOTANTE JUGADOR (REDUCIDO 50%) */}
                 {recentDamage?.playerSlots[slot.index] !== undefined && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.5, rotate: 45 }}
                        animate={{ opacity: 1, scale: 1.2, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0 }}
                        className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
                    >
                        <div className="relative">
                             <span className="absolute inset-0 text-black text-5xl scale-125 z-0 animate-ping">💥</span>
                            <span className="text-3xl font-black text-[#FF2222] drop-shadow-[2px_2px_0_#000] relative z-10" style={{ WebkitTextStroke: '1px black' }}>
                                -{recentDamage.playerSlots[slot.index]}
                            </span>
                        </div>
                    </motion.div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. FOOTER (JUGADOR) */}
      <section className="flex-none h-28 sm:h-32 bg-[#0066FF] border-t-[4px] border-black relative z-20 px-4 grid grid-cols-3 items-center shadow-[0_-6px_0_#000]">
        
        {/* Vidas Jugador */}
        <div className="flex flex-col items-start justify-center pl-2 sm:pl-4 relative">
             <div className="flex text-3xl sm:text-4xl gap-1 drop-shadow-[2px_2px_0_#000]">
                {Array(4).fill(0).map((_, i) => (
                <span key={i} className={i < player.lives ? "text-white scale-110" : "text-black/40 grayscale"}>
                    {i < player.lives ? '❤️' : '💔'}
                </span>
                ))}
            </div>
            <span className="text-sm sm:text-base text-white font-black uppercase mt-2 tracking-widest drop-shadow-[2px_2px_0_#000]">Tus Vidas</span>
        </div>

        {/* MANO */}
        <div className="flex justify-center items-center h-full pb-4 z-30">
             <div className="flex justify-center gap-2 h-20 sm:h-24 w-full items-end">
                <AnimatePresence>
                {player.hand.map((card) => (
                    <motion.div 
                        key={card.id} 
                        initial={{ opacity: 0, y: 100, rotate: 15 }}
                        animate={{ opacity: 1, y: 0, rotate: (Math.random() * 6 - 3) }}
                        exit={{ opacity: 0, y: 50 }}
                        whileHover={{ y: -20, scale: 1.1, rotate: 0, transition: { duration: 0.1 } }}
                        className="h-full aspect-[2/3] origin-bottom transition-all filter drop-shadow-[4px_4px_0_#000]"
                    >
                        <Card 
                            card={card} 
                            onClick={() => handleHandCardClick(card.id)}
                            isSelected={selectedCardId === card.id}
                            isInHand={true}
                        />
                    </motion.div>
                ))}
                </AnimatePresence>
             </div>
        </div>

        {/* Botón y Mazo */}
         <div className="flex items-center justify-between pl-4 pr-2">
            {/* CAMBIO: Añadido ml-8 al contenedor del botón para empujarlo a la derecha */}
            <div className="ml-8">
                <AnimatePresence mode="wait">
                {canInteract && (
                    <motion.button 
                        key={buttonText}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1, ...buttonAnimation }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={buttonAction}
                        className={clsx(
                            "px-4 py-2 rounded-md font-black tracking-wider text-base transition-all whitespace-nowrap border-[4px] border-black shadow-[4px_4px_0_#000] active:translate-y-[4px] active:shadow-[2px_2px_0_#000] uppercase",
                            buttonColorClass
                        )}
                    >
                        {buttonText}
                    </motion.button>
                )}
                </AnimatePresence>
            </div>
            {/* Mazo Jugador */}
            <div className="relative w-10 h-14 sm:w-12 sm:h-16 bg-[#0066FF] rounded-md border-[3px] border-black flex items-center justify-center shadow-[4px_4px_0_#000]">
                <span className="z-10 font-black text-white text-xl drop-shadow-[2px_2px_0_#000]">{player.deck.length}</span>
            </div>
         </div>
      </section>
    </main>
  );
}