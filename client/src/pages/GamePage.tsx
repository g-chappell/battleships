import { useEffect } from 'react';
import { GameScene } from '../components/three/GameScene';
import { ShipTray } from '../components/ui/ShipTray';
import { GameHUD } from '../components/ui/GameHUD';
import { GameOverScreen } from '../components/ui/GameOverScreen';
import { AbilityBar } from '../components/ui/AbilityBar';
import { ChatPanel } from '../components/ui/ChatPanel';
import { OpponentDisconnectOverlay } from '../components/ui/OpponentDisconnectOverlay';
import { MissionOutro } from '../components/ui/MissionBriefing';
import { useCampaignStore } from '../store/campaignStore';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { useAchievementsStore } from '../store/achievementsStore';
import { useCosmeticsStore } from '../store/cosmeticsStore';
import { GamePhase, ShotResult, evaluateAchievements, GOLD_REWARDS } from '@shared/index';
import {
  playCannonFire,
  playHitExplosion,
  playWaterSplash,
  playShipSinking,
  startAmbientLoop,
  stopAmbientLoop,
  isAmbientRunning,
} from '../services/audio';
import { useSettingsStore } from '../store/settingsStore';

export function GamePage() {
  const engine = useGameStore((s) => s.engine);
  useGameStore((s) => s.tick); // subscribe for re-renders
  const lastOutcome = useGameStore((s) => s.lastShotOutcome);
  const isAnimating = useGameStore((s) => s.isAnimating);
  const rotateShip = useGameStore((s) => s.rotateShip);
  const resetGame = useGameStore((s) => s.resetGame);

  const gameMode = useGameStore((s) => s.gameMode);
  const difficulty = useGameStore((s) => s.difficulty);
  const unlockMany = useAchievementsStore((s) => s.unlockMany);
  const alreadyUnlocked = useAchievementsStore((s) => s.unlocked);
  const completeMission = useCampaignStore((s) => s.completeMission);
  const currentMission = useCampaignStore((s) => s.currentMission);
  const token = useAuthStore((s) => s.token);
  const addGold = useCosmeticsStore((s) => s.addGold);

  const musicEnabled = useSettingsStore((s) => s.musicEnabled);

  const isPlacing = engine.phase === GamePhase.Placement;
  const isFinished = engine.phase === GamePhase.Finished;

  // Start/stop ambient soundtrack
  useEffect(() => {
    if (musicEnabled && !isAmbientRunning()) {
      startAmbientLoop();
    }
    return () => { stopAmbientLoop(); };
  }, [musicEnabled]);

  // Evaluate achievements once when the game ends
  useEffect(() => {
    if (!isFinished) return;
    const won = engine.winner === 'player';
    const sunkByPlayer = engine.opponentBoard.ships.filter(s => s.hits.size === s.cells.length).length;
    const sunkByOpponent = engine.playerBoard.ships.filter(s => s.hits.size === s.cells.length).length;
    const accuracy = engine.getPlayerShotAccuracy();
    const shotsFired = Math.max(1, Math.round(engine.turnCount));
    const shotsHit = Math.round(shotsFired * accuracy);
    const ctx = {
      won,
      isMultiplayer: gameMode === 'multiplayer',
      isRanked: gameMode === 'multiplayer',
      isCampaign: false,
      turns: engine.turnCount,
      shotsFired,
      shotsHit,
      shipsSunk: sunkByPlayer,
      shipsLost: sunkByOpponent,
      durationMs: 0,
      abilitiesUsed: {},
      abilitySinks: {},
      ironcladSaved: false,
      submarineSonarBlocked: false,
      totalGames: alreadyUnlocked.size > 0 ? 100 : 1, // approximate
      totalWins: won ? 1 : 0,
      totalShipsSunk: sunkByPlayer,
      rating: 1200,
    };
    const newlyUnlocked = evaluateAchievements(ctx).filter(id => !alreadyUnlocked.has(id));
    if (newlyUnlocked.length > 0) {
      unlockMany(newlyUnlocked);
    }

    // === Gold award ===
    let goldAmount: number = GOLD_REWARDS.LOSS_CONSOLATION;
    if (won) {
      if (gameMode === 'multiplayer') goldAmount = GOLD_REWARDS.WIN_MP_RANKED;
      else if (gameMode === 'campaign') goldAmount = GOLD_REWARDS.WIN_CAMPAIGN;
      else {
        goldAmount =
          difficulty === 'easy'
            ? GOLD_REWARDS.WIN_AI_EASY
            : difficulty === 'medium'
            ? GOLD_REWARDS.WIN_AI_MEDIUM
            : GOLD_REWARDS.WIN_AI_HARD;
      }
    }
    if (token) {
      addGold(goldAmount);
    }

    // Campaign mission completion
    if (gameMode === 'campaign' && currentMission) {
      completeMission(
        {
          won,
          turns: engine.turnCount,
          accuracyPct: Math.round(accuracy * 100),
          shipsLost: sunkByOpponent,
        },
        token
      );
    }
  }, [isFinished, engine, gameMode, difficulty, addGold, alreadyUnlocked, unlockMany, currentMission, completeMission, token]);

  // Sound effects
  useEffect(() => {
    if (!lastOutcome || !isAnimating) return;
    playCannonFire();
    const sfxTimer = setTimeout(() => {
      if (lastOutcome.result === ShotResult.Sink) {
        playShipSinking();
      } else if (lastOutcome.result === ShotResult.Hit) {
        playHitExplosion();
      } else {
        playWaterSplash();
      }
    }, 350);
    return () => clearTimeout(sfxTimer);
  }, [lastOutcome, isAnimating]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        if (isPlacing) rotateShip();
      }
      if (e.key === 'Escape') {
        resetGame();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPlacing, rotateShip, resetGame]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Info bar */}
      <GameHUD />

      {/* Game area */}
      <div className="flex-1 relative min-h-0">
        <GameScene />
        {isPlacing && <ShipTray />}
        <ChatPanel />
        <OpponentDisconnectOverlay />
        {isFinished && gameMode !== 'campaign' && <GameOverScreen />}
        <MissionOutro />
      </div>

      {/* Footer bar */}
      <AbilityBar />
    </div>
  );
}
