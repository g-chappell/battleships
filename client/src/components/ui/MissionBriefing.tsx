import { useState, useEffect } from 'react';
import { useCampaignStore } from '../../store/campaignStore';
import { useGameStore } from '../../store/gameStore';
import { ComicPanel } from './ComicPanel';
import { CaptainPicker } from './CaptainPicker';
import type { ComicPanel as ComicPanelType } from '@shared/index';
import { Dialog, DialogContent, DialogTitle } from '../shadcn/dialog';

const labelStyle = { fontFamily: "'IM Fell English SC', serif" };
const pirateStyle = { fontFamily: "'Pirata One', serif" };

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

  return (
    <Dialog open={!!mission} onOpenChange={(open) => !open && closeBriefing()}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        className="bg-gradient-to-b from-[#221210] to-[#2a1410] border-2 border-[#8b0000] rounded p-6 max-w-2xl sm:max-w-2xl panel-glow ring-0"
      >
        {mission && (
          <>
            <div className="text-center mb-4">
              <div className="text-xs text-[#a06820] uppercase tracking-[0.3em]" style={labelStyle}>
                Mission {mission.id} of 15
              </div>
              <DialogTitle
                className="text-4xl text-[#c41e3a]"
                style={{ ...pirateStyle, textShadow: '0 0 14px rgba(196,30,58,0.4)' }}
              >
                {mission.title}
              </DialogTitle>
              <p className="text-[#d4a040] text-sm italic" style={{ fontFamily: "'IM Fell English', serif" }}>
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

            {/* Mission objectives */}
            <div className="bg-[#150c0c]/60 border border-[#8b0000]/40 rounded p-3 mb-4 text-sm">
              <div className="text-[#a06820] uppercase tracking-wider text-xs mb-1" style={labelStyle}>Star Goals</div>
              <div className="text-[#d4c4a1] grid grid-cols-3 gap-2 text-center" style={labelStyle}>
                <div>
                  <span className="text-[#d4a040] text-lg">★</span>
                  <div className="text-xs">Win the battle</div>
                </div>
                <div>
                  <span className="text-[#d4a040] text-lg">★★</span>
                  <div className="text-xs">
                    {mission.starRequirements.twoStars.maxTurns ? `Under ${mission.starRequirements.twoStars.maxTurns} turns` : 'Win efficiently'}
                  </div>
                </div>
                <div>
                  <span className="text-[#d4a040] text-lg">★★★</span>
                  <div className="text-xs">
                    {mission.starRequirements.threeStars.maxTurns ? `Under ${mission.starRequirements.threeStars.maxTurns} turns` : ''}
                    {mission.starRequirements.threeStars.noShipsLost ? ' · No losses' : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Captain picker — only on last panel before battle, if no fixed abilities */}
            {isLast && !(mission.modifiers.fixedAbilities && mission.modifiers.fixedAbilities.length > 0) && (
              <div className="mb-4">
                <CaptainPicker />
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
