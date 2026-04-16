import { useGameStore } from '../../store/gameStore';

/**
 * Top-of-screen banner shown whenever either side is mid-Kraken-ritual.
 * Gives both players strong visual feedback: the caster sees their chant
 * progressing, the opponent sees an ominous warning that they have a window
 * to counter-attack before the Kraken strikes.
 */
export function RitualOverlay() {
  useGameStore((s) => s.tick);
  const playerRitual = useGameStore((s) => s.playerRitualTurnsRemaining);
  const opponentRitual = useGameStore((s) => s.opponentRitualTurnsRemaining);

  const active =
    (playerRitual && playerRitual > 0) || (opponentRitual && opponentRitual > 0);
  if (!active) return null;

  const isCaster = !!(playerRitual && playerRitual > 0);
  const turns = isCaster ? playerRitual! : opponentRitual!;

  return (
    <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-40">
      <div
        className={`relative px-8 py-3 rounded-lg border-2 shadow-2xl backdrop-blur-md ${
          isCaster
            ? 'border-[#4a2858] bg-[#1a0e24]/95 shadow-[#4a2858]/60'
            : 'border-[#c41e3a] bg-[#1a0606]/95 shadow-[#c41e3a]/60'
        }`}
        style={{
          animation: 'krakenPulse 2.5s ease-in-out infinite',
        }}
      >
        {/* Ink glyph spinner */}
        <span
          className={`inline-block mr-3 text-2xl ${isCaster ? 'text-[#a060c0]' : 'text-[#c41e3a]'}`}
          style={{
            animation: 'krakenSpin 4s linear infinite',
          }}
        >
          🜻
        </span>
        <span
          className={`text-lg uppercase tracking-widest ${
            isCaster ? 'text-[#d8b8e8]' : 'text-[#e8dcc8]'
          }`}
          style={{ fontFamily: "'Pirata One', serif" }}
        >
          {isCaster ? 'Summoning the Kraken' : 'Enemy summons the Kraken'}
        </span>
        <span
          className={`ml-3 text-sm italic ${isCaster ? 'text-[#a060c0]' : 'text-[#a06820]'}`}
          style={{ fontFamily: "'IM Fell English', serif" }}
        >
          {turns} turn{turns === 1 ? '' : 's'} remain
        </span>
      </div>
      <style>{`
        @keyframes krakenPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.02); }
        }
        @keyframes krakenSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
