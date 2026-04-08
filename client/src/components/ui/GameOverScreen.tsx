import { useGameStore } from '../../store/gameStore';
import { useSocketStore } from '../../store/socketStore';

export function GameOverScreen() {
  const engine = useGameStore((s) => s.engine);
  const gameMode = useGameStore((s) => s.gameMode);
  const resetGame = useGameStore((s) => s.resetGame);
  const startNewGame = useGameStore((s) => s.startNewGame);

  // Multiplayer state
  const matchSummary = useSocketStore((s) => s.matchSummary);
  const requestRematch = useSocketStore((s) => s.requestRematch);
  const selfRequestedRematch = useSocketStore((s) => s.selfRequestedRematch);
  const opponentRequestedRematch = useSocketStore((s) => s.opponentRequestedRematch);
  const resetRoom = useSocketStore((s) => s.resetRoom);
  const setScreen = useGameStore((s) => s.setScreen);

  const isVictory = engine.winner === 'player';
  const accuracy = Math.round(engine.getPlayerShotAccuracy() * 100);

  const labelStyle = { fontFamily: "'IM Fell English SC', serif" };
  const pirateStyle = { fontFamily: "'Pirata One', serif" };

  const handleMpRematch = () => requestRematch();
  const handleMpExit = () => {
    resetRoom();
    resetGame();
  };

  return (
    <div className="absolute inset-0 bg-black/85 flex items-center justify-center z-50">
      <div className="bg-gradient-to-b from-[#1a0a0a] to-[#2a1410] border-2 border-[#8b0000] rounded p-8 text-center max-w-md shadow-2xl shadow-[#8b0000]/40">
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

        <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
          <div className="bg-[#3d1f17]/60 rounded p-3 border border-[#8b0000]/30">
            <div className="text-[#a06820] text-xs uppercase tracking-wider" style={labelStyle}>Turns</div>
            <div className="text-2xl font-bold text-[#e8dcc8]" style={pirateStyle}>{engine.turnCount}</div>
          </div>
          <div className="bg-[#3d1f17]/60 rounded p-3 border border-[#8b0000]/30">
            <div className="text-[#a06820] text-xs uppercase tracking-wider" style={labelStyle}>Accuracy</div>
            <div className="text-2xl font-bold text-[#e8dcc8]" style={pirateStyle}>{accuracy}%</div>
          </div>
          <div className="bg-[#3d1f17]/60 rounded p-3 border border-[#8b0000]/30">
            <div className="text-[#a06820] text-xs uppercase tracking-wider" style={labelStyle}>Ships Sunk</div>
            <div className="text-2xl font-bold text-[#c41e3a]" style={pirateStyle}>
              {engine.getSunkShipTypes(engine.opponentBoard).length}
            </div>
          </div>
          <div className="bg-[#3d1f17]/60 rounded p-3 border border-[#8b0000]/30">
            <div className="text-[#a06820] text-xs uppercase tracking-wider" style={labelStyle}>Ships Lost</div>
            <div className="text-2xl font-bold text-[#8b0000]" style={pirateStyle}>
              {engine.getSunkShipTypes(engine.playerBoard).length}
            </div>
          </div>
        </div>

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
                className="flex-1 px-4 py-3 bg-[#3d1f17] text-[#d4c4a1] font-bold rounded border border-[#8b0000]/40 hover:bg-[#5c2820] transition-colors"
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
              className="flex-1 px-4 py-3 bg-[#3d1f17] text-[#d4c4a1] font-bold rounded border border-[#8b0000]/40 hover:bg-[#5c2820] transition-colors"
              style={pirateStyle}
            >
              Main Menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
