import { useEffect, useState } from 'react';
import { useSocketStore } from '../../store/socketStore';
import { useGameStore } from '../../store/gameStore';

export function OpponentDisconnectOverlay() {
  const gameMode = useGameStore((s) => s.gameMode);
  const disconnected = useSocketStore((s) => s.opponentDisconnected);
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    if (!disconnected) {
      setSecondsLeft(60);
      return;
    }
    setSecondsLeft(60);
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [disconnected]);

  if (gameMode !== 'multiplayer' || !disconnected) return null;

  const pirateStyle = { fontFamily: "'Pirata One', serif" };

  return (
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-40 pointer-events-none">
      <div className="bg-[#221210]/95 border-2 border-[#8b0000] rounded p-6 text-center panel-glow">
        <h2 className="text-2xl text-[#c41e3a] mb-2 animate-pulse" style={pirateStyle}>
          Opponent Lost at Sea
        </h2>
        <p className="text-[#d4c4a1]/70 italic" style={{ fontFamily: "'IM Fell English', serif" }}>
          Awaiting their return...
        </p>
        <div className="text-4xl text-[#d4a040] mt-3" style={pirateStyle}>
          {secondsLeft}s
        </div>
        <p className="text-[#a06820]/70 text-xs mt-2 uppercase tracking-wider">
          Forfeit if no return
        </p>
      </div>
    </div>
  );
}
