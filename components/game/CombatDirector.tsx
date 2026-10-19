import { useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { BoardSlot, Owner } from '@/types';
import { BoardGeometry } from '@/theme/layout';
import { CARD_SIZE, PALETTE, TEAM } from '@/theme/tokens';
import { JOKER_DRAW_BONUS, TIMINGS } from '@/lib/constants';
import { duckMusic, playSfx, vibrate } from '@/lib/sounds';
import { fx } from '@/components/fx/fxStore';
import { IMPACT_DELAY_S } from './Card';

// --- DIRECTOR DE COMBATE ---
// No dibuja nada: escucha los estados que ya publica la lógica (fase y resultado del
// combate) y coreografía sonido, partículas y cámara. No cambia tiempos ni orden de
// eventos de juego.

const IMPACT_MS = IMPACT_DELAY_S * 1000;

type Located = { slot: BoardSlot; owner: Owner; x: number; y: number };

const locate = (geo: BoardGeometry, boards: Record<Owner, BoardSlot[]>): Located[] =>
  (['player', 'opponent'] as Owner[]).flatMap(owner =>
    boards[owner].map(slot => {
      const p = geo.slots[owner][slot.index];
      return { slot, owner, x: p.x + CARD_SIZE.width / 2, y: p.y + CARD_SIZE.height / 2 };
    })
  );

export const CombatDirector = ({ geo }: { geo: BoardGeometry }) => {
  const phase = useGameStore(s => s.phase);
  const combat = useGameStore(s => s.pendingCombatResult);

  // 1. Arranca la pelea: tambor, sacudida, zoom; luego volteo de cartas rivales y Jokers
  useEffect(() => {
    if (phase !== 'combat') return;
    playSfx('fight');
    duckMusic(0.35, 0.6);
    fx.shake(1.6);
    fx.punch(0.045);

    const reveal = setTimeout(() => {
      const { player, opponent } = useGameStore.getState();
      opponent.board.forEach((s, i) => { if (s.card) setTimeout(() => playSfx('flip', 0.8, 1 + i * 0.06), i * 60); });
      locate(geo, { player: player.board, opponent: opponent.board })
        .filter(l => l.slot.card?.rank === 'JOKER')
        .forEach(l => {
          playSfx('sparkle');
          fx.emit({ kind: 'text', x: l.x, y: l.y - 20, text: `+${JOKER_DRAW_BONUS}`, color: 'var(--c-yellow)', size: 20, life: 1100 });
          fx.emit({ kind: 'particles', x: l.x, y: l.y, colors: [PALETTE.yellow, PALETTE.white], count: 14, speed: 30, gravity: -10, size: [1, 2], life: 800 });
        });
    }, TIMINGS.combatFlip + 20);
    return () => clearTimeout(reveal);
  }, [phase, geo]);

  // 2. Resultado: embestidas → impacto (cartas rotas, daño directo, As)
  useEffect(() => {
    if (!combat) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, f: () => void) => timers.push(setTimeout(f, ms));
    const { player, opponent } = useGameStore.getState();
    const cards = locate(geo, { player: player.board, opponent: opponent.board });

    // El As: onda expansiva que barre el tablero
    if (combat.voidedCardIds.length > 0) {
      const ace = cards.find(l => l.slot.card?.rank === 'A') ?? cards[0];
      playSfx('wipe');
      later(250, () => {
        fx.flash(0.9);
        fx.shake(4);
        fx.punch(0.07);
        duckMusic(0.6, 0.9);
        vibrate([30, 40, 60]);
        if (ace) {
          fx.emit({ kind: 'ring', x: ace.x, y: ace.y, color: PALETTE.cyan, radius: 160, life: 700 });
          fx.emit({ kind: 'ring', x: ace.x, y: ace.y, color: PALETTE.white, radius: 110, life: 550 });
        }
        cards.filter(l => l.slot.card).forEach(l =>
          fx.emit({ kind: 'particles', x: l.x, y: l.y, colors: [PALETTE.cyan, PALETTE.white, PALETTE.navy], count: 12, speed: 40, gravity: -20, life: 800 }));
      });
      return () => timers.forEach(clearTimeout);
    }

    const attackers = cards.filter(l => l.slot.card && l.slot.card.rank !== 'JOKER');
    if (attackers.length > 0) playSfx('swing');

    later(IMPACT_MS, () => {
      const dead = new Set(combat.deadCardIds);
      const victims = cards.filter(l => l.slot.card && dead.has(l.slot.card.id));
      victims.forEach((l, i) => later(i * 55, () => {
        playSfx('crush', 0.9, 1 - i * 0.04);
        const team = TEAM[l.owner];
        fx.emit({ kind: 'particles', x: l.x, y: l.y, colors: [team.base, team.light, PALETTE.white, PALETTE.outline], count: 18, speed: 46, gravity: 60, size: [1, 3], life: 750 });
        fx.emit({ kind: 'ring', x: l.x, y: l.y, color: PALETTE.white, radius: 26, life: 380 });
      }));

      // Daño directo a huecos vacíos
      const hits: { owner: Owner; index: number; amount: number }[] = [
        ...Object.entries(combat.playerEmptySlotsHit).map(([i, n]) => ({ owner: 'player' as Owner, index: +i, amount: n })),
        ...Object.entries(combat.opponentEmptySlotsHit).map(([i, n]) => ({ owner: 'opponent' as Owner, index: +i, amount: n })),
      ];
      hits.forEach((h, i) => later(i * 70, () => {
        const p = geo.slots[h.owner][h.index];
        const x = p.x + CARD_SIZE.width / 2;
        const y = p.y + CARD_SIZE.height / 2;
        playSfx('zap', 0.9, h.owner === 'player' ? 0.85 : 1.1);
        fx.emit({ kind: 'particles', x, y, colors: [PALETTE.yellow, PALETTE.white, PALETTE.roof], count: 16, speed: 38, gravity: 30, life: 650 });
        fx.emit({ kind: 'ring', x, y, color: PALETTE.yellow, radius: 22, life: 400 });
        fx.emit({ kind: 'text', x, y, text: `-${h.amount}`, color: h.owner === 'player' ? 'var(--c-red)' : 'var(--c-yellow)', size: 20, life: 1100 });
      }));

      const impact = victims.length + hits.length;
      if (impact > 0) {
        fx.shake(Math.min(4.5, 1.5 + impact * 0.6));
        fx.punch(0.025);
        duckMusic(0.45, 0.4);
        vibrate(victims.length > 0 ? 35 : 20);
        if (victims.length > 0) fx.flash(0.35);
      } else {
        playSfx('hit', 0.6);
      }
    });

    return () => timers.forEach(clearTimeout);
  }, [combat, geo]);

  return null;
};
