import { ReactNode, useEffect, useRef, useState } from 'react';
import { markSeen } from '@/components/pixel/NewDot';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import { useUiStore } from '@/store/useUiStore';
import { useGameStore } from '@/store/useGameStore';
import { Translations, useTranslations } from '@/lib/i18n';
import { playSfx, playSound } from '@/lib/sounds';
import { createCard, createSealCard, createWildSealCard, isBoardEmpty, LEGENDARY_RANKS, RANKS } from '@/lib/game-utils';
import { BOSSES, bossWins, getProgress, isBossVisible, isCastleUnlocked, resetProgress, unlockedBacks, unlockedSeals, WINS_FOR_BACK } from '@/lib/bosses';
import { DEFAULT_BACK, setBack, usePlayerBack } from '@/lib/cosmetics';
import { Card, CardBack } from '@/components/game/Card';
import { BoonChooser } from '@/components/game/BoonChooser';
import { CASTLE_BACKS, castleBacks, CHALLENGES, ChallengeId, ensureRun, getCastle, resumeCheckpoint, Rarity, CardTemplate, RunSummary } from '@/lib/castle';
import { MerchantFigure } from '@/components/game/MerchantScene';
import { ChestReveal } from '@/components/game/ChestReveal';
import { MiniCard, RunStatus } from '@/components/game/RunStatus';
import { CastleMap } from '@/components/game/CastleMap';
import { ForestFigure, TIER_INK, TIER_RGB } from '@/components/game/ForestFigure';
import { Archetype, archetypesOf, forestDeckConfig, getForest, recordOf, TIERS } from '@/lib/forest';
import { RARITY_UI } from '@/components/game/BoonChooser';
import {
  clearDeckConfig, DECK_SLOTS, DeckConfig, defaultDeckConfig, getActiveSlot, getDeckConfig, MAX_COPIES, setActiveSlot, MAX_REMOVED, MAX_SEALS, REMOVABLE,
  copyDeck, readCopiedDeck, sanitizeDeckConfig, saveDeckConfig, totalSeals,
} from '@/lib/deck';
import { updateSettings } from '@/lib/settings';
import { isDebug, lockAll, replayPrologue, unlockAll } from '@/lib/debug';
import { track } from '@/lib/analytics';
import { useSettings } from '@/hooks/useSettings';
import { Card as CardType, Rank, SealId } from '@/types';
import { PxButton } from '@/components/pixel/ui';
import { useStage } from '@/components/pixel/Stage';
import { PixelSprite, Sprite } from '@/components/pixel/PixelSprite';
import { CROWN_ICON, HEART, HEART_LOST, ICONS, SEAL_ICONS, SKULLS } from '@/components/pixel/sprites';
import { CARD_SIZE, INK } from '@/theme/tokens';
import { closeWithClick, Dialog, DialogBody, OptionRow, Section, Tabs } from './Dialog';

const sealName = (t: Translations, s: SealId) => t[`seal_${s}` as keyof Translations];
const sealDesc = (t: Translations, s: SealId) => t[`seal_${s}_desc` as keyof Translations];

/** Icono de sello: círculo verde con la silueta (apagado si no lo tienes) */
const SealDot = ({ seal, on = true }: { seal: SealId; on?: boolean }) => (
  <div className={on ? 'shrink-0 flex items-center justify-center rounded-full bloom-volt' : 'shrink-0 flex items-center justify-center rounded-full'}
    style={{ width: 18, height: 18, background: on ? 'var(--ink-volt)' : 'var(--ink-slate)' }}>
    <PixelSprite sprite={SEAL_ICONS[seal]} tint={on ? INK.black : INK.teal} />
  </div>
);

// --- PAUSA ---
// Abrir cualquier ventana en partida ya la pausa (ver useGameStore); aquí además se
// llega a las reglas y las estadísticas, y se cambia la velocidad
export const PauseModal = () => {
  const t = useTranslations();
  const speed = useSettings().speed;
  const open = (m: 'rules' | 'stats') => { playSound('click'); useUiStore.getState().openModal(m); };
  const goHome = () => {
    playSound('click');
    const { roundNumber, player, exitToMenu } = useGameStore.getState();
    if (roundNumber > 1 || !isBoardEmpty(player.board)) useUiStore.getState().openModal('exit');
    else { useUiStore.getState().closeModal(); exitToMenu(); }
  };
  return (
    <Dialog title={t.pause_title} size="sm" footer={
      <>
        <PxButton size="lg" tone="yellow" onClick={closeWithClick}>{t.resume}</PxButton>
        <div className="flex gap-[4px]">
          <PxButton size="md" className="flex-1" onClick={() => open('rules')}>{t.menu_rules}</PxButton>
          <PxButton size="md" className="flex-1" onClick={() => open('stats')}>{t.menu_stats}</PxButton>
        </div>
        <PxButton size="md" className="px-btn-ghost" onClick={goHome}>{t.exit_menu}</PxButton>
      </>
    }>
      <DialogBody scroll={false}>
        <OptionRow label={t.speed}>
          {([1, 2] as const).map(v => (
            <PxButton key={v} size="sm" tone={v === speed ? 'roof' : 'white'} data-pressed={v === speed}
              onClick={() => { playSfx('select', 0.6); updateSettings({ speed: v }); }}>
              <span className={v === speed ? 'text-outline' : undefined}>x{v}</span>
            </PxButton>
          ))}
        </OptionRow>
        {/* Depuración: ganar la partida de ahora para pasar al siguiente paso (el
            siguiente jefe del camino, el mercader y el piso de arriba del Castillo...) */}
        {isDebug() && (
          <PxButton size="md" tone="green" className="mt-[4px]" onClick={() => { playSound('click'); useUiStore.getState().closeModal(); useGameStore.getState().debugWin(); }}>
            DEBUG · Ganar esta partida
          </PxButton>
        )}
      </DialogBody>
    </Dialog>
  );
};

// --- EDITOR DE MAZO ---
export const DeckEditorModal = () => {
  const t = useTranslations();
  const [owned] = useState(() => unlockedSeals());
  useEffect(() => markSeen('deck'), []);
  const load = () => sanitizeDeckConfig(getDeckConfig() ?? defaultDeckConfig(owned), owned);
  const [config, setConfig] = useState<DeckConfig>(load);
  const [slot, setSlot] = useState(getActiveSlot);
  // Cambiar de mazo guardado: la partida usará el que esté activo
  const switchSlot = (i: number) => {
    if (i === slot) return;
    playSfx('flip', 0.7);
    setActiveSlot(i);
    setSlot(i);
    setConfig(load());
  };
  const total = totalSeals(config);
  const size = 14 - config.removed.length + total;
  // Pegar un mazo copiado (del bestiario del Bosque o de otro editor) en el mazo activo
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const paste = async () => {
    playSound('click');
    const copied = await readCopiedDeck();
    if (copied) update(copied);
    setPasteNote(copied ? t.deck_pasted : t.deck_paste_none);
    setTimeout(() => setPasteNote(null), 1600);
  };

  const update = (next: DeckConfig) => {
    const clean = sanitizeDeckConfig(next, owned);
    setConfig(clean);
    saveDeckConfig(clean);
  };
  const step = (seal: SealId, delta: number) => {
    playSfx(delta > 0 ? 'select' : 'deselect', 0.6);
    update({ ...config, seals: { ...config.seals, [seal]: Math.max(0, (config.seals[seal] ?? 0) + delta) } });
  };
  const toggleRank = (rank: Rank) => {
    const removed = config.removed.includes(rank) ? config.removed.filter(r => r !== rank) : [...config.removed, rank];
    if (removed.length > MAX_REMOVED) return;
    playSfx('select', 0.6);
    update({ ...config, removed });
  };

  return (
    <Dialog title={t.deck_title} footer={
      <div className="flex flex-wrap items-center justify-between gap-x-[6px] gap-y-[3px]">
        <span className="glow-text whitespace-nowrap" style={{ color: 'var(--ink-orange)' }}>{t.deck_size.replace('{n}', String(size))}</span>
        <span className="flex gap-[4px]">
          <PxButton size="sm" aria-label="paste deck" onClick={paste}>{pasteNote ?? t.deck_paste}</PxButton>
          <PxButton size="sm" className="px-btn-ghost" onClick={() => { playSound('click'); clearDeckConfig(); setConfig(defaultDeckConfig(owned)); }}>{t.deck_reset}</PxButton>
        </span>
      </div>
    }>
      {/* Mazos guardados */}
      <Tabs className="px-[6px] pt-[6px]" value={slot} onChange={switchSlot}
        options={Array.from({ length: DECK_SLOTS }, (_, i) => [i, t.deck_slot.replace('{n}', String(i + 1))] as [number, string])} />
      <DialogBody>
        <Section title={`${t.deck_removed} · ${config.removed.length}/${MAX_REMOVED}`}>
          <p className="t-note mb-[4px]">{t.deck_removed_hint}</p>
          <div className="grid grid-cols-7 gap-[3px] justify-items-center">
            {REMOVABLE.map(rank => {
              const out = config.removed.includes(rank);
              return (
                <PxButton key={rank} aria-label={`remove ${rank}`} data-pressed={out} tone={out ? 'roof' : 'white'} className="w-[24px] h-[22px]"
                  disabled={!out && config.removed.length >= MAX_REMOVED} onClick={() => toggleRank(rank)}>
                  <span className="font-display" style={{ fontSize: rank === 'JOKER' || rank === '10' ? 10 : 13, textDecoration: out ? 'line-through' : undefined, opacity: out ? 0.6 : 1 }}>
                    {rank === 'JOKER' ? 'JK' : rank}
                  </span>
                </PxButton>
              );
            })}
          </div>
        </Section>
        <Section title={`${t.deck_seals} · ${total}/${MAX_SEALS}`}>
          <p className="t-note mb-[4px]">{t.deck_hint}</p>
          <div className="flex flex-col gap-[3px]">
            {owned.map(seal => {
              const n = config.seals[seal] ?? 0;
              return (
                <div key={seal} className="flex items-center gap-[5px]">
                  <SealDot seal={seal} on={n > 0} />
                  <span className="flex-1 truncate" style={{ color: n > 0 ? 'var(--ink-volt)' : 'var(--ink-mint)' }}>{t[`seal_tag_${seal}` as keyof Translations]}</span>
                  <PxButton aria-label={`less ${seal}`} className="w-[14px] h-[14px]" disabled={n === 0} onClick={() => step(seal, -1)}>-</PxButton>
                  <span className="font-display w-[10px] text-center">{n}</span>
                  <PxButton aria-label={`more ${seal}`} className="w-[14px] h-[14px]" disabled={n >= MAX_COPIES || total >= MAX_SEALS} onClick={() => step(seal, 1)}>+</PxButton>
                </div>
              );
            })}
          </div>
        </Section>
        {/* Cada mazo lleva su dorso */}
        <Section title={t.deck_back}>
          <BackPicker />
        </Section>
      </DialogBody>
    </Dialog>
  );
};

// --- EL GRIMORIO (catálogo de cartas) ---
// Todo lo que puede salir en una mesa, en un solo libro: las cartas de siempre, los
// sellos (los que tienes y quién te da los que faltan) y las cartas del Castillo con su
// rareza (ocultas hasta abrirlo). Los dorsos van en el editor de mazo. Cada entrada enseña la carta de verdad.
export type GrimoireTab = 'cards' | 'seals' | 'castle';
let nextTab: GrimoireTab = 'cards';
/** Abre el Grimorio por una pestaña */
export const openGrimoire = (tab: GrimoireTab = 'cards') => {
  nextTab = tab;
  useUiStore.getState().openModal('collection');
};

const BASE: { rank: Rank; text: keyof Translations }[] = [
  { rank: 'J', text: 'special_jack' },
  { rank: 'Q', text: 'special_queen' },
  { rank: 'K', text: 'special_king' },
  { rank: 'A', text: 'special_ace' },
  { rank: 'JOKER', text: 'special_joker' },
];
/** Cartas del Castillo, de común a legendaria (el comodín es raro) */
const CASTLE_ENTRIES: { id: string; card: () => CardType; rarity: Rarity }[] = [
  ...(['JESTER', 'TOWER', 'BOMB', 'SPY'] as Rank[]).map(rank => ({ id: rank.toLowerCase(), card: () => createCard('player', rank), rarity: 'common' as Rarity })),
  ...(['KNIGHT', 'PRIESTESS'] as Rank[]).map(rank => ({ id: rank.toLowerCase(), card: () => createCard('player', rank), rarity: 'rare' as Rarity })),
  { id: 'wild_seal', card: () => createWildSealCard('player'), rarity: 'rare' },
  ...LEGENDARY_RANKS.map(rank => ({ id: rank.toLowerCase(), card: () => createCard('player', rank), rarity: 'legendary' as Rarity })),
];

/** La carta de verdad, a media escala (o su dorso, si aún no la conoces) */
const MiniFace = ({ card }: { card: CardType | null }) => (
  <div className="relative shrink-0" style={{ width: CARD_SIZE.width / 2, height: CARD_SIZE.height / 2 }}>
    <div className="absolute left-0 top-0" style={{ width: CARD_SIZE.width, height: CARD_SIZE.height, transform: 'scale(0.5)', transformOrigin: '0 0' }}>
      {card ? <Card card={{ ...card, isFaceUp: true }} /> : <div className="relative" style={{ width: CARD_SIZE.width, height: CARD_SIZE.height, opacity: 0.4 }}><CardBack owner="player" /></div>}
    </div>
  </div>
);

const Entry = ({ card, name, desc, tag, color = 'var(--ink-cream)', glow }: {
  card: CardType | null; name: string; desc: string; tag?: { label: string; color: string }; color?: string; glow?: string;
}) => (
  <div className="flex gap-[6px] items-center px-inset p-[4px]" style={glow ? { boxShadow: glow } : undefined}>
    <MiniFace card={card} />
    <div className="flex flex-col gap-[2px] min-w-0 flex-1">
      <div className="flex items-center justify-between gap-[4px]">
        <span style={{ color }}>{name}</span>
        {tag && <span className="shrink-0 font-display" style={{ fontSize: 8, lineHeight: '10px', color: tag.color }}>{tag.label}</span>}
      </div>
      <span style={{ color: card ? 'var(--ink-mint)' : 'var(--ink-teal)' }}>{desc}</span>
    </div>
  </div>
);

const GrimoireCards = () => {
  const t = useTranslations();
  return (
    <DialogBody className="t-micro gap-[3px]">
      <p className="t-note">{t.grim_cards_intro}</p>
      <Entry card={createCard('player', '7')} name={t.card_numbers} desc={t.card_number_desc} color="var(--ink-orange)" />
      {BASE.map(({ rank, text }) => (
        <Entry key={rank} card={createCard('player', rank)} name={rank === 'JOKER' ? 'Joker' : rank} desc={t[text]} color="var(--ink-orange)" />
      ))}
    </DialogBody>
  );
};

const GrimoireSeals = () => {
  const t = useTranslations();
  const [owned] = useState(() => unlockedSeals());
  return (
    <DialogBody className="t-micro gap-[3px]">
      <p className="t-note">{owned.length === 0 ? t.collection_empty : t.grim_seals_intro}</p>
      {BOSSES.filter(b => b.seal).map(boss => {
        const seal = boss.seal!;
        const has = owned.includes(seal);
        return (
          <Entry key={seal} card={has ? createSealCard('player', seal) : null} color={has ? 'var(--ink-volt)' : 'var(--ink-teal)'}
            name={has ? sealName(t, seal) : '???'}
            desc={has ? sealDesc(t, seal) : t.collection_locked.replace('{n}', String(BOSSES.indexOf(boss) + 1))}
            glow={has ? 'inset 0 0 0 1px rgba(125,255,43,0.35)' : undefined} />
        );
      })}
    </DialogBody>
  );
};

const GrimoireCastle = () => {
  const t = useTranslations();
  const open = isCastleUnlocked();
  return (
    <DialogBody className="t-micro gap-[3px]">
      <p className="t-note">{open ? t.grim_castle_intro : t.grim_castle_locked}</p>
      {CASTLE_ENTRIES.map(({ id, card, rarity }) => {
        const ui = RARITY_UI[rarity];
        return (
          <Entry key={id} card={open ? card() : null} color={open ? (rarity === 'legendary' ? 'var(--ink-gold)' : 'var(--ink-cream)') : 'var(--ink-teal)'}
            name={open ? t[`idea_${id}` as keyof Translations] : '???'}
            desc={open ? t[`idea_${id}_desc` as keyof Translations] : t.grim_unknown}
            tag={open ? { label: t[ui.label], color: ui.color } : undefined}
            glow={open ? ui.ringCompact : undefined} />
        );
      })}
    </DialogBody>
  );
};

const GRIMOIRE_ICONS: Record<GrimoireTab, Sprite> = { cards: ICONS.card, seals: SEAL_ICONS.shield, castle: ICONS.castle };

export const GrimoireModal = () => {
  const t = useTranslations();
  const [tab, setTab] = useState<GrimoireTab>(() => { const first = nextTab; nextTab = 'cards'; return first; });
  useEffect(() => markSeen('collection'), []);
  return (
    <Dialog title={t.grim_title}>
      {/* Pestañas con icono (con texto no caben bien en el móvil) */}
      <Tabs className="px-[6px] pt-[6px]" value={tab} onChange={setTab} icons={GRIMOIRE_ICONS}
        options={[['cards', t.grim_tab_cards], ['seals', t.tab_seals], ['castle', t.grim_tab_castle]]} />
      {tab === 'cards' ? <GrimoireCards /> : tab === 'seals' ? <GrimoireSeals /> : <GrimoireCastle />}
    </Dialog>
  );
};

// --- DORSOS (en el editor de mazo: cada mazo lleva el suyo) ---
// El clásico, uno por jefe (se gana al vencerle 5 veces; el del jefe secreto es dorado)
// y los tres del Castillo. Tocar uno tuyo te lo pone en el mazo activo; tocar uno que
// falta dice, en un aviso que se va solo, qué hace falta para ganarlo.
const castleBackHint = (t: Translations, id: string) =>
  id === 'castle' ? t.back_need_castle : id === 'merchant' ? t.back_need_merchant : t.back_need_crown;

export const BackPicker = () => {
  const t = useTranslations();
  const progress = getProgress();
  const castleOpen = isCastleUnlocked(progress);
  const owned = new Set<string>([...unlockedBacks(progress), ...castleBacks()]);
  const current = usePlayerBack();
  const [hint, setHint] = useState<{ id: string; text: string } | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (hintTimer.current) clearTimeout(hintTimer.current); }, []);
  const showHint = (id: string, text: string) => {
    playSfx('deselect', 0.6);
    setHint({ id, text });
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 2400);
  };
  const pick = (id: string) => { playSfx('select', 0.7); setBack(id); };
  // Los del Castillo van al final (index -2), solo con el Castillo abierto
  const items = [{ id: DEFAULT_BACK, index: -1 }, ...BOSSES.map((b, index) => ({ id: b.id, index })),
    ...(castleOpen ? CASTLE_BACKS.map(id => ({ id: id as string, index: -2 })) : [])];
  return (
    <div className="relative">
      <div className="grid grid-cols-5 gap-x-[3px] gap-y-[4px] justify-items-center">
        {items.map(({ id, index }) => {
          const has = id === DEFAULT_BACK || owned.has(id);
          const visible = index < 0 || isBossVisible(index, progress);
          const wins = index < 0 ? 0 : bossWins(index, progress);
          const on = current === id;
          const need = index === -2 ? castleBackHint(t, id)
            : !visible ? t.back_need_unknown
              : t.back_need_boss.replace('{boss}', t[`boss_${id}` as keyof Translations]).replace('{n}', String(Math.min(wins, WINS_FOR_BACK)));
          return (
            <button key={id} aria-label={`back ${id}`} aria-disabled={!has} title={index === -1 ? t.back_default : has ? (index === -2 ? t.castle_title : t[`boss_${id}` as keyof Translations]) : need}
              onClick={() => (has ? pick(id) : showHint(id, need))}
              className="flex flex-col items-center gap-[2px] cursor-pointer">
              {/* Dorso a escala reducida (la carta mide 40×56); los que faltan, apagados */}
              <div className="relative" style={{ width: 32, height: 45, opacity: has ? 1 : 0.35, filter: has ? undefined : 'grayscale(1)',
                outline: on ? '1px solid var(--ink-cream)' : hint?.id === id ? '1px solid var(--ink-orange)' : undefined, outlineOffset: 2, borderRadius: 3 }}>
                <div className="absolute left-0 top-0" style={{ width: 40, height: 56, transform: 'scale(0.8)', transformOrigin: '0 0' }}>
                  <CardBack owner="player" back={visible && (has || index !== -2) ? id : DEFAULT_BACK} />
                </div>
              </div>
              {/* Los que faltan de un jefe: sus victorias en puntos. El hueco se guarda
                  siempre para que las filas queden iguales */}
              <span className="flex gap-[1px] h-[4px] items-center">
                {!has && visible && index >= 0 && Array.from({ length: WINS_FOR_BACK }, (_, i) => (
                  <span key={i} style={{ width: 3, height: 3, background: i < wins ? 'var(--ink-orange)' : 'var(--ink-slate)' }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      {/* Qué hace falta para el que has tocado (se va solo) */}
      <AnimatePresence>
        {hint && (
          <motion.div key={hint.id} role="status" className="absolute inset-x-[6px] bottom-[4px] z-10 px-[6px] py-[4px] rounded-[2px] text-center pointer-events-none"
            style={{ background: 'var(--ink-cream)', color: 'var(--ink-black)', boxShadow: '0 0 0 1px var(--ink-orange), 0 0 10px rgba(255,74,28,0.45)' }}
            initial={{ opacity: 0, y: 6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4 }}
            transition={{ type: 'spring', stiffness: 420, damping: 24 }}>
            {hint.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- MEJORA PENDIENTE DEL CASTILLO ---
// Si saliste al menú sin elegir mejora, se elige al volver a entrar
export const BoonsModal = () => {
  const t = useTranslations();
  // Si dejaste el cofre sin abrir, primero el cofre
  const [chest, setChest] = useState(() => !!getCastle().run?.chest);
  const run = getCastle().run;
  if (chest) {
    return (
      <Dialog title={t.chest_title} size="sm" tone="castle">
        <div className="relative" style={{ height: 220 }}>
          <ChestReveal width={180} onDone={() => setChest(false)} />
        </div>
      </Dialog>
    );
  }
  return (
    <Dialog title={t.merchant_name} size="sm" tone="merchant">
      <DialogBody scroll={false}>
        <div className="flex items-center gap-[6px]">
          <MerchantFigure height={40} />
          <span className="t-note">{t.merchant_back}</span>
        </div>
        {run && <div className="relative z-20"><RunStatus run={run} /></div>}
        <BoonChooser onChosen={() => { useUiStore.getState().closeModal(); useGameStore.getState().startCastle(); }} />
      </DialogBody>
    </Dialog>
  );
};

// --- PUNTO DE GUARDADO DEL CASTILLO ---
// Caíste después de un punto de guardado: retomas desde él (con el mazo de entonces y las
// vidas llenas) o empiezas de cero (y lo pierdes; si ya lo conquistaste, eliges desafíos).
export const CheckpointModal = () => {
  const t = useTranslations();
  const [cp] = useState(() => getCastle().checkpoint);
  if (!cp) return null;
  const floor = String(cp.stage + 1);
  const resume = () => {
    playSound('click');
    resumeCheckpoint();
    useUiStore.getState().closeModal();
    useGameStore.getState().startCastle();
  };
  const restart = () => {
    playSound('click');
    if (getCastle().conquered > 0) { useUiStore.getState().openModal('challenges'); return; }
    ensureRun([]);
    useUiStore.getState().closeModal();
    useGameStore.getState().startCastle();
  };
  return (
    <Dialog title={t.cp_title} size="sm" tone="castle" width={230}
      footer={<>
        <PxButton size="lg" tone="yellow" onClick={resume}>{t.cp_resume.replace('{n}', floor)}</PxButton>
        <PxButton size="md" onClick={restart}>{t.cp_restart}</PxButton>
      </>}>
      <DialogBody scroll={false} className="items-center gap-[6px]">
        <CastleMap stage={cp.stage} saved={cp.stage} />
        <p className="t-note text-center">{t.cp_desc.replace('{n}', floor)}</p>
      </DialogBody>
    </Dialog>
  );
};

// --- DESAFÍOS DEL CASTILLO ---
// Tras conquistarlo, al entrar eliges desafíos (interruptores). Se recuerdan los últimos.
/** Lo difícil que es cada desafío (de la simulación: intentos que necesita un buen jugador) */
const CH_SKULLS: Record<ChallengeId, 1 | 2 | 3> = { noHeal: 1, sealed: 1, fragile: 1, fierce: 2, short: 2, noDeath: 3 };
/** Cada calavera, su tinta: menta, bermellón y carmesí que brilla */
const SKULL_INK = [INK.mint, INK.orange, INK.crimson];

const Skull = ({ level, on }: { level: 1 | 2 | 3; on: boolean }) => (
  <span className={clsx('shrink-0 flex items-center justify-center', on && level === 3 && 'anim-throb')}
    style={{ width: 18, opacity: on ? 1 : 0.5, filter: on ? `drop-shadow(0 0 ${level + 1}px ${SKULL_INK[level - 1]})` : undefined }}>
    <PixelSprite sprite={SKULLS[level - 1]} tint={SKULL_INK[level - 1]} scale={2} />
  </span>
);

export const ChallengesModal = () => {
  const t = useTranslations();
  const [picked, setPicked] = useState<ChallengeId[]>(() => getCastle().lastChallenges ?? []);
  const [crownGot] = useState(() => castleBacks().includes('crown'));
  const toggle = (c: ChallengeId) => {
    playSfx('select', 0.6);
    setPicked(p => (p.includes(c) ? p.filter(x => x !== c) : [...p, c]));
  };
  const enter = () => {
    playSound('click');
    ensureRun(picked);
    useUiStore.getState().closeModal();
    useGameStore.getState().startCastle();
  };
  const all = picked.length === CHALLENGES.length;
  return (
    <Dialog title={t.ch_title} size="sm" tone="castle" width={230}
      footer={<PxButton size="lg" tone="yellow" onClick={enter}>{picked.length ? t.ch_enter_n.replace('{n}', String(picked.length)) : t.ch_enter}</PxButton>}>
      <DialogBody scroll={false} className="gap-[3px]">
        <p className="t-micro" style={{ color: 'var(--ink-mint)' }}>{t.ch_intro}</p>
        {CHALLENGES.map(c => {
          const on = picked.includes(c);
          const level = CH_SKULLS[c];
          return (
            <button key={c} aria-label={`challenge ${c}`} aria-pressed={on} onClick={() => toggle(c)}
              className="px-inset px-round flex items-center gap-[4px] px-[3px] py-[2px] text-left cursor-pointer"
              style={{ boxShadow: on ? `inset 0 0 0 1px var(--ink-crimson), 0 0 ${level * 3}px rgba(255,31,75,${0.2 + level * 0.12})` : 'inset 0 0 0 1px rgba(185,207,200,0.12)' }}>
              {/* Casilla: carmesí encendida si está puesto */}
              <span className="shrink-0 rounded-[2px]" style={{ width: 7, height: 7, background: on ? 'var(--ink-crimson)' : 'transparent',
                boxShadow: on ? '0 0 4px rgba(255,31,75,0.9)' : 'inset 0 0 0 1px var(--ink-teal)' }} />
              <span className="flex-1 flex flex-col" style={{ fontSize: 7, lineHeight: '8px' }}>
                <span style={{ color: on ? 'var(--ink-crimson)' : 'var(--ink-cream)' }}>{t[`ch_${c}` as keyof Translations]}</span>
                <span style={{ color: 'var(--ink-mint)', opacity: 0.85 }}>{t[`ch_${c}_desc` as keyof Translations]}</span>
              </span>
              {/* Lo difícil que es: calavera lisa, agrietada o con cuernos */}
              <span aria-label={t.ch_skulls.replace('{n}', String(level))}><Skull level={level} on={on} /></span>
            </button>
          );
        })}
        {/* Hacia la Corona: una muesca por desafío; con los 6, se enciende en oro */}
        <div className="flex items-center gap-[4px] mt-[1px] px-[2px]" aria-label="crown progress">
          <span className={clsx(all && 'anim-throb')} style={{ filter: all || crownGot ? 'drop-shadow(0 0 3px rgba(232,182,74,0.9))' : undefined }}>
            <PixelSprite sprite={CROWN_ICON} tint={all || crownGot ? INK.gold : INK.teal} />
          </span>
          <span className={clsx('font-display', (all || crownGot) && 'glow-gold')} style={{ fontSize: 8, lineHeight: '8px', color: all || crownGot ? 'var(--ink-gold)' : 'var(--ink-teal)', letterSpacing: 1 }}>
            {t.ch_crown}{crownGot && ` · ${t.ch_crown_got}`}
          </span>
          <span className="flex-1 flex gap-[2px] justify-end">
            {CHALLENGES.map((c, i) => (
              <motion.span key={c} className="rounded-[1px]" style={{ width: 8, height: 3 }}
                animate={{ background: i < picked.length ? (all ? INK.gold : INK.crimson) : INK.slate, boxShadow: i < picked.length ? `0 0 3px ${all ? INK.gold : INK.crimson}` : '0 0 0 transparent' }}
                transition={{ duration: 0.2 }} />
            ))}
          </span>
        </div>
      </DialogBody>
    </Dialog>
  );
};

// --- BESTIARIO DEL BOSQUE ---
// Quién vive en el bosque: los que ya te has encontrado, con su estilo, lo que hacen y
// cuántas veces los has vencido en cada dificultad; los que no, en sombra. Arriba, tus
// duelos y tu racha.
/** Sus sellos con sus copias, tal y como se copian */
const forestSeals = (a: Archetype) => Object.entries(forestDeckConfig(a).seals) as [SealId, number][];

export const BestiaryModal = () => {
  const t = useTranslations();
  const [f] = useState(() => getForest());
  // El mazo de cada uno se puede copiar (sus sellos) y pegar en el editor
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (a: Archetype) => {
    playSfx('select', 0.7);
    copyDeck(forestDeckConfig(a));
    setCopied(a.id);
    setTimeout(() => setCopied(c => (c === a.id ? null : c)), 1800);
  };
  return (
    <Dialog title={t.forest_bestiary} size="lg" tone="amber">
      <DialogBody className="t-micro gap-[4px]">
        <p className="t-note">{t.forest_bestiary_hint}</p>
        <div className="flex justify-between" style={{ color: 'var(--ink-cream)' }}>
          <span>{t.forest_duels.replace('{n}', String(f.duels))}</span>
          <span>{t.forest_streak.replace('{n}', String(f.streak))}</span>
          <span>{t.forest_best.replace('{n}', String(f.bestStreak))}</span>
        </div>
        {/* Por niveles: normales, difíciles, pesadillas y, aparte, los únicos y los renegados */}
        {TIERS.map(tier => (
          <div key={tier} className="flex flex-col gap-[4px]">
            <div className="flex items-center gap-[5px] mt-[3px]">
              <span className={clsx('font-display', tier === 'unique' && 'glow-gold', tier === 'renegade' && 'glow-azure')} style={{ color: TIER_INK[tier], fontSize: 10, letterSpacing: 1 }}>
                {t[`tier_section_${tier}` as keyof Translations]}
              </span>
              <span className="flex-1 h-[1px]" style={{ background: `rgba(${TIER_RGB[tier]},0.35)` }} />
            </div>
            {tier === 'unique' && <p className="t-note">{t.forest_unique_hint}</p>}
            {tier === 'renegade' && <p className="t-note">{t.forest_renegade_hint}</p>}
            {archetypesOf(tier).map(a => {
              const rec = recordOf(f, a.id);
              return (
                <div key={a.id} aria-label={`bestiary ${a.id}`} className="px-inset px-round flex items-center gap-[6px] p-[4px]"
                  style={tier === 'unique' ? { boxShadow: `inset 0 0 0 1px rgba(232,182,74,${rec ? 0.7 : 0.25})${rec ? ', 0 0 8px rgba(232,182,74,0.35)' : ''}` } : undefined}>
                  <ForestFigure id={a.id} tier={a.tier} height={34} dim={!rec} />
                  <span className="flex flex-col gap-[2px] flex-1 min-w-0">
                    <span style={{ color: rec ? (tier === 'unique' ? 'var(--ink-gold)' : 'var(--ink-cream)') : 'var(--ink-teal)' }}>
                      {rec ? t[`forest_${a.id}` as keyof Translations] : '???'}
                      {rec && <span style={{ color: 'var(--ink-amber)' }}> · {t[`style_${a.style}` as keyof Translations]}</span>}
                    </span>
                    <span style={{ color: 'var(--ink-mint)' }}>{rec ? t[`forest_${a.id}_desc` as keyof Translations] : t.forest_unknown}</span>
                    {rec && <span style={{ color: TIER_INK[tier] }}>{t.forest_record.replace('{w}', String(rec.wins)).replace('{l}', String(rec.losses))}</span>}
                    {/* Sus sellos, para llevarlos tú: se copian y se pegan en el editor de mazo */}
                    {rec && (
                      <span className="flex items-center gap-[4px]">
                        {forestSeals(a).map(([seal, n]) => (
                          <span key={seal} className="flex items-center gap-[1px]">
                            <PixelSprite sprite={SEAL_ICONS[seal]} tint={INK.volt} />
                            <span className="font-display" style={{ color: 'var(--ink-volt)' }}>×{n}</span>
                          </span>
                        ))}
                        <PxButton size="sm" aria-label={`copy deck ${a.id}`} className="ml-auto" onClick={() => copy(a)}>
                          {copied === a.id ? t.forest_copied : t.forest_copy_deck}
                        </PxButton>
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </DialogBody>
    </Dialog>
  );
};

// --- DEPURACIÓN (solo con ?debug=1) ---
// Repite en el mapa las revelaciones como si acabaras de ganar, sin tocar tu progreso.
/** Borra la progresión de bosses y sellos; pide un segundo toque para confirmar */
const ResetProgress = () => {
  const t = useTranslations();
  const [step, setStep] = useState<'idle' | 'confirm' | 'done'>('idle');
  return (
    <PxButton size="md" className={step === 'done' ? undefined : 'px-btn-danger'} disabled={step === 'done'}
      style={step === 'confirm' ? { boxShadow: 'inset 0 0 0 1px var(--ink-orange), 0 0 6px rgba(255,74,28,0.6)' } : undefined}
      onClick={() => {
        if (step === 'idle') { playSfx('select', 0.6); setStep('confirm'); return; }
        playSound('click');
        resetProgress();
        useUiStore.getState().setMenuBoss(0);
        setStep('done');
      }}>
      <span style={{ color: step === 'confirm' ? 'var(--ink-orange)' : step === 'done' ? 'var(--ink-teal)' : undefined }}>
        {step === 'confirm' ? t.reset_confirm : step === 'done' ? t.reset_done : t.reset_progress}
      </span>
    </PxButton>
  );
};

export const DebugModal = () => {
  const t = useTranslations();
  const replay = (defeated: number) => {
    playSound('click');
    useUiStore.getState().closeModal();
    useUiStore.getState().setMapReplay(defeated);
  };
  const row = (label: string, defeated: number) => (
    <PxButton key={label} size="md" onClick={() => replay(defeated)}>{label}</PxButton>
  );
  return (
    <Dialog title="DEBUG" size="sm" width={240}>
      <DialogBody className="gap-[4px]">
        <div className="t-section">Animaciones (tu progreso no cambia)</div>
        {row('Jefe vencido → siguiente', 3)}
        {row('Llega el Soberano', BOSSES.length - 1)}
        {row('Se alza el Castillo', BOSSES.length)}
        <PxButton size="md" onClick={() => { playSound('click'); useUiStore.getState().closeModal(); useUiStore.getState().setForestReplay(true); }}>El Bosque despierta</PxButton>
        <PxButton size="md" tone="amber" onClick={() => { playSound('click'); useUiStore.getState().closeModal(); useGameStore.getState().enterForest(); }}>Entrar al Bosque</PxButton>
        <div className="t-section mt-[4px]">Progreso</div>
        <span className="flex gap-[3px]">
          <PxButton size="md" tone="green" className="flex-1" onClick={() => { if (window.confirm('¿Desbloquear todo? Se recargará la página.')) unlockAll(); }}>Desbloquear todo</PxButton>
          <PxButton size="md" className="flex-1 px-btn-danger" onClick={() => { if (window.confirm('¿Bloquear todo? Se borra tu progreso (jefes, Castillo, Bosque, mazos y dorsos).')) lockAll(); }}>Bloquear todo</PxButton>
        </span>
        <PxButton size="md" onClick={() => { if (window.confirm('¿Ver el prólogo? Empiezas como recién llegado (se borra tu progreso). Se recargará la página.')) replayPrologue(); }}>Ver el prólogo (empezar de cero)</PxButton>
        <ResetProgress />
        <div className="t-section mt-[4px]">El Bosque: elige quién sale</div>
        {TIERS.map(tier => (
          <div key={tier} className="flex flex-wrap gap-[3px]">
            {archetypesOf(tier).map(a => (
              <PxButton key={a.id} size="sm" aria-label={`debug forest ${a.id}`} className="flex items-center gap-[3px]" style={{ width: 'calc(50% - 2px)' }}
                onClick={() => { playSound('click'); useUiStore.getState().closeModal(); useUiStore.getState().setForestForce({ id: a.id, tier }); useGameStore.getState().enterForest(); }}>
                <ForestFigure id={a.id} tier={tier} height={14} />
                <span className="truncate" style={{ color: TIER_INK[tier] }}>{t[`forest_${a.id}` as keyof Translations].replace(/^(El|La|The) /, '')}</span>
              </PxButton>
            ))}
          </div>
        ))}
      </DialogBody>
    </Dialog>
  );
};

// --- RESUMEN DE LA SUBIDA DEL CASTILLO ---
// Al terminar una subida (conquistada o caída): cómo acabó, el mapa, los desafíos, las
// estadísticas de toda la subida y el mazo final con el que llegaste.
const minutes = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Nombre corto de una carta del mazo final, para el texto que se comparte */
const cardLabel = (t: Translations, c: CardTemplate) => {
  const name = c.rank === 'SEAL' ? (c.wild ? t.idea_wild_seal : c.seal ? t[`seal_tag_${c.seal}` as keyof Translations] : 'SEAL')
    : RANKS[c.rank].castle ? t[`idea_${c.rank.toLowerCase()}` as keyof Translations]
      : c.rank === 'JOKER' ? 'Joker' : c.rank;
  const bonus = c.bonus ? `+${c.bonus}` : '';
  const seal = c.rank !== 'SEAL' && c.seal ? `(${t[`seal_tag_${c.seal}` as keyof Translations]})` : '';
  return `${name}${bonus}${seal}`;
};

/** El resumen como texto, para pegarlo donde quieras */
const summaryText = (t: Translations, sum: RunSummary) => {
  const { stats } = sum;
  const won = sum.outcome === 'conquered';
  const lines = [
    `MAGIC POKER · ${t.castle_title}`,
    won ? `🏰 ${t.sum_conquered}` : `💀 ${t.sum_fallen.replace('{n}', String(sum.floors + 1))}`,
    ...(sum.challenges?.length ? [`⚔ ${t.ch_title}: ${sum.challenges.map(c => t[`ch_${c}` as keyof Translations]).join(', ')}`] : []),
    '',
    `${t.sum_floors}: ${sum.floors}/12 · ${t.sum_rounds}: ${stats.rounds} · ${t.sum_time}: ${minutes(sum.endedAt - stats.startedAt)}`,
    `${t.sum_dealt}: ${stats.damageDealt} · ${t.sum_lost}: ${stats.livesLost}`,
    `${t.sum_destroyed}: ${stats.cardsDestroyed} · ${t.sum_cards_lost}: ${stats.cardsLost}`,
    `${t.sum_best}: ${t.sum_best_v.replace('{n}', String(stats.bestHit))}`,
    `${t.sum_boons}: ${(['common', 'rare', 'legendary'] as const).map(r => `${stats.boons[r]} ${t[RARITY_UI[r].label]}`).join(' · ')} · ${t.sum_chests}: ${stats.chests}`,
    `${t.sum_lives}: ${'♥'.repeat(sum.lives)}${'♡'.repeat(Math.max(0, sum.maxLives - sum.lives))}`,
    `${t.sum_deck.replace('{n}', String(sum.deck.length))}: ${sortDeck(sum.deck).map(c => cardLabel(t, c)).join(' ')}`,
    '',
    typeof window !== 'undefined' ? window.location.origin : '',
  ];
  return lines.join('\n').trim();
};

/** Mazo final en orden: cartas normales, del Castillo y sellos (cada grupo por valor) */
const sortDeck = (deck: CardTemplate[]) => [...deck].sort((a, b) => {
  const ka = a.rank === 'SEAL' ? 2 : RANKS[a.rank].castle ? 1 : 0;
  const kb = b.rank === 'SEAL' ? 2 : RANKS[b.rank].castle ? 1 : 0;
  return ka - kb || RANKS[a.rank].value - RANKS[b.rank].value;
});

export const RunSummaryModal = () => {
  const t = useTranslations();
  const portrait = useStage().mode === 'portrait';
  const sum = getCastle().lastSummary;
  // Compartir: copia el resumen como texto al portapapeles
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  if (!sum) return null;
  const share = () => {
    playSfx('select', 0.7);
    const text = summaryText(t, sum);
    try { void navigator.clipboard?.writeText(text).catch(() => {}); } catch { /* sin portapapeles */ }
    track('castle_summary_shared', { outcome: sum.outcome, floors: sum.floors });
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1800);
  };
  const { stats } = sum;
  const won = sum.outcome === 'conquered';
  const rows: [string, ReactNode][] = [
    [t.sum_floors, `${sum.floors}/12`],
    [t.sum_rounds, stats.rounds],
    [t.sum_time, minutes(sum.endedAt - stats.startedAt)],
    [t.sum_dealt, stats.damageDealt],
    [t.sum_lost, stats.livesLost],
    [t.sum_destroyed, stats.cardsDestroyed],
    [t.sum_cards_lost, stats.cardsLost],
    [t.sum_best, t.sum_best_v.replace('{n}', String(stats.bestHit))],
    [t.sum_boons, (
      <span key="boons" className="flex gap-[4px]">
        {(['common', 'rare', 'legendary'] as const).map(r => (
          <span key={r} style={{ color: RARITY_UI[r].color }}>{stats.boons[r]} {t[RARITY_UI[r].label].slice(0, 1)}</span>
        ))}
      </span>
    )],
    [t.sum_chests, stats.chests],
  ];
  return (
    <Dialog title={t.sum_title} tone="castle" footer={
      <PxButton size="md" tone={copied ? 'green' : 'yellow'} aria-label="share summary" onClick={share}>{copied ? t.sum_copied : t.sum_share}</PxButton>
    }>
      <DialogBody className="t-micro gap-[6px]">
        {/* Cómo acabó */}
        <div className="flex flex-col items-center gap-[4px]">
          <span className={won ? 'font-display glow-crimson' : 'font-display'} style={{ fontSize: 12, letterSpacing: 1, color: won ? 'var(--ink-gold)' : 'var(--ink-crimson)' }}>
            {won ? t.sum_conquered : t.sum_fallen.replace('{n}', String(sum.floors + 1))}
          </span>
          <CastleMap stage={won ? 12 : sum.floors} />
          {!!sum.challenges?.length && (
            <span className="flex flex-wrap justify-center gap-[3px]">
              {sum.challenges.map(c => (
                <span key={c} className="px-[3px] rounded-[2px]" style={{ fontSize: 7, background: 'var(--ink-crimson)', color: 'var(--ink-black)' }}>{t[`ch_${c}` as keyof Translations]}</span>
              ))}
            </span>
          )}
        </div>
        <Section title={t.sum_stats}>
          {/* En vertical, una columna (las etiquetas no caben en dos) */}
          <div className={clsx('grid gap-x-[8px] gap-y-[2px]', portrait ? 'grid-cols-1' : 'grid-cols-2')}>
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-[4px]">
                <span style={{ color: 'var(--ink-mint)' }}>{label}</span>
                <span style={{ color: 'var(--ink-cream)' }}>{value}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title={t.sum_deck.replace('{n}', String(sum.deck.length))}>
          <div className="flex items-center gap-[4px] mb-[4px]">
            <span style={{ color: 'var(--ink-mint)' }}>{t.sum_lives}</span>
            <span className="flex gap-[1px]">
              {Array.from({ length: sum.maxLives }, (_, i) => (
                <PixelSprite key={i} sprite={i < sum.lives ? HEART : HEART_LOST}
                  tint={i < sum.lives ? (i >= 4 ? INK.azure : INK.orange) : INK.slate} />
              ))}
            </span>
          </div>
          <span className="flex flex-wrap gap-[3px]">
            {sortDeck(sum.deck).map((c, i) => <MiniCard key={i} c={c} />)}
          </span>
        </Section>
      </DialogBody>
    </Dialog>
  );
};
