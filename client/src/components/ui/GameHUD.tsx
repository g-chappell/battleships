import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { GamePhase, ShotResult, SHIP_NAMES } from '@shared/index';

const PLAYER_HIT = ['Direct Hit!', 'Bullseye!', 'Target struck!', 'A solid hit!'];
const PLAYER_MISS = ['Splash! Missed.', 'Nothing but ocean...', 'The shot goes wide.'];
const PLAYER_SINK = ['sinks beneath the waves!', 'has been destroyed!', 'is going down!'];
const AI_HIT = ["We've been hit!", 'Hull breach!', 'Enemy fire connects!'];
const AI_MISS = ['They missed!', 'Their aim falters!', 'The enemy shot goes wide.'];
const AI_SINK = ['has been lost...', 'is sinking!', 'takes a fatal blow!'];

function pick(arr: string[]) { return arr[Math.floor(Math.random() * arr.length)]; }

export function GameHUD() {
  const engine = useGameStore((s) => s.engine);
  useGameStore((s) => s.tick); // subscribe for re-renders
  const isAnimating = useGameStore((s) => s.isAnimating);
  const lastOutcome = useGameStore((s) => s.lastShotOutcome);

  const isPlaying = engine.phase === GamePhase.Playing;
  const isFinished = engine.phase === GamePhase.Finished;
  const isPlayerTurn = engine.currentTurn === 'player';

  const playerRemaining = engine.getPlayerShipsRemaining();
  const opponentRemaining = engine.getOpponentShipsRemaining();
  const opponentSunk = engine.getSunkShipTypes(engine.opponentBoard);

  const [commentary, setCommentary] = useState('Prepare for battle, captain!');

  useEffect(() => {
    if (!lastOutcome || !isAnimating) return;
    const playerShot = engine.currentTurn === 'opponent'
      || (engine.currentTurn === 'player' && lastOutcome.result !== ShotResult.Miss)
      || (engine.phase === GamePhase.Finished && engine.winner === 'player');

    if (lastOutcome.result === ShotResult.Sink && lastOutcome.sunkShip) {
      setCommentary(playerShot
        ? `${SHIP_NAMES[lastOutcome.sunkShip]} ${pick(PLAYER_SINK)}`
        : `Our ${SHIP_NAMES[lastOutcome.sunkShip]} ${pick(AI_SINK)}`);
    } else if (lastOutcome.result === ShotResult.Hit) {
      setCommentary(playerShot ? pick(PLAYER_HIT) : pick(AI_HIT));
    } else {
      setCommentary(playerShot ? pick(PLAYER_MISS) : pick(AI_MISS));
    }
  }, [lastOutcome, isAnimating]);

  if (!isPlaying && !isFinished) return null;

  const labelStyle = { fontFamily: "'IM Fell English SC', serif" };

  return (
    <div className="mx-2 sm:mx-4 mt-4 lg:mt-2 h-14 bg-[#221210]/95 backdrop-blur-lg border border-[#c41e3a]/70 rounded-full flex items-center px-3 sm:px-8 gap-2 sm:gap-5 shrink-0 panel-glow overflow-x-auto shadow-[0_0_14px_rgba(196,30,58,0.3)]">
      <div className="flex items-center gap-2" style={labelStyle}>
        <span className="text-sm text-[#a06820] uppercase tracking-wider">Turn</span>
        <span className="text-lg font-bold text-[#e8dcc8]">{engine.turnCount}</span>
      </div>

      <div className="w-px h-6 bg-[#8b0000]/30" />

      <div
        className={`px-3 py-1 rounded text-xs font-bold border ${
          isFinished
            ? engine.winner === 'player'
              ? 'bg-[#5c1010]/40 text-[#c41e3a] border-[#c41e3a]/50'
              : 'bg-[#1a0a0a]/60 text-[#6b6b6b] border-[#444]/30'
            : isPlayerTurn
            ? 'bg-[#5c0000]/40 text-[#c41e3a] border-[#c41e3a]/50'
            : 'bg-[#1a0a0a]/60 text-[#a06820] border-[#a06820]/30'
        }`}
        style={labelStyle}
      >
        {isFinished
          ? engine.winner === 'player' ? 'VICTORY' : 'DEFEAT'
          : isAnimating ? 'Firing...'
          : isPlayerTurn ? 'Your Turn' : 'Enemy Turn'}
      </div>

      <div className="w-px h-6 bg-[#8b0000]/30" />

      <div className="hidden md:flex items-center gap-2" style={labelStyle}>
        <span className="text-sm text-[#a06820] uppercase tracking-wider">Acc</span>
        <span className="text-lg font-bold text-[#e8dcc8]">{Math.round(engine.getPlayerShotAccuracy() * 100)}%</span>
      </div>

      <div className="hidden md:block w-px h-6 bg-[#8b0000]/30" />

      <div className="flex items-center gap-1" style={labelStyle}>
        <span className="text-sm text-[#a06820] uppercase tracking-wider">Fleet</span>
        <span className="text-lg font-bold text-[#c41e3a]">{playerRemaining}/5</span>
      </div>
      <div className="flex items-center gap-1" style={labelStyle}>
        <span className="text-sm text-[#a06820] uppercase tracking-wider">Enemy</span>
        <span className="text-lg font-bold text-[#c41e3a]">{opponentRemaining}/5</span>
      </div>

      {opponentSunk.length > 0 && (
        <div className="hidden md:flex items-center gap-2">
          <div className="w-px h-6 bg-[#8b0000]/30" />
          <span className="text-sm text-[#e8dcc8] whitespace-nowrap" style={labelStyle}>
            Sunk: {opponentSunk.map((t) => SHIP_NAMES[t]).join(', ')}
          </span>
        </div>
      )}

      <div className="flex-1" />

      <div className="hidden sm:block text-lg italic text-[#c41e3a] truncate max-w-md" style={{ fontFamily: "'IM Fell English', serif", textShadow: '0 0 8px rgba(196, 30, 58, 0.3)' }}>
        {commentary}
      </div>
    </div>
  );
}
