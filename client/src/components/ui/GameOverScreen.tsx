import { useEffect, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useSocketStore } from '../../store/socketStore';
import { playVictoryFanfare, playDefeatTheme } from '../../services/audio';
import { ABILITY_DEFS, CellState } from '@shared/index';
import type { SerializedShip } from '@shared/sockets';
import type { Ship, CellGrid } from '@shared/index';
import { generateShareImage } from '../../services/shareResult';

const GRID = 10;
const CELL_PX = 18;

function serializeShips(ships: Ship[]): SerializedShip[] {
  return ships.map((s) => ({
    type: s.type,
    cells: s.cells,
    hits: [...s.hits],
  }));
}

function getMissCells(grid: CellGrid): Set<string> {
  const misses = new Set<string>();
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === CellState.Miss || grid[r][c] === CellState.LandRevealed) {
        misses.add(`${r},${c}`);
      }
    }
  }
  return misses;
}

function MiniBoard({ ships, label, missCells }: { ships: SerializedShip[]; label: string; missCells?: Set<string> }) {
  const grid: string[][] = Array.from({ length: GRID }, () => Array(GRID).fill('#150c0c'));

  // Render miss cells first (ships will override)
  if (missCells) {
    for (const key of missCells) {
      const [r, c] = key.split(',').map(Number);
      if (r >= 0 && r < GRID && c >= 0 && c < GRID) {
        grid[r][c] = '#3a3a4a'; // grey-blue for miss/land_revealed
      }
    }
  }

  // Render ships on top
  for (const ship of ships) {
    for (const cell of ship.cells) {
      const isHit = ship.hits.includes(`${cell.row},${cell.col}`);
      grid[cell.row][cell.col] = isHit ? '#c41e3a' : '#5d4037';
    }
  }

  return (
    <div>
      <div className="text-[#a06820] text-xs uppercase tracking-wider mb-1 text-center" style={{ fontFamily: "'IM Fell English SC', serif" }}>
        {label}
      </div>
      <div
        className="border border-[#8b0000]/40 rounded overflow-hidden"
        style={{ width: GRID * CELL_PX, height: GRID * CELL_PX }}
      >
        {grid.map((row, r) => (
          <div key={r} className="flex">
            {row.map((color, c) => (
              <div key={c} style={{ width: CELL_PX, height: CELL_PX, backgroundColor: color, border: '1px solid rgba(139,0,0,0.15)' }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function GameOverScreen() {
  const engine = useGameStore((s) => s.engine);
  const gameMode = useGameStore((s) => s.gameMode);
  const resetGame = useGameStore((s) => s.resetGame);
  const startNewGame = useGameStore((s) => s.startNewGame);
  const setScreen = useGameStore((s) => s.setScreen);
  const spAbilitiesUsed = useGameStore((s) => s.spAbilitiesUsed);

  // Multiplayer state
  const matchSummary = useSocketStore((s) => s.matchSummary);
  const requestRematch = useSocketStore((s) => s.requestRematch);
  const selfRequestedRematch = useSocketStore((s) => s.selfRequestedRematch);
  const opponentRequestedRematch = useSocketStore((s) => s.opponentRequestedRematch);
  const resetRoom = useSocketStore((s) => s.resetRoom);

  const isVictory = engine.winner === 'player';
  const accuracy = Math.round(engine.getPlayerShotAccuracy() * 100);

  useEffect(() => {
    if (isVictory) playVictoryFanfare();
    else playDefeatTheme();
  }, [isVictory]);

  const labelStyle = { fontFamily: "'IM Fell English SC', serif" };
  const pirateStyle = { fontFamily: "'Pirata One', serif" };

  const handleMpRematch = () => requestRematch();
  const handleMpExit = () => {
    resetRoom();
    resetGame();
  };

  const handleShare = useCallback(async () => {
    const blob = await generateShareImage({
      isVictory,
      turns: engine.turnCount,
      accuracy,
      shipsSunk: engine.getSunkShipTypes(engine.opponentBoard).length,
      shipsLost: engine.getSunkShipTypes(engine.playerBoard).length,
      ratingDelta: matchSummary?.ratingDelta,
    });
    if (!blob) return;
    if (navigator.share) {
      const file = new File([blob], 'match-result.png', { type: 'image/png' });
      try { await navigator.share({ files: [file] }); } catch { /* cancelled */ }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'match-result.png';
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [isVictory, engine, accuracy, matchSummary]);

  const handleReplay = () => {
    if (matchSummary?.matchId) {
      setScreen('replay');
    }
  };

  // Board reveal data
  const playerShips = serializeShips(engine.playerBoard.ships);
  const playerMisses = getMissCells(engine.playerBoard.grid);

  // Opponent ships: use matchSummary (multiplayer full reveal) or engine (single-player)
  const opponentShips = matchSummary?.opponentShips ?? serializeShips(engine.opponentBoard.ships);
  const opponentMisses = getMissCells(engine.opponentBoard.grid);

  // Abilities used: server-provided for multiplayer, locally tracked for single-player
  const abilitiesUsed = gameMode === 'multiplayer' ? matchSummary?.abilitiesUsed : spAbilitiesUsed;
  const hasAbilities = abilitiesUsed && Object.keys(abilitiesUsed).length > 0;

  return (
    <div className="absolute inset-0 bg-black/85 flex items-center justify-center z-50 overflow-y-auto py-4">
      <div className="bg-gradient-to-b from-[#221210] to-[#2a1410] border-2 border-[#8b0000] rounded p-8 text-center max-w-lg shadow-2xl shadow-[#8b0000]/40">
        <h1
          className={`text-6xl mb-2 ${isVictory ? 'text-[#c41e3a]' : 'text-[#6b6b6b]'}`}
          style={{ ...pirateStyle, textShadow: isVictory ? '0 0 20px rgba(196, 30, 58, 0.6)' : '0 0 20px rgba(0,0,0,0.8)' }}
        >
          {isVictory ? 'Victory!' : 'Defeat!'}
        </h1>
        <p className="text-[#d4c4a1]/70 mb-2 italic" style={{ fontFamily: "'IM Fell English', serif" }}>
          {isVictory
            ? 'Ye sank the entire enemy fleet, captain!'
            : 'Yer fleet sleeps with the fishes...'}
        </p>

        {gameMode === 'multiplayer' && matchSummary?.ratingDelta !== undefined && (
          <p className={`mb-4 font-bold ${matchSummary.ratingDelta > 0 ? 'text-[#2ecc71]' : 'text-[#c41e3a]'}`} style={pirateStyle}>
            {matchSummary.ratingDelta > 0 ? '+' : ''}{matchSummary.ratingDelta} rating
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div className="bg-[#4d2e22]/60 rounded p-3 border border-[#8b0000]/30">
            <div className="text-[#a06820] text-xs uppercase tracking-wider" style={labelStyle}>Turns</div>
            <div className="text-2xl font-bold text-[#e8dcc8]" style={pirateStyle}>{engine.turnCount}</div>
          </div>
          <div className="bg-[#4d2e22]/60 rounded p-3 border border-[#8b0000]/30">
            <div className="text-[#a06820] text-xs uppercase tracking-wider" style={labelStyle}>Accuracy</div>
            <div className="text-2xl font-bold text-[#e8dcc8]" style={pirateStyle}>{accuracy}%</div>
          </div>
          <div className="bg-[#4d2e22]/60 rounded p-3 border border-[#8b0000]/30">
            <div className="text-[#a06820] text-xs uppercase tracking-wider" style={labelStyle}>Ships Sunk</div>
            <div className="text-2xl font-bold text-[#c41e3a]" style={pirateStyle}>
              {engine.getSunkShipTypes(engine.opponentBoard).length}
            </div>
          </div>
          <div className="bg-[#4d2e22]/60 rounded p-3 border border-[#8b0000]/30">
            <div className="text-[#a06820] text-xs uppercase tracking-wider" style={labelStyle}>Ships Lost</div>
            <div className="text-2xl font-bold text-[#8b0000]" style={pirateStyle}>
              {engine.getSunkShipTypes(engine.playerBoard).length}
            </div>
          </div>
        </div>

        {/* Full board reveal — both sides */}
        <div className="flex justify-center gap-6 mb-4">
          <MiniBoard ships={playerShips} label="Your Fleet" missCells={playerMisses} />
          <MiniBoard ships={opponentShips} label="Enemy Fleet" missCells={opponentMisses} />
        </div>

        {/* Abilities used */}
        {hasAbilities && (
          <div className="mb-4 bg-[#4d2e22]/40 rounded p-3 border border-[#8b0000]/20">
            <div className="text-[#a06820] text-xs uppercase tracking-wider mb-2" style={labelStyle}>Abilities Used</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {Object.entries(abilitiesUsed!).map(([type, count]) => {
                const def = ABILITY_DEFS[type as keyof typeof ABILITY_DEFS];
                return (
                  <span key={type} className="text-xs text-[#d4c4a1]/80 bg-[#221210]/60 rounded px-2 py-1">
                    {def?.name ?? type} x{count}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Action buttons */}
        {gameMode === 'multiplayer' ? (
          <>
            <div className="flex gap-3">
              <button
                onClick={handleMpRematch}
                disabled={selfRequestedRematch}
                className="flex-1 px-4 py-3 bg-gradient-to-b from-[#c41e3a] to-[#8b0000] text-[#e8dcc8] font-bold rounded border border-[#c41e3a] hover:from-[#e74c3c] hover:to-[#c41e3a] transition-colors disabled:opacity-50"
                style={pirateStyle}
              >
                {selfRequestedRematch ? 'Waiting...' : 'Rematch'}
              </button>
              <button
                onClick={handleMpExit}
                className="flex-1 px-4 py-3 bg-[#4d2e22] text-[#d4c4a1] font-bold rounded border border-[#8b0000]/40 hover:bg-[#5c2820] transition-colors"
                style={pirateStyle}
              >
                Main Menu
              </button>
            </div>
            {opponentRequestedRematch && !selfRequestedRematch && (
              <p className="mt-3 text-[#d4a040] text-sm italic animate-pulse" style={{ fontFamily: "'IM Fell English', serif" }}>
                Opponent wants a rematch!
              </p>
            )}
            {selfRequestedRematch && opponentRequestedRematch && (
              <p className="mt-3 text-[#2ecc71] text-sm" style={pirateStyle}>
                Both ready! Starting...
              </p>
            )}
          </>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={startNewGame}
              className="flex-1 px-4 py-3 bg-gradient-to-b from-[#c41e3a] to-[#8b0000] text-[#e8dcc8] font-bold rounded border border-[#c41e3a] hover:from-[#e74c3c] hover:to-[#c41e3a] transition-colors"
              style={pirateStyle}
            >
              Play Again
            </button>
            <button
              onClick={resetGame}
              className="flex-1 px-4 py-3 bg-[#4d2e22] text-[#d4c4a1] font-bold rounded border border-[#8b0000]/40 hover:bg-[#5c2820] transition-colors"
              style={pirateStyle}
            >
              Main Menu
            </button>
          </div>
        )}

        {/* Share & Replay */}
        <div className="flex gap-3 mt-3">
          <button
            onClick={handleShare}
            className="flex-1 px-3 py-2 bg-[#221210]/60 text-[#d4c4a1]/70 text-sm rounded border border-[#8b0000]/20 hover:text-[#e8dcc8] hover:border-[#8b0000]/40 transition-colors"
            style={labelStyle}
          >
            Share Result
          </button>
          {matchSummary?.matchId && (
            <button
              onClick={handleReplay}
              className="flex-1 px-3 py-2 bg-[#221210]/60 text-[#d4c4a1]/70 text-sm rounded border border-[#8b0000]/20 hover:text-[#e8dcc8] hover:border-[#8b0000]/40 transition-colors"
              style={labelStyle}
            >
              Watch Replay
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
