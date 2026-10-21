import { ReactNode, useState } from 'react';
import { useUiStore } from '@/store/useUiStore';
import { useGameStore } from '@/store/useGameStore';
import { Translations, useTranslations } from '@/lib/i18n';
import { playSfx, playSound } from '@/lib/sounds';
import { isBoardEmpty } from '@/lib/game-utils';
import { ALL_SEALS, BOSSES, bossWins, getProgress, isBossVisible, unlockedBacks, unlockedSeals, WINS_FOR_BACK } from '@/lib/bosses';
import { DEFAULT_BACK, setBack, usePlayerBack } from '@/lib/cosmetics';
import { CardBack } from '@/components/game/Card';
import { BoonChooser } from '@/components/game/BoonChooser';
import { MerchantFigure } from '@/components/game/MerchantScene';
import {
  clearDeckConfig, DECK_SLOTS, DeckConfig, defaultDeckConfig, getActiveSlot, getDeckConfig, MAX_COPIES, setActiveSlot, MAX_REMOVED, MAX_SEALS, REMOVABLE,
  sanitizeDeckConfig, saveDeckConfig, totalSeals,
} from '@/lib/deck';
import { updateSettings } from '@/lib/settings';
import { useSettings } from '@/hooks/useSettings';
import { Rank, SealId } from '@/types';
import { PxButton } from '@/components/pixel/ui';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { CHARACTERS, SEAL_ICONS } from '@/components/pixel/sprites';
import { INK } from '@/theme/tokens';
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
      </DialogBody>
    </Dialog>
  );
};

// --- EDITOR DE MAZO ---
export const DeckEditorModal = () => {
  const t = useTranslations();
  const [owned] = useState(() => unlockedSeals());
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
      <div className="flex items-center justify-between gap-[6px]">
        <span className="glow-text whitespace-nowrap" style={{ color: 'var(--ink-orange)' }}>{t.deck_size.replace('{n}', String(size))}</span>
        <PxButton size="sm" className="px-btn-ghost" onClick={() => { playSound('click'); clearDeckConfig(); setConfig(defaultDeckConfig(owned)); }}>{t.deck_reset}</PxButton>
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
      </DialogBody>
    </Dialog>
  );
};

// --- CATÁLOGO DE CARTAS ---
// Lista completa: las del juego (cartas y sellos) y las ideas aún sin hacer, para
// valorar cuáles meter en el futuro.
const IDEAS = ['jester', 'tower', 'wild_seal', 'bomb', 'spy', 'knight', 'priestess'] as const;
const IDEA_RANK: Partial<Record<typeof IDEAS[number], Rank>> = {
  jester: 'JESTER', tower: 'TOWER', bomb: 'BOMB', spy: 'SPY', knight: 'KNIGHT', priestess: 'PRIESTESS',
};
const BASE: { rank: Rank; text: keyof Translations }[] = [
  { rank: 'J', text: 'special_jack' },
  { rank: 'Q', text: 'special_queen' },
  { rank: 'K', text: 'special_king' },
  { rank: 'A', text: 'special_ace' },
  { rank: 'JOKER', text: 'special_joker' },
];

/** Etiqueta: en el juego (naranja) o solo en el Castillo (rojo eléctrico) */
const Tag = ({ idea }: { idea?: boolean }) => {
  const t = useTranslations();
  return (
    <span className="shrink-0 px-[3px] rounded-[2px] font-display" style={{
      fontSize: 8, lineHeight: '10px', paddingTop: 1,
      background: idea ? 'var(--ink-crimson)' : 'var(--ink-orange)', color: 'var(--ink-black)',
    }}>{idea ? t.cards_castle : t.cards_in_game}</span>
  );
};

const Entry = ({ icon, name, desc, idea }: { icon: ReactNode; name: string; desc: string; idea?: boolean }) => (
  <div className="flex gap-[5px] items-start px-inset p-[4px]">
    <div className="shrink-0 w-[20px] flex justify-center">{icon}</div>
    <div className="flex flex-col gap-[2px] min-w-0 flex-1">
      <div className="flex items-center justify-between gap-[4px]">
        <span style={{ color: idea ? 'var(--ink-cream)' : 'var(--ink-orange)' }}>{name}</span>
        <Tag idea={idea} />
      </div>
      <span style={{ color: 'var(--ink-mint)' }}>{desc}</span>
    </div>
  </div>
);

export const CardCatalogModal = () => {
  const t = useTranslations();
  return (
    <Dialog title={t.cards_title}>
      <DialogBody className="t-list">
        <p className="t-note">{t.cards_intro}</p>
        <Section title={t.cards_section_base} className="flex flex-col gap-[3px]">
          <Entry icon={<span className="font-display" style={{ fontSize: 14 }}>7</span>} name={t.card_numbers} desc={t.card_number_desc} />
          {BASE.map(({ rank, text }) => (
            <Entry key={rank} icon={<PixelSprite sprite={CHARACTERS[rank]!} tint={INK.cream} />} name={rank === 'JOKER' ? 'Joker' : rank} desc={t[text]} />
          ))}
        </Section>
        <Section title={t.cards_section_seals} className="flex flex-col gap-[3px]">
          {ALL_SEALS.map(seal => <Entry key={seal} icon={<SealDot seal={seal} />} name={sealName(t, seal)} desc={sealDesc(t, seal)} />)}
        </Section>
        <Section title={t.cards_section_ideas} className="flex flex-col gap-[3px]">
          {IDEAS.map(id => (
            <Entry key={id} idea icon={IDEA_RANK[id] ? <PixelSprite sprite={CHARACTERS[IDEA_RANK[id]!]!} tint={INK.crimson} className="bloom-crimson-shape" />
              : <span className="font-display" style={{ fontSize: 14, color: 'var(--ink-volt)' }}>?</span>}
              name={t[`idea_${id}` as keyof Translations]} desc={t[`idea_${id}_desc` as keyof Translations]} />
          ))}
        </Section>
      </DialogBody>
    </Dialog>
  );
};

// --- DORSOS ---
// El clásico y uno por jefe: se gana al vencerle 5 veces. El del jefe secreto es dorado.
export const BackGallery = () => {
  const t = useTranslations();
  const progress = getProgress();
  const owned = new Set(unlockedBacks(progress));
  const current = usePlayerBack();
  const pick = (id: string) => { playSfx('select', 0.7); setBack(id); };
  const items = [{ id: DEFAULT_BACK, index: -1 }, ...BOSSES.map((b, index) => ({ id: b.id, index }))];
  return (
    <DialogBody className="t-micro gap-[5px]">
      <p className="t-micro" style={{ color: 'var(--ink-mint)' }}>{t.backs_hint}</p>
      <div className="grid grid-cols-5 gap-x-[3px] gap-y-[4px] justify-items-center">
        {items.map(({ id, index }) => {
          const has = id === DEFAULT_BACK || owned.has(id);
          const visible = index < 0 || isBossVisible(index, progress);
          const wins = index < 0 ? 0 : bossWins(index, progress);
          const on = current === id;
          return (
            <button key={id} aria-label={`back ${id}`} title={index < 0 ? t.back_default : t[`boss_${id}` as keyof Translations]} disabled={!has} onClick={() => pick(id)}
              className={has ? 'flex flex-col items-center gap-[2px] cursor-pointer' : 'flex flex-col items-center gap-[2px]'}>
              {/* Dorso a escala reducida (la carta mide 40×56) */}
              <div className="relative" style={{ width: 32, height: 45, opacity: has ? 1 : 0.35, filter: has ? undefined : 'grayscale(1)',
                outline: on ? '1px solid var(--ink-cream)' : undefined, outlineOffset: 2, borderRadius: 3 }}>
                <div className="absolute left-0 top-0" style={{ width: 40, height: 56, transform: 'scale(0.8)', transformOrigin: '0 0' }}>
                  <CardBack owner="player" back={visible ? id : DEFAULT_BACK} />
                </div>
              </div>
              {/* Solo el dorso: el puesto lleva el contorno crema; los que faltan, sus
                  victorias en puntos (como las estrellas del menú). El hueco se guarda
                  siempre para que las filas queden iguales. */}
              <span className="flex gap-[1px] h-[4px] items-center" aria-label={has ? undefined : `${Math.min(wins, WINS_FOR_BACK)}/${WINS_FOR_BACK}`}>
                {!has && visible && Array.from({ length: WINS_FOR_BACK }, (_, i) => (
                  <span key={i} style={{ width: 3, height: 3, background: i < wins ? 'var(--ink-orange)' : 'var(--ink-slate)' }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </DialogBody>
  );
};

// --- MEJORA PENDIENTE DEL CASTILLO ---
// Si saliste al menú sin elegir mejora, se elige al volver a entrar
export const BoonsModal = () => {
  const t = useTranslations();
  return (
    <Dialog title={t.merchant_name} size="sm" tone="merchant">
      <DialogBody scroll={false}>
        <div className="flex items-center gap-[6px]">
          <MerchantFigure height={40} />
          <span className="t-note">{t.merchant_back}</span>
        </div>
        <BoonChooser onChosen={() => { useUiStore.getState().closeModal(); useGameStore.getState().startCastle(); }} />
      </DialogBody>
    </Dialog>
  );
};
