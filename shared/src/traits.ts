import { Board } from './Board';
import {
  ShipType,
  CellState,
  type Coordinate,
  ShotResult,
  coordKey,
  GRID_SIZE,
} from './types';

export interface TraitEffect {
  // Returned after a shot resolves, describes any trait side effects
  revealedCells?: Coordinate[];   // Spotter: cells revealed to the attacker
  negated?: boolean;              // Ironclad: shot was absorbed by armor
  adjacentMissForced?: boolean;   // Nimble: adjacent miss was forced
}

export interface TraitState {
  ironcladUsed: Set<ShipType>;          // Ships that have used their armor
  swiftUsed: boolean;                    // Whether cruiser reposition was used
  nimbleFirstShotAdjacent: Set<string>; // "row,col" of cells adjacent to destroyer that auto-miss
}

export function createTraitState(): TraitState {
  return {
    ironcladUsed: new Set(),
    swiftUsed: false,
    nimbleFirstShotAdjacent: new Set(),
  };
}

/**
 * Initialize nimble adjacent cells based on destroyer position.
 * Called after ship placement is finalized.
 */
export function initNimbleCells(board: Board): Set<string> {
  const destroyer = board.ships.find((s) => s.type === ShipType.Destroyer);
  if (!destroyer) return new Set();

  const shipCells = new Set(destroyer.cells.map((c) => coordKey(c)));
  const adjacent = new Set<string>();

  for (const cell of destroyer.cells) {
    const neighbors: Coordinate[] = [
      { row: cell.row - 1, col: cell.col },
      { row: cell.row + 1, col: cell.col },
      { row: cell.row, col: cell.col - 1 },
      { row: cell.row, col: cell.col + 1 },
    ];
    for (const n of neighbors) {
      if (n.row >= 0 && n.row < GRID_SIZE && n.col >= 0 && n.col < GRID_SIZE) {
        const key = coordKey(n);
        if (!shipCells.has(key)) {
          adjacent.add(key);
        }
      }
    }
  }

  return adjacent;
}

/**
 * Process Ironclad trait: Battleship's first hit is negated.
 * Returns true if the hit was negated (should be converted to a "miss" effectively).
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
 * Process Nimble trait: First shot on cells adjacent to Destroyer auto-misses.
 * Returns true if the shot should be forced to miss.
 */
export function processNimble(
  coord: Coordinate,
  traitState: TraitState
): boolean {
  const key = coordKey(coord);
  if (traitState.nimbleFirstShotAdjacent.has(key)) {
    // Remove it — only works once per adjacent cell
    traitState.nimbleFirstShotAdjacent.delete(key);
    return true;
  }
  return false;
}

/**
 * Attempt Swift reposition: Move Cruiser by 1 cell in any direction.
 * Returns true if reposition succeeded.
 */
export function processSwift(
  board: Board,
  direction: 'up' | 'down' | 'left' | 'right',
  traitState: TraitState
): boolean {
  if (traitState.swiftUsed) return false;

  const cruiser = board.ships.find((s) => s.type === ShipType.Cruiser);
  if (!cruiser) return false;

  // Check if cruiser is still alive (not fully sunk)
  if (cruiser.hits.size === cruiser.cells.length) return false;

  const delta: Coordinate = {
    up: { row: -1, col: 0 },
    down: { row: 1, col: 0 },
    left: { row: 0, col: -1 },
    right: { row: 0, col: 1 },
  }[direction];

  const newCells = cruiser.cells.map((c) => ({
    row: c.row + delta.row,
    col: c.col + delta.col,
  }));

  // Validate new position
  for (const cell of newCells) {
    if (cell.row < 0 || cell.row >= GRID_SIZE || cell.col < 0 || cell.col >= GRID_SIZE) {
      return false;
    }
    // Check no overlap with other ships (excluding cruiser's current cells)
    const cruiserCellKeys = new Set(cruiser.cells.map(coordKey));
    const key = coordKey(cell);
    if (!cruiserCellKeys.has(key)) {
      const existing = board.getShipAt(cell);
      if (existing && existing.type !== ShipType.Cruiser) {
        return false;
      }
    }
  }

  // Clear old cells from grid
  for (const cell of cruiser.cells) {
    if (!cruiser.hits.has(coordKey(cell))) {
      board.grid[cell.row][cell.col] = CellState.Empty;
    }
  }

  // Update cells
  cruiser.cells.length = 0;
  cruiser.hits.clear();

  for (let i = 0; i < newCells.length; i++) {
    cruiser.cells.push(newCells[i]);
    board.grid[newCells[i].row][newCells[i].col] = CellState.Ship;
  }

  // Transfer hit status to new positions
  // (hits move with the ship conceptually — same relative positions)
  // Actually hits stay relative to original — this is simpler: just mark the ship cells as Ship
  // Old hits don't transfer since the ship moved

  traitState.swiftUsed = true;
  return true;
}
