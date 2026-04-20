import { useState, useEffect } from 'react';
import { useCampaignStore } from '../../store/campaignStore';
import { useGameStore } from '../../store/gameStore';
import { ComicPanel } from './ComicPanel';
import { CaptainPicker } from './CaptainPicker';
import type { ComicPanel as ComicPanelType, DifficultyLabel, ObjectiveThresholds } from '@shared/index';
import { Dialog, DialogContent, DialogTitle } from '../shadcn/dialog';

const labelStyle = { fontFamily: "'IM Fell English SC', serif" };
const pirateStyle = { fontFamily: "'Pirata One', serif" };
const bodyStyle = { fontFamily: "'IM Fell English', serif" };

const DIFFICULTY_COLOR: Record<DifficultyLabel, string> = {
  'Calm Waters':    '#e8dcc8',
  'Rough Seas':     '#d4a040',
  'Storm Warning':  '#b87333',
  'Kraken Waters':  '#c41e3a',
  'No Mercy':       '#c41e3a',
};

const DIFFICULTY_ICON: Record<DifficultyLabel, string> = {
  'Calm Waters':   '⚓',
  'Rough Seas':    '🌊',
  'Storm Warning': '🌩️',
  'Kraken Waters': '🐙',
  'No Mercy':      '💀',
};

function formatThreshold(t: ObjectiveThresholds): string {
  const parts: string[] = [];
  if (t.maxTurns !== undefined) parts.push(`Under ${t.maxTurns} turns`);
  if (t.minAccuracyPct !== undefined) parts.push(`≥${t.minAccuracyPct}% accuracy`);
  if (t.noShipsLost) parts.push('No ships lost');
  return parts.length > 0 ? parts.join(' · ') : 'Win the battle';
}

interface TierRow {
  label: string;
  medal: string;
  description: string;
  color: string;
}

function buildTierRows(mission: { starRequirements: { twoStars: ObjectiveThresholds; threeStars: ObjectiveThresholds }; modifiers: { starTiers?: { bronze: ObjectiveThresholds; silver: ObjectiveThresholds; gold: ObjectiveThresholds } } }): TierRow[] {
  const tiers = mission.modifiers.starTiers;
  if (tiers) {
    return [
      { label: 'Bronze', medal: '🥉', description: formatThreshold(tiers.bronze), color: '#b87333' },
      { label: 'Silver', medal: '🥈', description: formatThreshold(tiers.silver), color: '#e8dcc8' },
      { label: 'Gold',   medal: '🥇', description: formatThreshold(tiers.gold),   color: '#d4a040' },
    ];
  }
  return [
    { label: 'Bronze', medal: '🥉', description: 'Win the battle',                                         color: '#b87333' },
    { label: 'Silver', medal: '🥈', description: formatThreshold(mission.starRequirements.twoStars),        color: '#e8dcc8' },
    { label: 'Gold',   medal: '🥇', description: formatThreshold(mission.starRequirements.threeStars),      color: '#d4a040' },
  ];
}

export function MissionBriefing() {
  const mission = useCampaignStore((s) => s.currentMission);
  const closeBriefing = useCampaignStore((s) => s.closeBriefing);
  const startCampaignMission = useGameStore((s) => s.startCampaignMission);

  const [panelIdx, setPanelIdx] = useState(0);

  useEffect(() => {
    setPanelIdx(0);
  }, [mission?.id]);

  const panels: ComicPanelType[] = mission?.introPanels ?? [];
  const isLast = panels.length === 0 || panelIdx >= panels.length - 1;

  const handleNext = () => {
    if (!mission) return;
    if (isLast) {
      closeBriefing();
      startCampaignMission(mission);
    } else {
      setPanelIdx((i) => i + 1);
    }
  };

  const requiredCaptain = mission?.modifiers.requiredCaptain;
  const forbiddenAbilities = mission?.modifiers.forbiddenAbilities ?? [];
  const hasFixedAbilities = !!(mission?.modifiers.fixedAbilities?.length);
  const showCaptainPicker = isLast && (!hasFixedAbilities || !!requiredCaptain);

  return (
    <Dialog open={!!mission} onOpenChange={(open) => !open && closeBriefing()}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        className="bg-gradient-to-b from-[#221210] to-[#2a1410] border-2 border-[#8b0000] rounded p-6 max-w-2xl sm:max-w-2xl panel-glow ring-0"
      >
        {mission && (
          <>
            {/* Header: mission number + difficulty badge */}
            <div className="text-center mb-4">
              <div className="flex items-center justify-center gap-3 mb-1">
                <div className="text-xs text-[#a06820] uppercase tracking-[0.3em]" style={labelStyle}>
                  Mission {mission.id} of 15
                </div>
                <div
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border"
                  style={{
                    color: DIFFICULTY_COLOR[mission.difficultyLabel],
                    borderColor: DIFFICULTY_COLOR[mission.difficultyLabel] + '60',
                    backgroundColor: DIFFICULTY_COLOR[mission.difficultyLabel] + '12',
                    fontFamily: "'IM Fell English SC', serif",
                    ...(mission.difficultyLabel === 'No Mercy'
                      ? { textShadow: `0 0 8px ${DIFFICULTY_COLOR[mission.difficultyLabel]}80` }
                      : {}),
                  }}
                >
                  <span>{DIFFICULTY_ICON[mission.difficultyLabel]}</span>
                  <span>{mission.difficultyLabel}</span>
                </div>
              </div>
              <DialogTitle
                className="text-4xl text-[#c41e3a]"
                style={{ ...pirateStyle, textShadow: '0 0 14px rgba(196,30,58,0.4)' }}
              >
                {mission.title}
              </DialogTitle>
              <p className="text-[#d4a040] text-sm italic" style={bodyStyle}>
                {mission.subtitle}
              </p>
            </div>

            {panels.length > 0 && <ComicPanel panel={panels[panelIdx]} />}

            <div className="flex justify-center gap-1 my-4">
              {panels.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${i === panelIdx ? 'bg-[#c41e3a]' : 'bg-[#4d2e22]'}`}
                />
              ))}
            </div>

            {/* Star objectives: bronze / silver / gold */}
            <div className="bg-[#150c0c]/60 border border-[#8b0000]/40 rounded p-3 mb-4">
              <div className="text-[#a06820] uppercase tracking-wider text-xs mb-2" style={labelStyle}>
                Objectives
              </div>
              <div className="flex flex-col gap-1">
                {buildTierRows(mission).map((row) => (
                  <div key={row.label} className="flex items-center gap-2 text-xs" style={labelStyle}>
                    <span className="text-base leading-none w-5 text-center">{row.medal}</span>
                    <span className="font-bold w-12" style={{ color: row.color }}>{row.label}</span>
                    <span className="text-[#d4c4a1]/70">{row.description}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Modifier callouts */}
            {(mission.modifiers.foggyVision || mission.modifiers.krakenAttack) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {mission.modifiers.foggyVision && (
                  <span
                    className="text-xs px-2 py-0.5 rounded border border-[#4a90d9]/40 text-[#4a90d9]/80"
                    style={{ backgroundColor: '#4a90d912', fontFamily: "'IM Fell English SC', serif" }}
                  >
                    🌫️ Foggy Vision
                  </span>
                )}
                {mission.modifiers.krakenAttack && (
                  <span
                    className="text-xs px-2 py-0.5 rounded border border-[#8b0000]/60 text-[#c41e3a]/80"
                    style={{ backgroundColor: '#8b000012', fontFamily: "'IM Fell English SC', serif" }}
                  >
                    🐙 Kraken Attacks
                  </span>
                )}
              </div>
            )}

            {/* Captain picker (free or locked) */}
            {showCaptainPicker && (
              <div className="mb-4">
                <CaptainPicker
                  requiredCaptain={requiredCaptain}
                  forbiddenAbilities={forbiddenAbilities}
                />
              </div>
            )}

            <div className="flex justify-between gap-3">
              <button
                onClick={closeBriefing}
                className="px-4 py-2 text-[#d4c4a1]/50 hover:text-[#d4c4a1] text-sm"
                style={labelStyle}
              >
                Cancel
              </button>
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-gradient-to-b from-[#c41e3a] to-[#8b0000] text-[#e8dcc8] font-bold rounded border border-[#c41e3a] hover:from-[#e74c3c] hover:to-[#c41e3a]"
                style={pirateStyle}
              >
                {isLast ? 'Begin Battle' : 'Next →'}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function MissionOutro() {
  const showOutro = useCampaignStore((s) => s.showOutro);
  const lastResult = useCampaignStore((s) => s.lastResult);
  const currentMission = useCampaignStore((s) => s.currentMission);
  const closeOutro = useCampaignStore((s) => s.closeOutro);
  const setScreen = useGameStore((s) => s.setScreen);
  const resetGame = useGameStore((s) => s.resetGame);
  const openBriefing = useCampaignStore((s) => s.openBriefing);
  const isMissionUnlocked = useCampaignStore((s) => s.isMissionUnlocked);

  const [panelIdx, setPanelIdx] = useState(0);

  const isOpen = showOutro && !!lastResult && !!currentMission;

  useEffect(() => {
    if (isOpen) setPanelIdx(0);
  }, [isOpen]);

  const panels = currentMission?.outroPanels ?? [];
  const isLast = panels.length === 0 || panelIdx >= panels.length - 1;
  const nextMissionId = (currentMission?.id ?? 0) + 1;
  const hasNext = nextMissionId <= 15 && isMissionUnlocked(nextMissionId);

  const handleNext = () => {
    if (!isLast) {
      setPanelIdx((i) => i + 1);
      return;
    }
    closeOutro();
    if (hasNext) {
      resetGame();
      openBriefing(nextMissionId);
      setScreen('campaign');
    } else {
      resetGame();
      setScreen('campaign');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeOutro()}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        className="bg-gradient-to-b from-[#221210] to-[#2a1410] border-2 border-[#d4a040] rounded p-6 max-w-2xl sm:max-w-2xl panel-glow ring-0"
      >
        {isOpen && currentMission && lastResult && (
          <>
            <div className="text-center mb-4">
              <div className="text-xs text-[#a06820] uppercase tracking-[0.3em]" style={labelStyle}>
                Mission Complete
              </div>
              <DialogTitle
                className="text-4xl text-[#d4a040]"
                style={{ ...pirateStyle, textShadow: '0 0 16px rgba(212,160,64,0.5)' }}
              >
                {currentMission.title}
              </DialogTitle>
              <div className="text-3xl mt-2" style={{ animation: 'fadeInScale 0.6s ease-out' }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <span key={i} className={i < lastResult.stars ? 'text-[#d4a040]' : 'text-[#4d2e22]'}>★</span>
                ))}
              </div>
            </div>

            {panels.length > 0 && <ComicPanel panel={panels[panelIdx]} />}

            <div className="flex justify-center gap-1 my-4">
              {panels.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${i === panelIdx ? 'bg-[#d4a040]' : 'bg-[#4d2e22]'}`}
                />
              ))}
            </div>

            <div className="flex justify-between gap-3">
              <button
                onClick={() => { closeOutro(); resetGame(); setScreen('campaign'); }}
                className="px-4 py-2 text-[#d4c4a1]/50 hover:text-[#d4c4a1] text-sm"
                style={labelStyle}
              >
                Campaign Map
              </button>
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-gradient-to-b from-[#c41e3a] to-[#8b0000] text-[#e8dcc8] font-bold rounded border border-[#c41e3a] hover:from-[#e74c3c] hover:to-[#c41e3a]"
                style={pirateStyle}
              >
                {!isLast ? 'Next →' : (hasNext ? 'Next Mission' : 'Return to Map')}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
