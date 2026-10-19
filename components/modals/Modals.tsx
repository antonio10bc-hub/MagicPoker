import { ReactNode, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useUiStore } from '@/store/useUiStore';
import { useGameStore } from '@/store/useGameStore';
import { useTranslations, Translations } from '@/lib/i18n';
import { getStats } from '@/lib/stats';
import { playSfx, playSound, setMusicMuffled, toggleMute } from '@/lib/sounds';
import { useMuted } from '@/hooks/useMuted';
import { Difficulty, Rank } from '@/types';
import { IconButton, Panel, PxButton } from '@/components/pixel/ui';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { INK } from '@/theme/tokens';
import { useStage } from '@/components/pixel/Stage';
import { CHARACTERS, ICONS, STAR } from '@/components/pixel/sprites';

const closeWithClick = () => {
  playSound('click');
  useUiStore.getState().closeModal();
};

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
    </AnimatePresence>
  );
};

// --- CAPA DE FONDO + VENTANA ---
const Overlay = ({ onClose, children }: { onClose?: () => void; children: ReactNode }) => (
  <motion.div
    className="absolute inset-0 z-[200] flex items-center justify-center"
    style={{ background: 'rgba(11,13,12,0.7)' }}
    initial={{ opacity: 0, backdropFilter: 'blur(0px)' }} animate={{ opacity: 1, backdropFilter: 'blur(1.5px)' }} exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
    transition={{ duration: 0.2 }}
    onClick={onClose}
  >
    <motion.div
      onClick={e => e.stopPropagation()}
      initial={{ scale: 0.6, y: 30, rotateX: 40, opacity: 0 }}
      animate={{ scale: 1, y: 0, rotateX: 0, opacity: 1 }}
      exit={{ scale: 0.8, y: 20, opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      style={{ transformPerspective: 500 }}
    >
      {children}
    </motion.div>
  </motion.div>
);

/** Ventana con cabecera. En móvil vertical se ensancha y alarga para aprovechar la pantalla. */
const Dialog = ({ title, width, height, actions, children }: { title: string; width: number; height: number; actions?: ReactNode; children: ReactNode }) => {
  const stage = useStage();
  const w = Math.min(width, stage.width - 12);
  const h = stage.mode === 'portrait' ? Math.min(stage.height - 40, Math.max(height, 360)) : Math.min(height, stage.height - 16);
  return (
    <Overlay onClose={closeWithClick}>
      <Panel
        title={
          <div className="flex items-center justify-between">
            <span>{title}</span>
          </div>
        }
        band="var(--c-chip)"
        style={{ width: w, height: h }}
        bodyClassName="flex flex-col"
      >
        <div className="absolute flex gap-[3px] z-10" style={{ right: 3, top: -14 }}>
          {actions}
          <IconButton icon={ICONS.close} onClick={closeWithClick} aria-label="close" className="!w-[13px] !h-[12px]" />
        </div>
        {children}
      </Panel>
    </Overlay>
  );
};

// --- CONFIRMAR SALIDA ---
const ConfirmExitModal = () => {
  const t = useTranslations();
  const exitToMenu = useGameStore(s => s.exitToMenu);
  const stage = useStage();

  const confirmExit = () => {
    playSound('click');
    useUiStore.getState().closeModal();
    exitToMenu();
  };

  return (
    <Overlay>
      <Panel title={t.confirm_exit_title} band="var(--c-mult)" style={{ width: Math.min(200, stage.width - 16) }} bodyClassName="p-[6px] flex flex-col gap-[8px]">
        <p className="leading-[12px]">{t.confirm_exit_desc}</p>
        <div className="flex gap-[6px] justify-center pb-[3px]">
          <PxButton tone="red" onClick={confirmExit} className="px-[6px] h-[16px]"><span className="text-outline">{t.yes_exit}</span></PxButton>
          <PxButton onClick={closeWithClick} className="px-[6px] h-[16px]">{t.cancel}</PxButton>
        </div>
      </Panel>
    </Overlay>
  );
};

// --- ESTADÍSTICAS ---
const WIN_COLORS: Record<Difficulty, string> = { easy: 'var(--ink-cream)', normal: 'var(--ink-ember)', hard: 'var(--ink-orange)' };

const Section = ({ title, children, className }: { title: string; children: ReactNode; className?: string }) => (
  <div className={clsx('px-inset p-[5px]', className)}>
    <div className="mb-[4px] pb-[2px] uppercase" style={{ color: 'var(--c-ui-muted)', boxShadow: '0 1px 0 0 var(--c-ui-panel-light)' }}>{title}</div>
    {children}
  </div>
);

const StatsModal = () => {
  const t = useTranslations();
  // Se leen una sola vez al abrir
  const [stats] = useState(getStats);

  const globals: [string, number][] = [
    [t.total_games, stats.totalGames],
    [t.cards_played, stats.cardsPlayed],
    [t.cards_destroyed, stats.cardsDestroyed],
  ];

  return (
    <Dialog title={t.stats_title} width={236} height={196}>
      <div className="px-scroll flex-1 p-[5px] flex flex-col gap-[4px] leading-[12px]">
        <Section title={t.wins}>
          <div className="grid grid-cols-3 text-center">
            {(Object.keys(WIN_COLORS) as Difficulty[]).map(d => (
              <div key={d}>
                <div>{t[d]}</div>
                <div className="text-title" style={{ color: WIN_COLORS[d] }}>{stats.wins[d]}</div>
              </div>
            ))}
          </div>
        </Section>
        <Section title={t.global}>
          {globals.map(([label, value]) => (
            <div key={label} className="flex justify-between"><span>{label}</span><span>{value}</span></div>
          ))}
        </Section>
        <div className="px-round flex items-center gap-[6px] p-[5px]" style={{
          color: 'var(--c-outline)',
          background: stats.achievementRepublicana ? 'var(--c-gold)' : 'var(--c-ui-muted)',
          boxShadow: stats.achievementRepublicana ? '0 0 8px 1px rgba(255,74,28,0.5)' : undefined,
          filter: stats.achievementRepublicana ? undefined : 'grayscale(1)',
          opacity: stats.achievementRepublicana ? 1 : 0.7,
        }}>
          <PixelSprite sprite={STAR} scale={2} tint={INK.black} />
          <div>
            <div className="uppercase">{t.achievement_republicana}</div>
            <div>{t.achievement_desc}</div>
          </div>
        </div>
      </div>
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

const MuteButton = () => {
  const isMuted = useMuted();
  const handleToggle = () => {
    if (!toggleMute()) playSound('click');
  };
  return <IconButton icon={isMuted ? ICONS.soundOff : ICONS.soundOn} onClick={handleToggle} aria-label="mute" className="!w-[13px] !h-[12px]" />;
};

const RulesModal = () => {
  const t = useTranslations();
  return (
    <Dialog title={t.rules_title} width={300} height={232} actions={<MuteButton />}>
      <div className="px-scroll flex-1 p-[5px] flex flex-col gap-[6px] leading-[12px]">
        {RULES.map(section => (
          <section key={section.title}>
            <div className={clsx('inline-block px-round px-[4px] pt-[2px] h-[13px] mb-[3px]', /orange|mult/.test(section.band) ? 'text-ink' : 'text-outline')} style={{ background: section.band }}>
              {t[section.title]}
            </div>
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
          </section>
        ))}
      </div>
    </Dialog>
  );
};
