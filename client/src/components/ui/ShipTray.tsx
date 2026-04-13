import { ShipType, SHIP_LENGTHS, SHIP_NAMES } from '@shared/types';
import { useGameStore } from '../../store/gameStore';

export function ShipTray() {
  const placingShipType = useGameStore((s) => s.placingShipType);
  const placingOrientation = useGameStore((s) => s.placingOrientation);
  const placedShips = useGameStore((s) => s.placedShips);
  const selectShipToPlace = useGameStore((s) => s.selectShipToPlace);
  const rotateShip = useGameStore((s) => s.rotateShip);
  const autoPlaceShips = useGameStore((s) => s.autoPlaceShips);
  const confirmPlacement = useGameStore((s) => s.confirmPlacement);
  const gameMode = useGameStore((s) => s.gameMode);
  const mpPlacementSubmitted = useGameStore((s) => s.mpPlacementSubmitted);

  const allPlaced = placedShips.length === Object.values(ShipType).length;
  const isWaitingForOpponent = gameMode === 'multiplayer' && mpPlacementSubmitted;

  const labelStyle = { fontFamily: "'IM Fell English SC', serif" };

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-gradient-to-b from-[#221210]/95 to-[#150c0c]/95 border border-[#8b0000]/50 rounded p-4 lg:p-3 w-56 shadow-xl shadow-[#8b0000]/20 max-h-[calc(100%-24px)] overflow-y-auto">
      <h3 className="text-[#c41e3a] font-bold text-base uppercase tracking-wider mb-3" style={{ fontFamily: "'Pirata One', serif", textShadow: '0 0 8px rgba(196, 30, 58, 0.4)' }}>
        Deploy Fleet
      </h3>

      <div className="space-y-2 mb-4">
        {Object.values(ShipType).map((type) => {
          const isPlaced = placedShips.includes(type);
          const isSelected = placingShipType === type;

          return (
            <button
              key={type}
              onClick={() => !isPlaced && selectShipToPlace(type)}
              disabled={isPlaced}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors border ${
                isPlaced
                  ? 'bg-[#5c0000]/30 text-[#c41e3a] cursor-default border-[#8b0000]/40'
                  : isSelected
                  ? 'bg-[#8b0000]/40 text-[#e8dcc8] border-[#c41e3a]'
                  : 'bg-[#4d2e22]/40 text-[#d4c4a1] border-[#4d2e22] hover:bg-[#5c2820]/50'
              }`}
              style={labelStyle}
            >
              <div className="flex justify-between items-center">
                <span className="font-bold">{SHIP_NAMES[type]}</span>
                <span className="text-xs opacity-70">
                  {isPlaced ? '✓' : `${SHIP_LENGTHS[type]} cells`}
                </span>
              </div>
              <div className="flex gap-0.5 mt-1">
                {Array.from({ length: SHIP_LENGTHS[type] }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-sm ${
                      isPlaced ? 'bg-[#c41e3a]' : 'bg-[#a06820]/60'
                    }`}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <button
          onClick={rotateShip}
          className="w-full px-3 py-2 bg-[#4d2e22] text-[#e8dcc8] rounded text-sm hover:bg-[#5c2820] transition-colors border border-[#8b0000]/30"
          style={labelStyle}
        >
          Rotate [R] — {placingOrientation}
        </button>

        <button
          onClick={autoPlaceShips}
          className="w-full px-3 py-2 bg-[#2a1410] text-[#d4c4a1] rounded text-sm hover:bg-[#4d2e22] transition-colors border border-[#8b0000]/30"
          style={labelStyle}
        >
          Auto-Place
        </button>

        {allPlaced && !isWaitingForOpponent && (
          <button
            onClick={confirmPlacement}
            className="w-full px-3 py-2 bg-gradient-to-b from-[#c41e3a] to-[#8b0000] text-[#e8dcc8] font-bold rounded text-sm hover:from-[#e74c3c] hover:to-[#c41e3a] transition-colors border border-[#c41e3a]"
            style={{ fontFamily: "'Pirata One', serif" }}
          >
            Ready for Battle!
          </button>
        )}

        {isWaitingForOpponent && (
          <div
            className="w-full px-3 py-3 bg-[#4d2e22]/60 text-[#d4a040] text-sm rounded border border-[#a06820]/50 text-center italic animate-pulse"
            style={{ fontFamily: "'IM Fell English', serif" }}
          >
            Awaiting opponent...
          </div>
        )}
      </div>
    </div>
  );
}
