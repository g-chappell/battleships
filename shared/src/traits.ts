import { Board } from './Board';
import {
  ShipType,
  type Coordinate,
  type ShotOutcome,
  ShotResult,
  GRID_SIZE,
} from './types';

export interface TraitEffect {
  // Returned after a shot resolves, describes any trait side effects
  revealedCells?: Coordinate[];   // Spotter: cells revealed to the attacker
  negated?: boolean;              // Ironclad / Coastal Cover: shot was absorbed
}

export interface TraitState {
  ironcladUsed: Set<ShipType>;          // Ships that have used their armor
  coastalCoverUsed: Set<ShipType>;      // Ships that have consumed their coastal deflect
  depthChargeUsed: boolean;             // Whether Destroyer's retaliation has fired this match
}

export function createTraitState(): TraitState {
  return {
    ironcladUsed: new Set(),
    coastalCoverUsed: new Set(),
    depthChargeUsed: false,
  };
}

/**
 * Process Ironclad trait: Battleship's first hit is negated.
 * Returns true if the hit was negated (should be converted to a "miss" effectively).
 *
 * NOTE: callers must check Coastal Cover first via `processCoastalCover` — a
 * Battleship placed adjacent to land gets Coastal Cover *instead of* Ironclad
 * (deflect traits do not stack). See `applyDeflectionTrait`.
 */
export function processIronclad(
  board: Board,
  coord: Coordinate,
  traitState: TraitState
): boolean {
  const ship = board.getShipAt(coord);
  if (!ship || ship.type !== ShipType.Battleship) return false;
  if (traitState.ironcladUsed.has(ShipType.Battleship)) return false;

  traitState.ironcladUsed.add(ShipType.Battleship);
  return true;
}

/**
 * Process Spotter trait: When Carrier is hit, reveal one random adjacent enemy cell.
 * Returns the revealed coordinates, or empty array.
 */
export function processSpotter(
  defendingBoard: Board,
  attackingBoard: Board,
  coord: Coordinate,
  shotResult: ShotResult
): Coordinate[] {
  if (shotResult === ShotResult.Miss) return [];

  const ship = defendingBoard.getShipAt(coord);
  if (!ship || ship.type !== ShipType.Carrier) return [];

  // Find a random unrevealed cell on the attacking board adjacent to a ship
  const candidates: Coordinate[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (attackingBoard.isValidTarget({ row, col })) {
        candidates.push({ row, col });
      }
    }
  }

  if (candidates.length === 0) return [];

  // Pick a random valid target to reveal
  const revealed = candidates[Math.floor(Math.random() * candidates.length)];
  return [revealed];
}

/**
 * Return true if any cell of the ship is orthogonally adjacent to a Land or
 * LandRevealed cell. Used to determine Coastal Cover eligibility.
 */
export function isCoastalShip(board: Board, shipType: ShipType): boolean {
  const ship = board.ships.find((s) => s.type === shipType);
  if (!ship) return false;
  for (const cell of ship.cells) {
    const neighbors: Coordinate[] = [
      { row: cell.row - 1, col: cell.col },
      { row: cell.row + 1, col: cell.col },
      { row: cell.row, col: cell.col - 1 },
      { row: cell.row, col: cell.col + 1 },
    ];
    for (const n of neighbors) {
      if (n.row < 0 || n.row >= GRID_SIZE || n.col < 0 || n.col >= GRID_SIZE) continue;
      const state = board.grid[n.row][n.col];
      if (state === 'land' || state === 'land_revealed') return true;
    }
  }
  return false;
}

/**
 * Return true if the given coord belongs to a Submarine on this board.
 * Used by Sonar Ping to exclude Submarine cells from precise reveal.
 */
export function isSubmarineCell(board: Board, coord: Coordinate): boolean {
  const ship = board.getShipAt(coord);
  return ship?.type === ShipType.Submarine;
}

/**
 * Process Coastal Cover: the first hit on any cell of a land-adjacent ship is
 * deflected. One-shot per ship. Returns true if the hit should be treated as
 * deflected.
 */
export function processCoastalCover(
  board: Board,
  coord: Coordinate,
  traitState: TraitState
): boolean {
  const ship = board.getShipAt(coord);
  if (!ship) return false;
  if (traitState.coastalCoverUsed.has(ship.type)) return false;
  if (!isCoastalShip(board, ship.type)) return false;
  traitState.coastalCoverUsed.add(ship.type);
  return true;
}

/**
 * Decide which single first-hit deflect (if any) applies for the given cell.
 * Coastal Cover has priority over Ironclad (they never stack — see plan). For
 * any other ship, only Coastal Cover can apply.
 *
 * Returns the deflection source, or null if no deflect fires.
 */
export type DeflectionSource = 'ironclad' | 'coastal';

export function applyDeflectionTrait(
  board: Board,
  coord: Coordinate,
  traitState: TraitState
): DeflectionSource | null {
  const ship = board.getShipAt(coord);
  if (!ship) return null;

  // Coastal Cover first — wins where eligible, consuming the ship's one deflect.
  if (processCoastalCover(board, coord, traitState)) {
    return 'coastal';
  }

  // Ironclad only applies to Battleship. It also requires that Coastal Cover
  // has NOT already fired on this Battleship (deflects don't stack).
  if (
    ship.type === ShipType.Battleship &&
    !traitState.coastalCoverUsed.has(ShipType.Battleship) &&
    processIronclad(board, coord, traitState)
  ) {
    return 'ironclad';
  }

  return null;
}

/**
 * Process Depth Charge trigger: first hit on ANY Destroyer cell fires 6
 * retaliatory shots on the attacker's board. Returns true if the trigger
 * should fire; callers run `resolveDepthChargeShots` afterwards.
 */
export function processDepthCharge(
  board: Board,
  coord: Coordinate,
  traitState: TraitState
): boolean {
  if (traitState.depthChargeUsed) return false;
  const ship = board.getShipAt(coord);
  if (!ship || ship.type !== ShipType.Destroyer) return false;
  traitState.depthChargeUsed = true;
  return true;
}

/** Alias of ShotOutcome for readability at call sites. */
export type DepthChargeShot = ShotOutcome;

/**
 * Fire `count` retaliatory shots at random unshot cells on the attacker's board.
 * Each shot resolves through `Board.receiveShot` so Hit/Sink is recorded.
 *
 * IMPORTANT: these shots bypass retaliation-based traits in the calling code
 * to prevent cascading Depth Charges (if a shot lands on the attacker's own
 * Destroyer). Callers must NOT invoke `processDepthCharge` on these outcomes.
 * They DO still interact with Ironclad / Coastal Cover via normal trait
 * processing at the caller site, which is fair (retaliation still respects
 * armor).
 */
export function resolveDepthChargeShots(
  attackerBoard: Board,
  count = 6
): ShotOutcome[] {
  const candidates: Coordinate[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (attackerBoard.isValidTarget({ row, col })) {
        candidates.push({ row, col });
      }
    }
  }

  const shots: ShotOutcome[] = [];
  for (let i = 0; i < count && candidates.length > 0; i++) {
    const idx = Math.floor(Math.random() * candidates.length);
    const [coord] = candidates.splice(idx, 1);
    const outcome = attackerBoard.receiveShot(coord);
    shots.push(outcome);
  }
  return shots;
}
