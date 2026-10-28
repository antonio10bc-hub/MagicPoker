import { ReactNode, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useUiStore } from '@/store/useUiStore';
import { useGameStore } from '@/store/useGameStore';
import { useTranslations, Translations } from '@/lib/i18n';
import { getStats } from '@/lib/stats';
import { haptic, playSfx, playSound, setMusicMuffled, toggleMute } from '@/lib/sounds';
import { GrainLevel, Quality, updateSettings } from '@/lib/settings';
import { useSettings } from '@/hooks/useSettings';
import { useMuted } from '@/hooks/useMuted';
import { Rank } from '@/types';
import { IconButton, PxButton } from '@/components/pixel/ui';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { INK } from '@/theme/tokens';
import { StampSeal, stampDesc, stampName } from '@/components/game/Stamps';
import { STAMP_IDS, StampId } from '@/lib/stamps';
import { ALERT, CHARACTERS, CHECK, CROSS, ICONS, SEAL_ICONS, STAR } from '@/components/pixel/sprites';
import { BOSSES, resetProgress, unlockedSeals } from '@/lib/bosses';
import { closeWithClick, Dialog, DialogBody, OptionRow, Section, Tabs } from './Dialog';
import { BackGallery, BoonsModal, ChallengesModal, RunSummaryModal, DebugModal, BestiaryModal, CardCatalogModal, DeckEditorModal, PauseModal } from './ExtraModals';

/** Renderiza el modal abierto (solo puede haber uno a la vez) */
export const Modals = () => {
  const modal = useUiStore(s => s.modal);
  // Con un modal abierto la música suena "a través de la pared"
  useEffect(() => {
    setMusicMuffled(!!modal);
    if (modal) playSfx('open');
    return () => setMusicMuffled(false);
  }, [modal]);
  return (
    <AnimatePresence>
      {modal === 'exit' && <ConfirmExitModal key="exit" />}
      {modal === 'stats' && <StatsModal key="stats" />}
      {modal === 'rules' && <RulesModal key="rules" />}
      {modal === 'settings' && <SettingsModal key="settings" />}
      {modal === 'collection' && <CollectionModal key="collection" />}
      {modal === 'deck' && <DeckEditorModal key="deck" />}
      {modal === 'cards' && <CardCatalogModal key="cards" />}
      {modal === 'pause' && <PauseModal key="pause" />}
      {modal === 'boons' && <BoonsModal key="boons" />}
      {modal === 'challenges' && <ChallengesModal key="challenges" />}
      {modal === 'summary' && <RunSummaryModal key="summary" />}
      {modal === 'debug' && <DebugModal key="debug" />}
      {modal === 'bestiary' && <BestiaryModal key="bestiary" />}
    </AnimatePresence>
  );
};

// --- CONFIRMAR SALIDA ---
const ConfirmExitModal = () => {
  const t = useTranslations();
  const exitToMenu = useGameStore(s => s.exitToMenu);
  const confirmExit = () => {
    playSound('click');
    useUiStore.getState().closeModal();
    exitToMenu();
  };

  return (
    <Dialog title={t.confirm_exit_title} size="sm" footer={
      <div className="flex gap-[4px]">
        <PxButton size="md" className="flex-1" onClick={closeWithClick}>{t.cancel}</PxButton>
        <PxButton size="md" tone="red" className="flex-1" onClick={confirmExit}><span className="text-outline">{t.yes_exit}</span></PxButton>
      </div>
    }>
      <DialogBody scroll={false}><p>{t.confirm_exit_desc}</p></DialogBody>
    </Dialog>
  );
};

// --- ESTADÍSTICAS ---

const StatsModal = () => {
  const t = useTranslations();
  // Se leen una sola vez al abrir
  const [stats] = useState(getStats);
  const [picked, setPicked] = useState<StampId | null>(null);

  // Las victorias antiguas por dificultad cuentan todas juntas
  const totalWins = stats.wins.easy + stats.wins.normal + stats.wins.hard;
  const finished = totalWins + stats.losses + stats.draws;
  const favorite = (Object.entries(stats.rankPlayed) as [Rank, number][]).sort((a, b) => b[1] - a[1])[0];
  const earnedCount = STAMP_IDS.filter(id => stats.stamps[id] !== undefined).length;

  const records: [string, string | number][] = [
    [t.streak, stats.currentStreak],
    [t.best_streak, stats.bestStreak],
    [t.fastest_win, stats.fastestWin ? `${stats.fastestWin} ${t.rounds_unit}` : '—'],
    [t.perfect_wins, stats.perfectWins],
  ];
  const globals: [string, string | number][] = [
    [t.total_games, stats.totalGames],
    [t.rounds_played, stats.roundsPlayed],
    [t.cards_played, stats.cardsPlayed],
    [t.cards_destroyed, stats.cardsDestroyed],
    [t.lives_taken, stats.livesTaken],
    [t.lives_lost, stats.livesLost],
    [t.favorite_card, favorite ? `${favorite[0] === 'JOKER' ? 'Joker' : favorite[0]} ×${favorite[1]}` : '—'],
  ];
  const rows = (items: [string, string | number][]) => items.map(([label, value]) => (
    <div key={label} className="flex justify-between"><span>{label}</span><span className="font-display" style={{ fontSize: 11 }}>{value}</span></div>
  ));

  return (
    <Dialog title={t.stats_title}>
      <DialogBody>
        <Section title={t.results}>
          <div className="grid gap-x-[3px] text-center" style={{ gridTemplateColumns: "1fr 1fr 1fr 0.7fr" }}>
            {([
              [t.wins, totalWins, 'var(--ink-orange)'],
              [t.losses, stats.losses, 'var(--ink-cream)'],
              [t.draws, stats.draws, 'var(--ink-teal)'],
              ['%', `${finished ? Math.round((totalWins / finished) * 100) : 0}%`, 'var(--ink-ember)'],
            ] as const).map(([label, value, color]) => (
              <div key={label}>
                <div className="t-micro" style={{ color: 'var(--ink-mint)' }}>{label}</div>
                <div className="text-title" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>
          {/* Últimas partidas: punto naranja = victoria, pizarra = derrota, teal = empate */}
          {stats.history.length > 0 && (
            <div className="flex items-center gap-[3px] mt-[4px]">
              <span style={{ color: 'var(--ink-teal)' }}>{t.recent}</span>
              {stats.history.map((h, i) => (
                <span key={i} className="rounded-full" style={{
                  width: 6, height: 6,
                  background: h.r === 'win' ? 'var(--ink-orange)' : h.r === 'draw' ? 'var(--ink-teal)' : 'var(--ink-slate)',
                  boxShadow: h.r === 'win' ? '0 0 3px rgba(255,74,28,0.8)' : 'inset 0 0 0 1px rgba(185,207,200,0.3)',
                }} />
              ))}
            </div>
          )}
        </Section>
        <Section title={`${t.stamps_title} · ${earnedCount}/${STAMP_IDS.length}`}>
          <div className="grid grid-cols-6 gap-y-[4px] justify-items-center">
            {STAMP_IDS.map((id, i) => (
              <button key={id} aria-label={id} className="cursor-pointer" onClick={() => { playSfx('select', 0.5); setPicked(p => (p === id ? null : id)); }}
                style={{ outline: picked === id ? '1px solid var(--ink-cream)' : undefined, borderRadius: '50%' }}>
                <StampSeal id={id} earned={stats.stamps[id] !== undefined} size={26} tilt={((i * 37) % 17) - 8} />
              </button>
            ))}
          </div>
          <div className="mt-[4px] min-h-[24px]">
            {picked ? (
              <>
                <div className={stats.stamps[picked] !== undefined ? 'glow-text' : undefined} style={{ color: stats.stamps[picked] !== undefined ? 'var(--ink-orange)' : 'var(--ink-mint)' }}>
                  {stampName(t, picked)}
                </div>
                <div style={{ color: 'var(--ink-mint)' }}>{stampDesc(t, picked)}</div>
              </>
            ) : <div className="t-note">{t.stamp_hint}</div>}
          </div>
        </Section>
        <Section title={t.records}>{rows(records)}</Section>
        <Section title={t.global}>{rows(globals)}</Section>
      </DialogBody>
    </Dialog>
  );
};

// --- COLECCIÓN DE SELLOS ---
const CollectionModal = () => {
  const t = useTranslations();
  const [seals] = useState(() => unlockedSeals());
  const [tab, setTab] = useState<'seals' | 'backs'>('seals');
  return (
    <Dialog title={t.collection_title} width={250}>
      {/* Pestañas: sellos y dorsos */}
      <Tabs className="px-[6px] pt-[6px]" value={tab} options={[['seals', t.tab_seals], ['backs', t.tab_backs]]} onChange={setTab} />
      {tab === 'backs' ? <BackGallery /> : (
      <DialogBody className="t-micro gap-[4px]">
        {seals.length === 0 && <p className="t-note">{t.collection_empty}</p>}
        {BOSSES.filter(b => b.seal).map(boss => {
          const seal = boss.seal!;
          const owned = seals.includes(seal);
          return (
            <div key={seal} className="flex gap-[5px] items-center px-inset px-[5px] py-[4px]"
              style={{ boxShadow: owned ? 'inset 0 0 0 1px rgba(125,255,43,0.35)' : undefined }}>
              <div className={owned ? 'shrink-0 flex items-center justify-center rounded-full bloom-volt' : 'shrink-0 flex items-center justify-center rounded-full'}
                style={{ width: 16, height: 16, background: owned ? 'var(--ink-volt)' : 'var(--ink-slate)' }}>
                <PixelSprite sprite={SEAL_ICONS[seal]} tint={owned ? INK.black : INK.teal} />
              </div>
              <div className="flex flex-col gap-[1px] min-w-0">
                <span className={owned ? 'glow-volt' : undefined} style={{ color: owned ? 'var(--ink-volt)' : 'var(--ink-teal)', fontSize: 9, lineHeight: '10px' }}>
                  {owned ? t[`seal_${seal}` as keyof Translations] : '???'}
                </span>
                <span style={{ color: owned ? 'var(--ink-cream)' : 'var(--ink-teal)' }}>
                  {owned ? t[`seal_${seal}_desc` as keyof Translations] : t.collection_locked.replace('{n}', String(BOSSES.indexOf(boss) + 1))}
                </span>
              </div>
            </div>
          );
        })}
      </DialogBody>
      )}
    </Dialog>
  );
};

// --- AJUSTES ---
const Choice = <T extends string | boolean | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) => (
  <>
    {options.map(([v, label]) => (
      <PxButton key={String(v)} size="sm" tone={v === value ? 'roof' : 'white'} data-pressed={v === value}
        onClick={() => { playSfx('select', 0.6); onChange(v); }}>
        <span className={v === value ? 'text-outline' : undefined}>{label}</span>
      </PxButton>
    ))}
  </>
);

const Slider = ({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) => (
  <>
    <input type="range" min={0} max={100} step={5} value={Math.round(value * 100)} aria-label={label}
      onChange={e => onChange(Number(e.target.value) / 100)}
      onPointerUp={() => playSfx('hover', 1)}
      className="px-range" style={{ width: 84 }} />
    <span className="font-display w-[18px] text-right" style={{ color: 'var(--ink-ember)' }}>{Math.round(value * 100)}</span>
  </>
);

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

const SettingsModal = () => {
  const t = useTranslations();
  const settings = useSettings();
  const isMuted = useMuted();
  return (
    <Dialog title={t.settings_title} size="md">
      <DialogBody>
        <Section title={t.sec_sound} className="flex flex-col gap-[3px]">
          <OptionRow label={t.set_sound}>
            <Choice value={!isMuted} options={[[true, t.on], [false, t.off]]} onChange={on => { if (on === isMuted) toggleMute(); }} />
          </OptionRow>
          <OptionRow label={t.set_music}><Slider label={t.set_music} value={settings.music} onChange={music => updateSettings({ music })} /></OptionRow>
          <OptionRow label={t.set_sfx}><Slider label={t.set_sfx} value={settings.sfx} onChange={sfx => updateSettings({ sfx })} /></OptionRow>
          <OptionRow label={t.set_vibration}>
            <Choice value={settings.vibration} options={[[true, t.on], [false, t.off]]}
              onChange={vibration => { updateSettings({ vibration }); if (vibration) haptic('select'); }} />
          </OptionRow>
        </Section>
        <Section title={t.sec_game} className="flex flex-col gap-[3px]">
          <OptionRow label={t.set_confirm_stand}>
            <Choice value={settings.confirmStand} options={[[true, t.on], [false, t.off]]} onChange={confirmStand => updateSettings({ confirmStand })} />
          </OptionRow>
          <OptionRow label={t.speed}>
            <Choice<number> value={settings.speed} options={[[1, 'x1'], [2, 'x2']]} onChange={v => updateSettings({ speed: v as 1 | 2 })} />
          </OptionRow>
        </Section>
        <Section title={t.sec_display} className="flex flex-col gap-[3px]">
          <span>{t.set_grain}</span>
          <Tabs<GrainLevel> value={settings.grain} options={[['full', t.grain_full], ['soft', t.grain_soft], ['off', t.grain_off]]}
            onChange={grain => updateSettings({ grain })} />
          <p className="t-note">{t.grain_hint}</p>
          <span>{t.set_quality}</span>
          <Tabs<Quality> value={settings.quality} options={[['auto', t.quality_auto], ['high', t.quality_high], ['low', t.quality_low]]}
            onChange={quality => updateSettings({ quality })} />
          <p className="t-note">{t.quality_hint}</p>
        </Section>
        <Section title={t.sec_more} className="flex flex-col gap-[4px]">
          <PxButton size="md" onClick={() => { playSound('click'); useUiStore.getState().openModal('cards'); }}>{t.cards_button}</PxButton>
          <PxButton size="md" onClick={() => {
            playSound('click');
            useUiStore.getState().closeModal();
            useGameStore.getState().startTutorial();
          }}>{t.replay_tutorial}</PxButton>
          <ResetProgress />
        </Section>
      </DialogBody>
    </Dialog>
  );
};

// --- REGLAS ---
interface RulesSection {
  title: keyof Translations;
  items: (keyof Translations)[];
  band: string;
}

const RULES: RulesSection[] = [
  { title: 'obj_title', items: ['obj_desc'], band: 'var(--ink-slate)' },
  { title: 'turn_title', items: ['turn_desc_1', 'turn_desc_2'], band: 'var(--ink-teal)' },
  { title: 'fight_title', items: ['fight_li_1', 'fight_li_2'], band: 'var(--c-mult)' },
  { title: 'special_title', items: ['special_ace', 'special_king', 'special_queen', 'special_jack', 'special_joker'], band: 'var(--c-orange)' },
];

/** Retrato del personaje que acompaña a cada regla de carta especial */
const SPECIAL_PORTRAIT: Partial<Record<keyof Translations, Rank>> = {
  special_ace: 'A', special_king: 'K', special_queen: 'Q', special_jack: 'J', special_joker: 'JOKER',
};

// --- LEYENDA: los mismos iconos que se ven en la partida ---
const Pill = ({ children, bg = 'rgba(11,13,12,0.9)', className }: { children: ReactNode; bg?: string; className?: string }) => (
  <span className={clsx('inline-flex items-center justify-center gap-[2px] shrink-0 h-[11px] min-w-[17px] px-[2px] rounded-[2px] font-display', className)}
    style={{ background: bg, fontSize: 10, paddingTop: 1 }}>
    {children}
  </span>
);
const Marks = ({ on, color }: { on: boolean[]; color: string }) => (
  <Pill>{on.map((o, i) => <span key={i} style={{ width: 3, height: 4, borderRadius: 1, background: o ? color : 'var(--ink-slate)' }} />)}</Pill>
);
const Badge = ({ bg, children }: { bg: string; children: ReactNode }) => (
  <span className="inline-flex items-center justify-center shrink-0 h-[11px] min-w-[11px] px-[2px] rounded-full font-display text-ink bloom" style={{ background: bg, fontSize: 10, paddingTop: 1 }}>{children}</span>
);

const LEGEND: { icon: ReactNode; text: keyof Translations }[] = [
  { icon: <Pill className="text-outline">9</Pill>, text: 'legend_value' },
  { icon: <Marks on={[true, true, true]} color="var(--ink-ember)" />, text: 'legend_sure' },
  { icon: <Marks on={[true, true, true]} color="var(--ink-mint)" />, text: 'legend_random' },
  { icon: <Pill><PixelSprite sprite={STAR} tint={INK.cream} /></Pill>, text: 'legend_ace' },
  { icon: <Pill className="text-outline">+2</Pill>, text: 'legend_joker' },
  { icon: <Badge bg="var(--ink-orange)">-1</Badge>, text: 'legend_damage' },
  { icon: <Badge bg="var(--ink-orange)"><PixelSprite sprite={ALERT} tint={INK.black} /></Badge>, text: 'legend_threat' },
  { icon: <Badge bg="var(--ink-cream)"><PixelSprite sprite={CHECK} tint={INK.black} /></Badge>, text: 'legend_win' },
  { icon: <Badge bg="var(--ink-orange)"><PixelSprite sprite={CROSS} tint={INK.black} /></Badge>, text: 'legend_lose' },
  { icon: <svg width={17} height={11} viewBox="0 0 17 11" aria-hidden><path d="M2 10 Q6 9 11 4 L9 2 L16 1 L14 8 L12.5 5.5 Q7 10.5 2 10.5 Z" fill="var(--ink-cream)" /></svg>, text: 'legend_arrows' },
];

const MuteButton = () => {
  const t = useTranslations();
  const isMuted = useMuted();
  const handleToggle = () => {
    if (!toggleMute()) playSound('click');
  };
  return <IconButton icon={isMuted ? ICONS.soundOff : ICONS.soundOn} onClick={handleToggle} aria-label={t.aria_mute} className="!w-[13px] !h-[12px]" />;
};

const RulesModal = () => {
  const t = useTranslations();
  return (
    <Dialog title={t.rules_title} actions={<MuteButton />}>
      <DialogBody>
        {RULES.map(section => (
          <Section key={section.title} title={t[section.title]}>
            <ul className="flex flex-col gap-[3px]">
              {section.items.map(item => {
                const portrait = SPECIAL_PORTRAIT[item];
                const sprite = portrait && CHARACTERS[portrait];
                return (
                  <li key={item} className="flex gap-[4px] items-start">
                    {sprite
                      ? <PixelSprite sprite={sprite} tint={INK.cream} className="shrink-0" />
                      : <span className="shrink-0" style={{ color: 'var(--ink-orange)' }}>▸</span>}
                    <span className={sprite ? 'pt-[5px]' : undefined}>{t[item]}</span>
                  </li>
                );
              })}
            </ul>
          </Section>
        ))}
        <Section title={t.legend_title}>
          <ul className="flex flex-col gap-[4px]">
            {LEGEND.map(item => (
              <li key={item.text} className="flex gap-[5px] items-start">
                <span className="shrink-0 w-[20px] flex justify-center">{item.icon}</span>
                <span className="pt-[1px]">{t[item.text]}</span>
              </li>
            ))}
          </ul>
        </Section>
      </DialogBody>
    </Dialog>
  );
};
