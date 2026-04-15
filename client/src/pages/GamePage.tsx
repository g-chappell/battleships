import { useEffect, useRef } from 'react';
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
import { useSocketStore } from '../store/socketStore';

export function GamePage() {
  const engine = useGameStore((s) => s.engine);
  useGameStore((s) => s.tick); // subscribe for re-renders
  const lastOutcome = useGameStore((s) => s.lastShotOutcome);
  const isAnimating = useGameStore((s) => s.isAnimating);
  const rotateShip = useGameStore((s) => s.rotateShip);
  const resetGame = useGameStore((s) => s.resetGame);

  const gameMode = useGameStore((s) => s.gameMode);
  const difficulty = useGameStore((s) => s.difficulty);
  const startMultiplayerGame = useGameStore((s) => s.startMultiplayerGame);
  const unlockMany = useAchievementsStore((s) => s.unlockMany);
  const alreadyUnlocked = useAchievementsStore((s) => s.unlocked);
  const completeMission = useCampaignStore((s) => s.completeMission);
  const currentMission = useCampaignStore((s) => s.currentMission);
  const token = useAuthStore((s) => s.token);
  const addGold = useCosmeticsStore((s) => s.addGold);

  const musicEnabled = useSettingsStore((s) => s.musicEnabled);

  const socketStatus = useSocketStore((s) => s.status);
  const reconnectAttempts = useSocketStore((s) => s.reconnectAttempts);
  const socketErrorMessage = useSocketStore((s) => s.errorMessage);
  const roomId = useSocketStore((s) => s.roomId);

  const isPlacing = engine.phase === GamePhase.Placement;
  const isFinished = engine.phase === GamePhase.Finished;

  // Rematch reset: MultiplayerLobby normally triggers startMultiplayerGame() on
  // mm:matched, but on rematch the lobby is no longer mounted (we're on the
  // game screen showing GameOverScreen). Detect the rematch by watching for a
  // *new* roomId while we're already in a multiplayer game — the initial
  // roomId is handled by the lobby before GamePage mounts, so we only act on a
  // transition from one roomId to another.
  const prevRoomIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prevRoomId = prevRoomIdRef.current;
    prevRoomIdRef.current = roomId;
    if (
      gameMode === 'multiplayer' &&
      roomId &&
      prevRoomId &&
      roomId !== prevRoomId
    ) {
      startMultiplayerGame();
    }
  }, [gameMode, roomId, startMultiplayerGame]);

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
        {gameMode === 'multiplayer' && socketStatus === 'reconnecting' && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-40">
            <div className="bg-[#221210]/95 border-2 border-[#8b0000] rounded p-6 text-center panel-glow">
              <h2 className="text-2xl text-[#c41e3a] mb-2 animate-pulse" style={{ fontFamily: "'Pirata One', serif" }}>
                Lost at Sea
              </h2>
              <p className="text-[#d4c4a1]/70 italic" style={{ fontFamily: "'IM Fell English', serif" }}>
                Reconnecting to the battle...
              </p>
              <p className="text-[#a06820] text-sm mt-2 uppercase tracking-wider">
                Attempt {reconnectAttempts} of 5
              </p>
            </div>
          </div>
        )}
        {gameMode === 'multiplayer' && socketStatus === 'error' && socketErrorMessage === 'Connection lost — return to menu' && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
            <div className="bg-[#221210]/95 border-2 border-[#8b0000] rounded p-6 text-center panel-glow">
              <h2 className="text-2xl text-[#c41e3a] mb-2" style={{ fontFamily: "'Pirata One', serif" }}>
                Connection Lost
              </h2>
              <p className="text-[#d4c4a1]/70 italic mb-4" style={{ fontFamily: "'IM Fell English', serif" }}>
                Could not reconnect to the high seas.
              </p>
              <button
                onClick={resetGame}
                className="px-6 py-2 bg-gradient-to-b from-[#c41e3a] to-[#8b0000] text-[#e8dcc8] font-bold rounded border border-[#c41e3a] hover:from-[#e74c3c] hover:to-[#c41e3a] transition-colors"
                style={{ fontFamily: "'Pirata One', serif" }}
              >
                Return to Menu
              </button>
            </div>
          </div>
        )}
        {isFinished && gameMode !== 'campaign' && <GameOverScreen />}
        <MissionOutro />
      </div>

      {/* Footer bar */}
      <AbilityBar />
    </div>
  );
}
