'use client';

import { useGameStore } from '@/store/useGameStore';
import { Card } from '@/components/game/GameCardLOLO';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
// Importamos los iconos necesarios
import { Info, X } from 'lucide-react';

export default function Home() {
  const { 
    player, opponent, turn, phase, recentDamage,
    startGame, resetGame, placeCard, passTurn, finishCombatPhase
  } = useGameStore();

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [showRules, setShowRules] = useState(false);

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
    buttonText = `¡PELEA! (${countdown}s)`;
    buttonAction = finishCombatPhase;
    buttonColorClass = "bg-[#8e0dff] text-white border-black shadow-[4px_4px_0_#000]";
    buttonAnimation = {
        scale: [1, 1.05, 1],
        transition: { duration: 0.8, repeat: Infinity }
    };
  }

  const slotStyle = "w-full h-full aspect-[2/3] relative flex items-center justify-center rounded-md transition-all border-[4px] border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]";
  
  const emptySlotInteractStyle = (selectedCardId && isPlacementPhase) 
    ? "border-dashed border-[#8e0dff] bg-purple-100 animate-[wiggle_1s_ease-in-out_infinite] cursor-pointer hover:bg-purple-200" 
    : "border-dashed border-black/40 bg-black/5";

  // --- MODAL FIN ---
  if (phase === 'end') {
    const playerWon = opponent.lives === 0;
    return (
        <main className="h-svh w-full flex items-center justify-center bg-[#F7F5E6] relative select-none font-comic pattern-grid-lg text-black">
            <div className="bg-white p-8 rounded-lg border-[6px] border-black shadow-[12px_12px_0_#000] text-center max-w-md w-full mx-4 flex flex-col gap-6 relative overflow-hidden transform rotate-2">
                <h1 className={clsx("text-6xl font-black drop-shadow-[3px_3px_0_#000] uppercase", playerWon ? "text-[#8e0dff]" : "text-[#ff590d]")}>
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
      
      {/* --- MODAL DE REGLAS (POP UP) --- */}
      <AnimatePresence>
        {showRules && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                onClick={() => setShowRules(false)}
            >
                <motion.div 
                    initial={{ scale: 0.8, y: 50 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.8, y: 50 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg border-[6px] border-black shadow-[12px_12px_0_#000] relative flex flex-col"
                >
                    {/* Header del Modal */}
                    <div className="flex justify-between items-center p-4 sm:p-6 border-b-[4px] border-black bg-yellow-300 sticky top-0 z-10">
                        {/* Sin Emoji */}
                        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider drop-shadow-[2px_2px_0_#fff]">
                            CÓMO JUGAR
                        </h2>
                        <button 
                            onClick={() => setShowRules(false)}
                            className="bg-white hover:bg-red-100 p-2 rounded-md border-[3px] border-black shadow-[3px_3px_0_#000] active:translate-y-1 active:shadow-none transition-all"
                        >
                            <X className="w-6 h-6 sm:w-8 sm:h-8 stroke-[3px]" />
                        </button>
                    </div>

                    {/* Contenido del Modal (TEXTOS ACTUALIZADOS) */}
                    <div className="p-6 space-y-6 text-lg sm:text-xl font-medium leading-relaxed">
                        <section>
                            <h3 className="font-black text-xl mb-2 bg-[#8e0dff] text-white inline-block px-2 border-[2px] border-black shadow-[3px_3px_0_#000] -rotate-1">1. El Objetivo</h3>
                            <p>Gana el primero que reduzca las vidas del oponente a 0.</p>
                        </section>
                        
                        <section>
                            <h3 className="font-black text-xl mb-2 bg-[#ff590d] text-white inline-block px-2 border-[2px] border-black shadow-[3px_3px_0_#000] rotate-1">2. Tu Turno</h3>
                            <p>Coloca tantas cartas como quieras en los 4 huecos que tienes disponibles.</p>
                            <p className="mt-2">Cuando termines, pulsa <span className="font-bold text-green-600">"PLANTARSE"</span>. El rival jugará después. Cuando ambos paséis, ¡comienza la fase de pelea!</p>
                        </section>

                        <section>
                            <h3 className="font-black text-xl mb-2 bg-yellow-400 text-black inline-block px-2 border-[2px] border-black shadow-[3px_3px_0_#000] -rotate-1">3. Fase de Pelea</h3>
                            <ul className="list-disc pl-5 space-y-2 text-base sm:text-lg">
                                <li>Las cartas se enfrentan cara a cara. La carta con el número más alto gana y destruye a la otra.</li>
                                <li>Si tu carta se enfrenta a un hueco vacío directamente, le haces <strong>1 punto de daño</strong> directo.</li>
                                <li className="pt-2"><strong>👑 El Rey (K):</strong> Ataca a las 3 posiciones que tiene en frente a la vez.</li>
                                <li><strong>👸 La Reina (Q):</strong> Ataca a las 2 posiciones en diagonal a la vez.</li>
                                <li><strong>🤴 El Príncipe (J):</strong> Ataca 1 posición aleatoria entre las que tiene en frente.</li>
                                <li><strong>🃏 El Joker:</strong> No hace daño, pero te permite robar 2 cartas extra.</li>
                            </ul>
                        </section>
                    </div>
                    {/* Eliminado el footer de "Buena suerte" */}
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* --- BOTÓN DE INFORMACIÓN (POSICIÓN ACTUALIZADA) --- */}
      {/* Ajustado a bottom-28 (aprox encima del footer de 24) y a la izquierda */}
      <motion.button
        onClick={() => setShowRules(true)}
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-28 sm:bottom-32 left-4 z-50 w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full border-[3px] border-black shadow-[3px_3px_0_#000] flex items-center justify-center hover:bg-yellow-100 transition-colors"
      >
        <Info className="w-6 h-6 sm:w-8 sm:h-8 stroke-[3px]" />
      </motion.button>


      {/* 1. HEADER (RIVAL - NARANJA #ff590d) */}
      <header className="flex-none h-16 sm:h-20 p-4 flex justify-between items-center relative z-10 border-b-[4px] border-black bg-[#ff590d] shadow-[0_6px_0_#000]">
        <div className="flex gap-4 items-center relative">
            {/* Mazo Rival */}
            <div className="relative w-10 h-14 sm:w-12 sm:h-16 bg-[#ff590d] rounded-md border-[3px] border-black flex items-center justify-center shadow-[4px_4px_0_#000]">
                <span className="z-10 font-black text-white text-xl drop-shadow-[2px_2px_0_#000]">{opponent.deck.length}</span>
            </div>
            {/* Mano Rival */}
            <div className="flex -space-x-5 sm:-space-x-7 pl-2">
                {opponent.hand.map((c, i) => (
                    <div key={c.id} className="w-8 h-11 sm:w-10 sm:h-14 bg-[#ff590d] rounded-sm border-[3px] border-black shadow-[3px_3px_0_#000] relative pattern-diagonal-lines-sm text-black/30" style={{ zIndex: i, transform: `rotate(${(i - 1) * 8}deg)` }}></div>
                ))}
            </div>
        </div>
        
        {/* Cartel Central */}
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-50">
          <div className={clsx(
            "px-6 py-2 rounded-md text-xl sm:text-2xl font-black tracking-wider transition-all shadow-[6px_6px_0_#000] uppercase border-[4px] border-black whitespace-nowrap relative -rotate-2",
            (phase === 'combat' || phase === 'combat-reveal') ? "bg-yellow-400 text-black animate-[wiggle_0.5s_infinite]" : 
            turn === 'player' ? "bg-[#8e0dff] text-white" : "bg-white text-[#ff590d]"
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
      <section className="flex-1 flex items-center justify-center p-4 overflow-hidden min-h-0 relative py-4 sm:py-8">
        
        <div className="w-full max-w-lg bg-white rounded-lg border-[6px] border-black shadow-[12px_12px_0_#000] relative flex flex-col p-4 shrink-0">
          
          {/* LADO RIVAL */}
          <div className="flex-1 grid grid-cols-4 gap-2 sm:gap-4 items-center justify-items-center">
            {opponent.board.map((slot) => (
              <div key={`opp-${slot.index}`} className={slotStyle}>
                <AnimatePresence mode="popLayout">
                  {slot.card && <Card key={slot.card.id} card={slot.card} className="z-10" />}
                </AnimatePresence>
                
                {/* DAÑO FLOTANTE RIVAL */}
                {recentDamage?.opponentSlots[slot.index] !== undefined && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                        animate={{ opacity: 1, scale: 1.2, rotate: 0 }} 
                        exit={{ opacity: 0, scale: 0 }}
                        className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
                    >
                        <div className="relative flex items-center justify-center">
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
                                <span className="text-4xl text-[#8e0dff] animate-bounce font-black">+</span>
                            </div>
                        )}
                      </motion.div>
                  )}
                </AnimatePresence>
                 
                 {recentDamage?.playerSlots[slot.index] !== undefined && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.5, rotate: 45 }}
                        animate={{ opacity: 1, scale: 1.2, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0 }}
                        className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
                    >
                        <div className="relative flex items-center justify-center">
                             <span className="absolute inset-0 text-black text-5xl scale-125 z-0 animate-ping">💥</span>
                            <span className="text-3xl font-black text-[#8e0dff] drop-shadow-[2px_2px_0_#000] relative z-10" style={{ WebkitTextStroke: '1px black' }}>
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

      {/* 3. FOOTER (JUGADOR - MORADO #8e0dff) */}
      <section className="flex-none h-24 sm:h-28 bg-[#8e0dff] border-t-[4px] border-black relative z-20 px-4 grid grid-cols-3 items-center shadow-[0_-6px_0_#000]">
        
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

         <div className="flex items-center justify-between pl-4 pr-2">
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
            {/* Mazo Jugador - Fondo Morado */}
            <div className="relative w-10 h-14 sm:w-12 sm:h-16 bg-[#8e0dff] rounded-md border-[3px] border-black flex items-center justify-center shadow-[4px_4px_0_#000]">
                <span className="z-10 font-black text-white text-xl drop-shadow-[2px_2px_0_#000]">{player.deck.length}</span>
            </div>
         </div>
      </section>
    </main>
  );
}