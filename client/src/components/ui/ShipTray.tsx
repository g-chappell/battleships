import { ShipType, SHIP_LENGTHS, SHIP_NAMES, isCoastalShip } from '@shared/index';
import { useGameStore } from '../../store/gameStore';

// Passive trait per ship type, surfaced during placement so the player can
// plan positions (e.g. coastal vs. open water). The Coastal Cover badge is
// added separately when any ship cell is adjacent to a land tile.
const SHIP_TRAIT: Record<ShipType, { name: string; blurb: string }> = {
  [ShipType.Carrier]:    { name: 'Spotter',        blurb: 'On hit: reveal a random enemy cell.' },
  [ShipType.Battleship]: { name: 'Ironclad',       blurb: 'First hit is deflected; cell stays targetable.' },
  [ShipType.Cruiser]:    { name: 'Kraken Ward',    blurb: 'Never targeted by Summon Kraken.' },
  [ShipType.Submarine]:  { name: 'Silent Running', blurb: 'Invisible to Sonar Ping precision reveal.' },
  [ShipType.Destroyer]:  { name: 'Depth Charge',   blurb: 'First hit: 6 random shots back at attacker.' },
};

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
  const engine = useGameStore((s) => s.engine);
  useGameStore((s) => s.tick); // re-render on grid/placement changes

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
          const trait = SHIP_TRAIT[type];
          const coastal = isPlaced && isCoastalShip(engine.playerBoard, type);

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
              <div className="mt-1.5 flex items-center gap-1 text-[10px] leading-tight">
                <span className="font-bold text-[#d4a040]">{trait.name}</span>
                {coastal && (
                  <span className="px-1 rounded bg-[#3a6028]/50 text-[#a8d68a] border border-[#3a6028]/70" title="Adjacent to land — gets Coastal Cover (one-time deflect, replaces Ironclad if a Battleship)">
                    🜂 Coastal
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[10px] opacity-70 leading-snug italic">
                {trait.blurb}
              </div>
            </button>
          );
        })}
        <div className="mt-2 text-[10px] text-parchment/50 italic leading-snug" style={{ fontFamily: "'IM Fell English', serif" }}>
          Place a ship adjacent to land for <span className="text-[#a8d68a]">Coastal Cover</span> — one free deflect on its first hit. Does not stack with Ironclad.
        </div>
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
          data-testid="btn-auto-place"
          onClick={autoPlaceShips}
          className="w-full px-3 py-2 bg-[#2a1410] text-[#d4c4a1] rounded text-sm hover:bg-[#4d2e22] transition-colors border border-[#8b0000]/30"
          style={labelStyle}
        >
          Auto-Place
        </button>

        {allPlaced && !isWaitingForOpponent && (
          <button
            data-testid="btn-ready"
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
