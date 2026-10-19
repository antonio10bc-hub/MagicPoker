import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { Trophy, Volume2, VolumeX } from 'lucide-react';
import { Dialog, Overlay } from '@/components/ui/Overlay';
import { useUiStore } from '@/store/useUiStore';
import { useGameStore } from '@/store/useGameStore';
import { useTranslations, Translations } from '@/lib/i18n';
import { getStats } from '@/lib/stats';
import { playSound, toggleMute } from '@/lib/sounds';
import { useMuted } from '@/hooks/useMuted';
import { Difficulty } from '@/types';

const closeWithClick = () => {
  playSound('click');
  useUiStore.getState().closeModal();
};

/** Renderiza el modal abierto (solo puede haber uno a la vez) */
export const Modals = () => {
  const modal = useUiStore(s => s.modal);
  return (
    <AnimatePresence>
      {modal === 'exit' && <ConfirmExitModal key="exit" />}
      {modal === 'stats' && <StatsModal key="stats" />}
      {modal === 'rules' && <RulesModal key="rules" />}
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
    <Overlay className="z-[200]">
      <div className="bg-white p-6 rounded-lg border-[6px] border-black shadow-[12px_12px_0_#000] text-center max-w-sm w-full">
        <h2 className="text-2xl font-black mb-4">{t.confirm_exit_title}</h2>
        <p className="mb-6 font-medium">{t.confirm_exit_desc}</p>
        <div className="flex gap-4 justify-center">
          <button onClick={confirmExit} className="bg-red-500 text-white px-6 py-2 rounded border-[3px] border-black font-bold shadow-[4px_4px_0_#000]">{t.yes_exit}</button>
          <button onClick={closeWithClick} className="bg-gray-200 px-6 py-2 rounded border-[3px] border-black font-bold shadow-[4px_4px_0_#000]">{t.cancel}</button>
        </div>
      </div>
    </Overlay>
  );
};

// --- ESTADÍSTICAS ---
const WIN_COLORS: Record<Difficulty, string> = { easy: 'text-green-600', normal: 'text-yellow-600', hard: 'text-red-600' };

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
    <Dialog
      onClose={closeWithClick}
      className="max-w-lg"
      titleClassName="text-2xl flex items-center gap-2"
      title={<><Trophy className="w-8 h-8 stroke-[3px]" /> {t.stats_title}</>}
    >
      <div className="p-6 space-y-4 text-lg font-bold">
        <div className="bg-gray-100 p-4 rounded-md border-[3px] border-black shadow-[4px_4px_0_#000]">
          <h3 className="text-xl uppercase border-b-2 border-black pb-2 mb-3">{t.wins}</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            {(Object.keys(WIN_COLORS) as Difficulty[]).map(d => (
              <div key={d}>
                <div className="text-sm text-gray-500 uppercase">{t[d]}</div>
                <div className={clsx("text-2xl", WIN_COLORS[d])}>{stats.wins[d]}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gray-100 p-4 rounded-md border-[3px] border-black shadow-[4px_4px_0_#000]">
          <h3 className="text-xl uppercase border-b-2 border-black pb-2 mb-3">{t.global}</h3>
          {globals.map(([label, value]) => (
            <div key={label} className="flex justify-between"><span>{label}</span><span>{value}</span></div>
          ))}
        </div>
        <div className={clsx("p-4 rounded-md border-[3px] border-black shadow-[4px_4px_0_#000] transition-colors", stats.achievementRepublicana ? "bg-[#8e0dff] text-white" : "bg-gray-200 text-gray-400 grayscale")}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏆</span>
            <div>
              <div className="uppercase font-black">{t.achievement_republicana}</div>
              <div className="text-sm font-medium leading-tight opacity-80">{t.achievement_desc}</div>
            </div>
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
  titleClassName: string;
  listClassName?: string;
}

const RULES: RulesSection[] = [
  { title: 'obj_title', items: ['obj_desc'], titleClassName: 'bg-[#8e0dff] text-white border-black shadow-[3px_3px_0_#000] -rotate-1' },
  { title: 'turn_title', items: ['turn_desc_1', 'turn_desc_2'], titleClassName: 'bg-[#ff590d] text-white border-black shadow-[3px_3px_0_#000] rotate-1' },
  { title: 'fight_title', items: ['fight_li_1', 'fight_li_2'], titleClassName: 'bg-yellow-400 text-black border-black shadow-[3px_3px_0_#000] -rotate-1' },
  {
    title: 'special_title',
    items: ['special_ace', 'special_king', 'special_queen', 'special_jack', 'special_joker'],
    titleClassName: 'bg-black text-white border-gray-500 shadow-[3px_3px_0_#888] rotate-1',
    listClassName: 'space-y-2 text-sm sm:text-base',
  },
];

const MuteButton = () => {
  const isMuted = useMuted();
  const handleToggle = () => {
    if (!toggleMute()) playSound('click');
  };
  return (
    <button onClick={handleToggle} className={clsx("p-2 rounded-md border-[3px] border-black shadow-[3px_3px_0_#000] active:translate-y-1 active:shadow-none transition-all", isMuted ? "bg-black text-white" : "bg-[#F7F5E6] text-black")}>
      {isMuted ? <VolumeX className="w-6 h-6 stroke-[3px]" /> : <Volume2 className="w-6 h-6 stroke-[3px]" />}
    </button>
  );
};

const RulesModal = () => {
  const t = useTranslations();
  return (
    <Dialog
      onClose={closeWithClick}
      className="max-w-2xl max-h-[80vh]"
      headerClassName="p-4 sm:p-6"
      titleClassName="text-2xl sm:text-3xl drop-shadow-[2px_2px_0_#fff]"
      closeIconClassName="w-6 h-6 sm:w-8 sm:h-8"
      title={t.rules_title}
      actions={<MuteButton />}
    >
      <div className="p-6 space-y-6 text-base sm:text-lg font-medium leading-relaxed">
        {RULES.map(section => (
          <section key={section.title}>
            <h3 className={clsx("font-black text-xl mb-2 inline-block px-2 border-[2px]", section.titleClassName)}>{t[section.title]}</h3>
            <ul className={clsx("list-disc pl-5", section.listClassName ?? "space-y-1")}>
              {section.items.map(item => <li key={item}>{t[item]}</li>)}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
};
