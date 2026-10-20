import { ReactNode, useState } from 'react';
import { useUiStore } from '@/store/useUiStore';
import { useGameStore } from '@/store/useGameStore';
import { Translations, useTranslations } from '@/lib/i18n';
import { playSfx, playSound } from '@/lib/sounds';
import { isBoardEmpty } from '@/lib/game-utils';
import { ALL_SEALS, unlockedSeals } from '@/lib/bosses';
import {
  clearDeckConfig, DeckConfig, defaultDeckConfig, getDeckConfig, MAX_COPIES, MAX_REMOVED, MAX_SEALS, REMOVABLE,
  sanitizeDeckConfig, saveDeckConfig, totalSeals,
} from '@/lib/deck';
import { updateSettings } from '@/lib/settings';
import { useSettings } from '@/hooks/useSettings';
import { Rank, SealId } from '@/types';
import { PxButton } from '@/components/pixel/ui';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { CHARACTERS, SEAL_ICONS } from '@/components/pixel/sprites';
import { INK } from '@/theme/tokens';
import { closeWithClick, Dialog, Section } from './Dialog';

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
    <Dialog title={t.pause_title} width={190} height={150}>
      <div className="flex-1 p-[8px] flex flex-col gap-[6px] justify-center">
        <PxButton tone="yellow" className="h-[20px] text-title" onClick={closeWithClick}>{t.resume}</PxButton>
        <div className="flex items-center justify-between gap-[6px]">
          <span>{t.speed}</span>
          <div className="flex gap-[3px]">
            {([1, 2] as const).map(v => (
              <PxButton key={v} tone={v === speed ? 'roof' : 'white'} data-pressed={v === speed} className="h-[15px] px-[6px]"
                onClick={() => { playSfx('select', 0.6); updateSettings({ speed: v }); }}>
                <span className={v === speed ? 'text-outline' : undefined}>x{v}</span>
              </PxButton>
            ))}
          </div>
        </div>
        <div className="flex gap-[4px]">
          <PxButton className="h-[16px] flex-1" onClick={() => open('rules')}>{t.menu_rules}</PxButton>
          <PxButton className="h-[16px] flex-1" onClick={() => open('stats')}>{t.menu_stats}</PxButton>
        </div>
        <PxButton className="h-[16px]" onClick={goHome}>{t.exit_menu}</PxButton>
      </div>
    </Dialog>
  );
};

// --- EDITOR DE MAZO ---
export const DeckEditorModal = () => {
  const t = useTranslations();
  const [owned] = useState(() => unlockedSeals());
  const [config, setConfig] = useState<DeckConfig>(() => sanitizeDeckConfig(getDeckConfig() ?? defaultDeckConfig(owned), owned));
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
    <Dialog title={t.deck_title} width={250} height={240}>
      <div className="px-scroll flex-1 p-[5px] flex flex-col gap-[4px] leading-[11px]">
        <div className="text-center" style={{ color: 'var(--ink-orange)' }}>{t.deck_size.replace('{n}', String(size))}</div>
        <Section title={`${t.deck_seals} · ${total}/${MAX_SEALS}`}>
          <div className="mb-[3px]" style={{ color: 'var(--ink-teal)' }}>{t.deck_hint}</div>
          <div className="flex flex-col gap-[3px]">
            {owned.map(seal => {
              const n = config.seals[seal] ?? 0;
              return (
                <div key={seal} className="flex items-center gap-[5px]">
                  <SealDot seal={seal} on={n > 0} />
                  <span className="flex-1" style={{ color: n > 0 ? 'var(--ink-volt)' : 'var(--ink-mint)' }}>{sealName(t, seal)}</span>
                  <PxButton aria-label={`less ${seal}`} className="w-[14px] h-[14px]" disabled={n === 0} onClick={() => step(seal, -1)}>-</PxButton>
                  <span className="font-display w-[10px] text-center">{n}</span>
                  <PxButton aria-label={`more ${seal}`} className="w-[14px] h-[14px]" disabled={n >= MAX_COPIES || total >= MAX_SEALS} onClick={() => step(seal, 1)}>+</PxButton>
                </div>
              );
            })}
          </div>
        </Section>
        <Section title={`${t.deck_removed} · ${config.removed.length}/${MAX_REMOVED}`}>
          <div className="mb-[3px]" style={{ color: 'var(--ink-teal)' }}>{t.deck_removed_hint}</div>
          <div className="flex gap-[4px] justify-center">
            {REMOVABLE.map(rank => {
              const out = config.removed.includes(rank);
              return (
                <PxButton key={rank} aria-label={`remove ${rank}`} data-pressed={out} tone={out ? 'roof' : 'white'} className="w-[22px] h-[22px]" onClick={() => toggleRank(rank)}>
                  <span className="font-display" style={{ fontSize: 14, textDecoration: out ? 'line-through' : undefined, opacity: out ? 0.6 : 1 }}>{rank}</span>
                </PxButton>
              );
            })}
          </div>
        </Section>
        <PxButton className="h-[16px]" onClick={() => { playSound('click'); clearDeckConfig(); setConfig(defaultDeckConfig(owned)); }}>{t.deck_reset}</PxButton>
      </div>
    </Dialog>
  );
};

// --- CATÁLOGO DE CARTAS ---
// Lista completa: las del juego (cartas y sellos) y las ideas aún sin hacer, para
// valorar cuáles meter en el futuro.
const IDEAS = ['jester', 'tower', 'wild_seal', 'bomb', 'spy', 'knight', 'priestess'] as const;
const BASE: { rank: Rank; text: keyof Translations }[] = [
  { rank: 'J', text: 'special_jack' },
  { rank: 'Q', text: 'special_queen' },
  { rank: 'K', text: 'special_king' },
  { rank: 'A', text: 'special_ace' },
  { rank: 'JOKER', text: 'special_joker' },
];

const Tag = ({ idea }: { idea?: boolean }) => {
  const t = useTranslations();
  return (
    <span className="shrink-0 px-[3px] rounded-[2px] font-display" style={{
      fontSize: 8, lineHeight: '10px', paddingTop: 1,
      background: idea ? 'var(--ink-slate)' : 'var(--ink-orange)', color: idea ? 'var(--ink-mint)' : 'var(--ink-black)',
    }}>{idea ? t.cards_idea : t.cards_in_game}</span>
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
    <Dialog title={t.cards_title} width={260} height={240}>
      <div className="px-scroll flex-1 p-[5px] flex flex-col gap-[4px] leading-[10px]" style={{ fontSize: 9 }}>
        <p style={{ color: 'var(--ink-teal)' }}>{t.cards_intro}</p>
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
            <Entry key={id} idea icon={<span className="font-display" style={{ fontSize: 14, color: 'var(--ink-teal)' }}>?</span>}
              name={t[`idea_${id}` as keyof Translations]} desc={t[`idea_${id}_desc` as keyof Translations]} />
          ))}
        </Section>
      </div>
    </Dialog>
  );
};
