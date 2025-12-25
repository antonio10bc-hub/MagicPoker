'use client';

import { useGameStore } from '@/store/useGameStore';
import { useEffect } from 'react';

export default function Home() {
  const { startGame } = useGameStore();

  // Iniciar juego al cargar (temporal para dev)
  useEffect(() => {
    startGame();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-slate-100 p-4">
      <div className="max-w-4xl w-full flex flex-col gap-8">
        
        {/* HEADER: Vidas y Estado */}
        <div className="flex justify-between items-center text-xl font-bold">
          <div className="text-red-400">Rival: 4 ❤</div>
          <div className="text-blue-400">Tú: 4 ❤</div>
        </div>

        {/* TABLERO DE JUEGO (Grid 4x2) */}
        {/* Usamos perspective para efectos 3D sutiles en el futuro */}
        <div className="relative bg-slate-800 rounded-xl p-8 shadow-2xl border border-slate-700">
          
          {/* Lado del Oponente */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={`opp-${i}`} className="aspect-[2/3] bg-slate-700/50 rounded-lg border-2 border-dashed border-slate-600 flex items-center justify-center">
                <span className="text-xs text-slate-500">Slot {i+1}</span>
              </div>
            ))}
          </div>

          {/* Línea divisoria central */}
          <div className="h-0.5 w-full bg-slate-600/50 my-2"></div>

          {/* Tu Lado */}
          <div className="grid grid-cols-4 gap-4 mt-4">
             {[0, 1, 2, 3].map((i) => (
              <div key={`player-${i}`} className="aspect-[2/3] bg-slate-700/30 rounded-lg border-2 border-dashed border-slate-600 hover:border-blue-500/50 transition-colors cursor-pointer flex items-center justify-center">
                 <span className="text-xs text-slate-500">Slot {i+1}</span>
              </div>
            ))}
          </div>

        </div>

        {/* TU MANO */}
        <div className="flex justify-center gap-2 h-32 items-end">
           {/* Placeholder de cartas en mano */}
           {[1, 2, 3].map((c) => (
             <div key={c} className="w-20 h-28 bg-blue-600 rounded-lg border border-blue-400 shadow-lg transform hover:-translate-y-4 transition-transform cursor-pointer"></div>
           ))}
        </div>

        {/* CONTROLES */}
        <div className="flex justify-center gap-4">
          <button className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold shadow-lg transition-all">
            Pasar Turno
          </button>
        </div>

      </div>
    </main>
  );
}