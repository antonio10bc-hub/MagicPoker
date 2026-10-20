import { useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { BoardSlot, Owner } from '@/types';
import { BoardGeometry } from '@/theme/layout';
import { CARD_SIZE, PALETTE, TEAM } from '@/theme/tokens';
import { JOKER_DRAW_BONUS, TIMINGS } from '@/lib/constants';
import { duckMusic, haptic, playSfx } from '@/lib/sounds';
import { SEAL_SFX } from '@/lib/synth';
import { fx } from '@/components/fx/fxStore';
import { ARROW_HOLD_S, IMPACT_DELAY_S, SECOND_HIT_S, SHIELD_BREAK_S } from './Card';
import { getTargetIndices } from '@/lib/game-utils';
import { pausableTimeout } from '@/lib/clock';
import { useTranslations } from '@/lib/i18n';

// --- DIRECTOR DE COMBATE ---
// No dibuja nada: escucha los estados que ya publica la lógica (fase y resultado del
// combate) y coreografía sonido, partículas y cámara. No cambia tiempos ni orden de
// eventos de juego.

const IMPACT_MS = IMPACT_DELAY_S * 1000;
const HOLD_MS = ARROW_HOLD_S * 1000;

type Located = { slot: BoardSlot; owner: Owner; x: number; y: number };

const locate = (geo: BoardGeometry, boards: Record<Owner, BoardSlot[]>): Located[] =>
  (['player', 'opponent'] as Owner[]).flatMap(owner =>
    boards[owner].map(slot => {
      const p = geo.slots[owner][slot.index];
      return { slot, owner, x: p.x + CARD_SIZE.width / 2, y: p.y + CARD_SIZE.height / 2 };
    })
  );

const VOLT = '#7DFF2B';
const VOLT_BG = 'var(--ink-volt)';

export const CombatDirector = ({ geo }: { geo: BoardGeometry }) => {
  const t = useTranslations();
  const phase = useGameStore(s => s.phase);
  const combat = useGameStore(s => s.pendingCombatResult);
  const sealFx = useGameStore(s => s.sealFx);

  // 0. Sellos de antes del choque: cambios de sitio (CAMBIO) y de bando (¡ROBO!)
  useEffect(() => {
    if (!sealFx) return;
    const center = (owner: Owner, i: number) => {
      const p = geo.slots[owner][i];
      return { x: p.x + CARD_SIZE.width / 2, y: p.y + CARD_SIZE.height / 2 };
    };
    const cancels: (() => void)[] = [];
    sealFx.events.forEach((e, n) => cancels.push(pausableTimeout(() => {
      if (e.kind === 'shift') {
        const c = center(e.owner, e.to);
        playSfx('whoosh', 0.9, 1.2);
        playSfx(SEAL_SFX.shift);
        fx.emit({ kind: 'text', x: c.x, y: c.y - 18, text: t.fx_shift, bg: VOLT_BG, size: 10, life: 900 });
        fx.emit({ kind: 'ring', x: c.x, y: c.y, color: VOLT, radius: 22, life: 450 });
        // Estela entre los dos huecos
        const o = center(e.owner, e.from);
        [0.2, 0.4, 0.6, 0.8].forEach((k, j) => cancels.push(pausableTimeout(() =>
          fx.emit({ kind: 'particles', x: o.x + (c.x - o.x) * k, y: o.y + (c.y - o.y) * k, colors: [VOLT, '#D8FF9A'], count: 5, speed: 10, gravity: -6, size: [1, 2], life: 500 }), j * 90)));
      } else if (e.kind === 'anchor') {
        // Ancla: la carta no se mueve
        const c = center(e.owner, e.index);
        playSfx(SEAL_SFX.anchor);
        fx.shake(1.2);
        fx.emit({ kind: 'text', x: c.x, y: c.y - 18, text: t.fx_anchor, bg: VOLT_BG, size: 10, life: 1000 });
        fx.emit({ kind: 'ring', x: c.x, y: c.y, color: VOLT, radius: 24, life: 500 });
        fx.emit({ kind: 'particles', x: c.x, y: c.y + 22, colors: [VOLT, PALETTE.white], count: 10, speed: 22, gravity: 40, spread: Math.PI * 0.8, angle: Math.PI / 2, size: [1, 2], life: 500 });
      } else if (e.kind === 'reveal') {
        // Revelar: la carta se da la vuelta y queda expuesta
        const c = center(e.owner, e.index);
        playSfx(SEAL_SFX.reveal);
        playSfx('flip', 0.9, 0.9);
        fx.emit({ kind: 'text', x: c.x, y: c.y - 20, text: t.fx_reveal, bg: VOLT_BG, size: 11, life: 1100 });
        fx.emit({ kind: 'ring', x: c.x, y: c.y, color: VOLT, radius: 28, life: 550 });
        fx.emit({ kind: 'ring', x: c.x, y: c.y, color: PALETTE.white, radius: 18, life: 400 });
      } else {
        const a = center('player', e.index);
        const b = center('opponent', e.index);
        playSfx('swing', 1, 1.3);
        playSfx(SEAL_SFX.swap);
        fx.flash(0.25);
        fx.emit({ kind: 'text', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, text: t.fx_swap, bg: VOLT_BG, size: 14, life: 1000 });
        [a, b].forEach(c => fx.emit({ kind: 'particles', x: c.x, y: c.y, colors: [VOLT, PALETTE.white], count: 12, speed: 34, gravity: -10, size: [1, 2], life: 600 }));
      }
    }, n * 160)));
    return () => cancels.forEach(c => c());
  }, [sealFx, geo, t]);

  // 1. Arranca la pelea: tambor, sacudida, zoom; luego volteo de cartas rivales y Jokers
  useEffect(() => {
    if (phase !== 'combat') return;
    playSfx('fight');
    duckMusic(0.35, 0.6);
    fx.shake(1.6);
    fx.punch(0.045);

    const cancelReveal = pausableTimeout(() => {
      const { player, opponent } = useGameStore.getState();
      opponent.board.forEach((s, i) => { if (s.card) pausableTimeout(() => playSfx('flip', 0.8, 1 + i * 0.06), i * 60); });
      locate(geo, { player: player.board, opponent: opponent.board })
        .filter(l => l.slot.card?.rank === 'JOKER')
        .forEach(l => {
          playSfx('sparkle');
          fx.emit({ kind: 'text', x: l.x, y: l.y - 20, text: `+${JOKER_DRAW_BONUS}`, bg: 'var(--c-chip)', size: 20, life: 1100 });
          fx.emit({ kind: 'particles', x: l.x, y: l.y, colors: [PALETTE.yellow, PALETTE.white], count: 14, speed: 30, gravity: -10, size: [1, 2], life: 800 });
        });
    }, TIMINGS.combatFlip + 20);
    return cancelReveal;
  }, [phase, geo]);

  // 2. Resultado: embestidas → impacto (cartas rotas, daño directo, As)
  useEffect(() => {
    if (!combat) return;
    const timers: (() => void)[] = [];
    const later = (ms: number, f: () => void) => timers.push(pausableTimeout(f, ms));
    const { player, opponent } = useGameStore.getState();
    const cards = locate(geo, { player: player.board, opponent: opponent.board });

    // El As: onda expansiva que barre el tablero
    if (combat.voidedCardIds.length > 0) {
      const ace = cards.find(l => l.slot.card?.rank === 'A') ?? cards[0];
      if (ace) fx.focus(ace.x, ace.y, 1.08, HOLD_MS / 1000 + 0.9);
      later(HOLD_MS, () => playSfx('wipe'));
      later(HOLD_MS + 250, () => {
        fx.flash(0.9);
        fx.shake(4);
        fx.punch(0.07);
        duckMusic(0.6, 0.9);
        haptic('wipe');
        if (ace) {
          fx.emit({ kind: 'ring', x: ace.x, y: ace.y, color: PALETTE.cyan, radius: 160, life: 700 });
          fx.emit({ kind: 'ring', x: ace.x, y: ace.y, color: PALETTE.white, radius: 110, life: 550 });
        }
        cards.filter(l => l.slot.card).forEach(l =>
          fx.emit({ kind: 'particles', x: l.x, y: l.y, colors: [PALETTE.cyan, PALETTE.white, PALETTE.navy], count: 12, speed: 40, gravity: -20, life: 800 }));
      });
      return () => timers.forEach(c => c());
    }

    const attackers = cards.filter(l => l.slot.card && l.slot.card.rank !== 'JOKER');
    if (attackers.length > 0) later(HOLD_MS, () => playSfx('swing'));
    // Sello de ataque: "x2" sobre la carta y dos impactos seguidos en sus objetivos
    attackers.filter(l => l.slot.card?.seal === 'double').forEach(l => {
      later(HOLD_MS - 150, () => fx.emit({ kind: 'text', x: l.x, y: l.y - 22, text: t.fx_double, bg: VOLT_BG, size: 12, life: 900 }));
      const foe: Owner = l.owner === 'player' ? 'opponent' : 'player';
      const targets = getTargetIndices(l.slot.index, l.slot.card!.rank);
      // El Príncipe golpea uno al azar: los chispazos van al centro de sus posibles objetivos
      const spots = l.slot.card!.rank === 'J'
        ? [targets.reduce((a, b) => a + b, 0) / Math.max(1, targets.length)]
        : targets;
      [0, SECOND_HIT_S * 1000].forEach((delay, hit) => later(IMPACT_MS + delay, () => {
        if (hit === 1) { playSfx(SEAL_SFX.double); playSfx('hit', 0.9, 1.2); fx.shake(1.4); }
        spots.forEach(i => {
          const a = geo.slots[foe][Math.floor(i)];
          const b = geo.slots[foe][Math.ceil(i)];
          const x = (a.x + b.x) / 2 + CARD_SIZE.width / 2;
          const y = a.y + CARD_SIZE.height / 2;
          fx.emit({ kind: 'ring', x, y, color: VOLT, radius: hit ? 26 : 18, life: 350 });
          fx.emit({ kind: 'particles', x, y, colors: [VOLT, PALETTE.white], count: hit ? 12 : 6, speed: 36, gravity: 30, size: [1, 2], life: 450 });
          if (hit) fx.emit({ kind: 'text', x, y: y - 14, text: '2', bg: VOLT_BG, size: 11, life: 650 });
        });
      }));
    });

    // Cámara de pelea: se acerca a donde va a pasar algo (cartas que caen y golpes
    // directos) mientras se ven las flechas, y se suelta tras el impacto
    const dead = new Set(combat.deadCardIds);
    const spots = [
      ...cards.filter(l => l.slot.card && dead.has(l.slot.card.id)),
      ...Object.keys(combat.playerEmptySlotsHit).map(i => cards.find(l => l.owner === 'player' && l.slot.index === +i)!),
      ...Object.keys(combat.opponentEmptySlotsHit).map(i => cards.find(l => l.owner === 'opponent' && l.slot.index === +i)!),
    ].filter(Boolean);
    if (spots.length > 0) {
      const cx = spots.reduce((a, l) => a + l.x, 0) / spots.length;
      const cy = spots.reduce((a, l) => a + l.y, 0) / spots.length;
      // Más cerca cuanto más concentrada está la acción
      const zoom = spots.length <= 2 ? 1.14 : 1.08;
      fx.focus(cx, cy, zoom, IMPACT_DELAY_S + 0.9);
    }

    later(IMPACT_MS, () => {
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
        fx.emit({ kind: 'text', x, y, text: `-${h.amount}`, bg: h.owner === 'player' ? 'var(--c-mult)' : 'var(--c-gold)', size: 20, life: 1200 });
      }));

      // Sello de defensa: la burbuja encaja el golpe (chispas que rebotan) y luego se rompe
      const shielded = new Set(combat.shieldedIds);
      cards.filter(l => l.slot.card && shielded.has(l.slot.card.id)).forEach(l => {
        playSfx(SEAL_SFX.shield);
        // Rebote: las chispas salen hacia el atacante
        const away = l.owner === 'player' ? -Math.PI / 2 : Math.PI / 2;
        fx.emit({ kind: 'ring', x: l.x, y: l.y, color: VOLT, radius: 30, life: 500 });
        fx.emit({ kind: 'particles', x: l.x, y: l.y + (l.owner === 'player' ? -20 : 20), colors: [VOLT, PALETTE.white], count: 14, speed: 44, gravity: 0, spread: Math.PI * 0.7, angle: away, size: [1, 2], life: 500 });
        fx.emit({ kind: 'text', x: l.x, y: l.y - 18, text: t.fx_block, bg: VOLT_BG, size: 11, life: 1000 });
        later((SHIELD_BREAK_S - IMPACT_DELAY_S) * 1000, () => {
          playSfx('crush', 0.7, 1.5);
          playSfx('sparkle', 0.6);
          fx.emit({ kind: 'ring', x: l.x, y: l.y, color: VOLT, radius: 36, life: 420 });
          // Pedazos de escudo que caen
          fx.emit({ kind: 'particles', x: l.x, y: l.y, colors: [VOLT, '#4FC414', '#D8FF9A'], count: 22, speed: 50, gravity: 90, size: [2, 3], life: 800 });
        });
      });
      // Espejo: el golpe vuelve al atacante (rayo de la carta con espejo al atacante)
      combat.reflected.forEach(({ mirrorId, attackerId }, i) => {
        const m = cards.find(l => l.slot.card?.id === mirrorId);
        const a = cards.find(l => l.slot.card?.id === attackerId);
        if (!m) return;
        later(i * 80, () => {
          playSfx(SEAL_SFX.mirror);
          fx.emit({ kind: 'text', x: m.x, y: m.y - 18, text: t.fx_mirror, bg: VOLT_BG, size: 11, life: 1000 });
          fx.emit({ kind: 'ring', x: m.x, y: m.y, color: VOLT, radius: 26, life: 420 });
          if (a) [0.25, 0.5, 0.75, 1].forEach((k, j) => later(j * 40, () =>
            fx.emit({ kind: 'particles', x: m.x + (a.x - m.x) * k, y: m.y + (a.y - m.y) * k, colors: [VOLT, PALETTE.white], count: 5, speed: 12, gravity: 0, size: [1, 2], life: 350 })));
        });
      });
      // Veneno: quien mató a la carta envenenada cae con ella
      const poisoned = new Set(combat.poisonedIds);
      cards.filter(l => l.slot.card && poisoned.has(l.slot.card.id)).forEach((l, i) => later(160 + i * 90, () => {
        playSfx(SEAL_SFX.poison);
        fx.emit({ kind: 'text', x: l.x, y: l.y - 18, text: t.fx_poison, bg: VOLT_BG, size: 11, life: 1100 });
        fx.emit({ kind: 'particles', x: l.x, y: l.y, colors: [VOLT, '#4FC414', PALETTE.outline], count: 16, speed: 20, gravity: -25, size: [1, 3], life: 900 });
      }));
      // Eco: la carta caída dejará un 2 en su hueco
      victims.filter(l => l.slot.card?.seal === 'echo').forEach((l, i) => later(260 + i * 90, () => {
        playSfx(SEAL_SFX.echo);
        fx.emit({ kind: 'text', x: l.x, y: l.y - 16, text: `${t.fx_echo} → 2`, bg: VOLT_BG, size: 11, life: 1200 });
        [14, 22, 30].forEach((r, j) => later(j * 110, () => fx.emit({ kind: 'ring', x: l.x, y: l.y, color: VOLT, radius: r, life: 450 })));
      }));

      // Bomba: estalla al caer y golpea los huecos rivales de al lado
      const exploded = new Set(combat.explodedIds ?? []);
      cards.filter(l => l.slot.card && exploded.has(l.slot.card.id)).forEach((l, i) => later(140 + i * 120, () => {
        playSfx('wipe', 0.7, 1.4);
        fx.shake(3);
        fx.flash(0.3);
        fx.emit({ kind: 'ring', x: l.x, y: l.y, color: PALETTE.yellow, radius: 46, life: 450 });
        fx.emit({ kind: 'particles', x: l.x, y: l.y, colors: [PALETTE.yellow, PALETTE.roof, PALETTE.white, PALETTE.outline], count: 26, speed: 60, gravity: 40, size: [1, 3], life: 700 });
        fx.emit({ kind: 'text', x: l.x, y: l.y - 18, text: t.fx_bomb, bg: 'var(--c-gold)', size: 12, life: 900 });
      }));
      // Sacerdotisa: si sigue en pie, una vida para su dueño
      const blessed = new Set(combat.blessedIds ?? []);
      cards.filter(l => l.slot.card && blessed.has(l.slot.card.id)).forEach((l, i) => later(300 + i * 90, () => {
        playSfx('score', 0.7, 1.3);
        fx.emit({ kind: 'text', x: l.x, y: l.y - 16, text: t.fx_life, bg: 'var(--ink-cream)', size: 12, life: 1200 });
        fx.emit({ kind: 'particles', x: l.x, y: l.y, colors: [PALETTE.white, PALETTE.yellow], count: 14, speed: 24, gravity: -60, spread: Math.PI * 0.6, angle: -Math.PI / 2, size: [1, 2], life: 1000 });
      }));

      // Sello de vida: la carta cae pero devuelve una vida a su dueño
      victims.filter(l => l.slot.card?.seal === 'life').forEach((l, i) => later(220 + i * 90, () => {
        playSfx(SEAL_SFX.life);
        fx.emit({ kind: 'ring', x: l.x, y: l.y, color: VOLT, radius: 28, life: 500 });
        fx.emit({ kind: 'text', x: l.x, y: l.y - 16, text: t.fx_life, bg: VOLT_BG, size: 14, life: 1300 });
        // El alma de la carta sube hacia las vidas
        fx.emit({ kind: 'particles', x: l.x, y: l.y, colors: [VOLT, '#D8FF9A', PALETTE.white], count: 20, speed: 26, gravity: -70, spread: Math.PI * 0.6, angle: -Math.PI / 2, size: [1, 3], life: 1100 });
      }));

      const impact = victims.length + hits.length;
      if (impact > 0) {
        fx.shake(Math.min(4.5, 1.5 + impact * 0.6));
        fx.punch(0.025);
        duckMusic(0.45, 0.4);
        // Vibración con significado: pierdes cartas, ganas el choque o solo hay daño
        const lostMine = victims.some(l => l.owner === 'player');
        haptic(lostMine ? 'clashLose' : victims.length > 0 ? 'clashWin' : 'hitRival');
        if (victims.length > 0) fx.flash(0.35);
      } else {
        playSfx('hit', 0.6);
      }
    });

    return () => timers.forEach(c => c());
  }, [combat, geo, t]);

  return null;
};
