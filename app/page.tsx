'use client';

import { useGameStore } from '@/store/useGameStore';
import { Card } from '@/components/game/Card';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const { 
    player, opponent, turn, phase, recentDamage,
    startGame, resetGame, placeCard, passTurn 
  } = useGameStore();

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  useEffect(() => {
    startGame();
  }, []);

  const handleHandCardClick = (id: string) => {
    if (turn !== 'player' || player.isPassed || phase !== 'placement') return;
    setSelectedCardId(prev => prev === id ? null : id);
  };

  const handleBoardSlotClick = (slotIndex: number) => {
    if (!selectedCardId) return;
    placeCard(selectedCardId, slotIndex);
    setSelectedCardId(null);
  };

  const canPass = turn === 'player' && !player.isPassed && phase === 'placement';
  // Lógica del texto del botón
  const passButtonText = opponent.isPassed ? "RESOLVER" : "PLANTARSE";
  const passButtonColor = opponent.isPassed 
    ? "bg-amber-600 hover:bg-amber-500 border-amber-400" 
    : "bg-emerald-600 hover:bg-emerald-500 border-emerald-400";

  // --- MODAL FIN ---
  if (phase === 'end') {
    const playerWon = opponent.lives === 0;
    return (
        <main className="h-svh w-full flex items-center justify-center bg-slate-950 text-slate-100 relative select-none">
            <div className="bg-slate-900 p-8 rounded-2xl border border-slate-700 shadow-2xl text-center max-w-md w-full mx-4 flex flex-col gap-6">
                <h1 className={clsx("text-4xl font-bold", playerWon ? "text-emerald-400" : "text-red-500")}>
                    {playerWon ? "¡VICTORIA! 🏆" : "DERROTA 💀"}
                </h1>
                <button onClick={resetGame} className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-colors">
                    Jugar Otra Vez
                </button>
            </div>
        </main>
    )
  }

  // --- JUEGO ---
  return (
    <main className="h-svh w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative select-none">
      
      {/* 1. ZONA SUPERIOR (Rival) */}
      <header className="flex-none h-20 sm:h-24 p-4 flex justify-between items-start relative z-10 bg-slate-900/50 backdrop-blur-sm border-b border-white/5">
        
        {/* IZQUIERDA: Mazo y Mano Rival */}
        <div className="flex gap-4 items-center">
             {/* Mazo Rival */}
            <div className="relative w-10 h-14 sm:w-14 sm:h-20 bg-red-900 rounded border border-red-700 flex items-center justify-center shadow-lg">
                <div className="absolute inset-0 bg-red-900/50 rounded animate-pulse"></div>
                <span className="z-10 font-bold text-red-200 text-xs sm:text-base">{opponent.deck.length}</span>
            </div>
            {/* Mano Rival */}
            <div className="flex -space-x-6 sm:-space-x-8 pl-2">
                {opponent.hand.map((c, i) => (
                    <div key={c.id} className="w-8 h-12 sm:w-12 sm:h-16 bg-red-950 rounded border border-red-800 shadow-md relative" style={{ zIndex: i }}></div>
                ))}
            </div>
        </div>

        {/* CENTRO: CARTEL DE TURNO */}
        <div className="absolute left-1/2 -translate-x-1/2 top-4 sm:top-6 z-50">
          <div className={clsx(
            "px-6 py-2 rounded-xl text-lg sm:text-2xl font-black tracking-widest transition-all shadow-2xl uppercase border-2 whitespace-nowrap",
            phase === 'combat' ? "bg-purple-600 text-white border-purple-400 animate-pulse scale-110" : 
            turn === 'player' ? "bg-blue-600 text-white border-blue-400" : "bg-red-600 text-white border-red-400"
          )}>
            {phase === 'combat' ? "COMBATE" : turn === 'player' ? "TU TURNO" : "RIVAL"}
          </div>
        </div>

        {/* DERECHA: Vidas Rival */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] sm:text-xs text-red-400 font-bold uppercase tracking-wider mb-1">Rival</span>
          <div className="flex text-xl sm:text-2xl text-red-500 gap-1 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
            {Array(4).fill(0).map((_, i) => (
              <span key={i} className={i < opponent.lives ? "opacity-100" : "opacity-20 blur-[2px]"}>❤</span>
            ))}
          </div>
        </div>
      </header>


      {/* 2. TABLERO CENTRAL */}
      <section className="flex-1 flex items-center justify-center p-4 overflow-hidden min-h-0">
        <div className="w-full max-w-2xl aspect-[5/4] bg-slate-900/60 rounded-xl border border-slate-800 shadow-2xl relative flex flex-col p-4 backdrop-blur-sm shrink-0">
          
          {/* LADO RIVAL */}
          <div className="flex-1 grid grid-cols-4 gap-2 items-center">
            {opponent.board.map((slot) => (
              <div key={`opp-${slot.index}`} className="w-full h-full relative flex items-center justify-center bg-slate-800/30 rounded border border-white/5">
                <AnimatePresence mode="popLayout">
                  {slot.card && <Card key={slot.card.id} card={slot.card} className="z-10" />}
                </AnimatePresence>
                
                {recentDamage?.opponentSlots.includes(slot.index) && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.5, y: 0 }}
                        animate={{ opacity: 1, scale: 1.5, y: -20 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
                    >
                        <span className="text-4xl font-black text-red-500 drop-shadow-[0_0_15px_rgba(255,0,0,1)] stroke-black">-1</span>
                    </motion.div>
                )}
              </div>
            ))}
          </div>

          {/* SEPARADOR */}
          <div className="h-px w-full bg-slate-700/50 my-2 flex justify-center items-center">
             <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
          </div>

          {/* LADO JUGADOR */}
          <div className="flex-1 grid grid-cols-4 gap-2 items-center">
            {player.board.map((slot) => (
              <div key={`player-${slot.index}`} className="w-full h-full relative flex items-center justify-center bg-slate-800/30 rounded border border-white/5">
                <AnimatePresence mode="popLayout">
                  {slot.card ? (
                     <Card key={slot.card.id} card={slot.card} className="z-10" />
                  ) : (
                     <motion.div 
                        key="empty"
                        onClick={() => handleBoardSlotClick(slot.index)}
                        className={clsx(
                          "absolute inset-0 rounded border-2 border-dashed transition-all cursor-pointer",
                          (selectedCardId) ? "border-blue-400/60 bg-blue-500/10 hover:bg-blue-500/20" : "border-slate-700/30 hover:border-slate-600"
                        )}
                      />
                  )}
                </AnimatePresence>

                 {recentDamage?.playerSlots.includes(slot.index) && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.5, y: 0 }}
                        animate={{ opacity: 1, scale: 1.5, y: 20 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
                    >
                        <span className="text-4xl font-black text-red-500 drop-shadow-[0_0_15px_rgba(255,0,0,1)]">-1</span>
                    </motion.div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* 3. ZONA INFERIOR */}
      <section className="flex-none h-32 bg-slate-900 border-t border-slate-800 relative z-20 px-4 grid grid-cols-3 items-center">
        
        {/* IZQUIERDA: VIDAS */}
        <div className="flex flex-col items-start justify-center pl-2 sm:pl-8">
             <div className="flex text-2xl sm:text-3xl text-blue-500 gap-1 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">
                {Array(4).fill(0).map((_, i) => (
                <span key={i} className={i < player.lives ? "opacity-100" : "opacity-20 text-slate-700"}>❤</span>
                ))}
            </div>
            <span className="text-[10px] sm:text-xs text-blue-400 font-bold uppercase mt-1">Tus Vidas</span>
        </div>

        {/* CENTRO: MANO */}
        <div className="flex justify-center items-center h-full pb-2">
             <div className="flex justify-center gap-2 h-20 w-full">
                <AnimatePresence>
                {player.hand.map((card) => (
                    // Animación de robo de carta (aparece desde abajo-derecha)
                    <motion.div 
                        key={card.id} 
                        initial={{ opacity: 0, y: 50, scale: 0.5, x: 20 }}
                        animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="h-full aspect-[2/3]"
                    >
                        <Card 
                            card={card} 
                            onClick={() => handleHandCardClick(card.id)}
                            isSelected={selectedCardId === card.id}
                        />
                    </motion.div>
                ))}
                </AnimatePresence>
             </div>
        </div>

         {/* DERECHA: BOTÓN Y MAZO */}
         <div className="flex items-center justify-end pr-2 sm:pr-8 gap-4 sm:gap-6">
            
            {/* 1. Botón Plantarse/Resolver */}
            <div className="w-24 flex justify-end">
                <AnimatePresence>
                {canPass && (
                    <motion.button 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={passTurn}
                        className={clsx(
                            "px-4 py-2 text-white rounded-lg font-bold shadow-lg text-xs sm:text-sm border hover:scale-105 transition-all whitespace-nowrap",
                            passButtonColor
                        )}
                    >
                        {passButtonText}
                    </motion.button>
                )}
                </AnimatePresence>
            </div>

            {/* 2. Mazo */}
            <div className="flex flex-col items-center group cursor-help">
                <div className="relative w-12 h-16 sm:w-14 sm:h-20 bg-blue-900 rounded-lg border-2 border-slate-500 flex items-center justify-center shadow-xl">
                    <div className="absolute -top-1 -right-1 w-full h-full bg-blue-900 rounded-lg border border-slate-600 -z-10"></div>
                    <span className="text-xl font-bold text-white">{player.deck.length}</span>
                </div>
                <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase mt-1">Mazo</span>
            </div>

         </div>

      </section>
    </main>
  );
}