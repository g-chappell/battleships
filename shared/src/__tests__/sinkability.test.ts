import { describe, it, expect } from 'vitest';
import { Board } from '../Board';
import { GameEngine } from '../GameEngine';
import {
  createTraitState,
  initNimbleCells,
  processIronclad,
  processNimble,
} from '../traits';
import {
  ShipType,
  Orientation,
  ShotResult,
  CellState,
  coordKey,
  type Coordinate,
  type ShipPlacement,
  type ShotOutcome,
} from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STANDARD_SHIPS: ShipPlacement[] = [
  { type: ShipType.Carrier,    start: { row: 0, col: 0 }, orientation: Orientation.Horizontal },
  { type: ShipType.Battleship, start: { row: 1, col: 0 }, orientation: Orientation.Horizontal },
  { type: ShipType.Cruiser,    start: { row: 2, col: 0 }, orientation: Orientation.Horizontal },
  { type: ShipType.Submarine,  start: { row: 3, col: 0 }, orientation: Orientation.Horizontal },
  { type: ShipType.Destroyer,  start: { row: 4, col: 0 }, orientation: Orientation.Horizontal },
];

function placeAllShips(board: Board): void {
  for (const placement of STANDARD_SHIPS) {
    const ok = board.placeShip(placement);
    if (!ok) throw new Error(`Failed to place ${placement.type}`);
  }
}

// Simulates the store/rooms fire path with traits applied: Nimble forces miss
// on adjacent empty water; Ironclad absorbs first Battleship hit; every other
// hit is normal. Returns the outcome that would be shown to the attacker.
function fireWithTraits(
  board: Board,
  coord: Coordinate,
  traitState: ReturnType<typeof createTraitState>
): ShotOutcome {
  if (processNimble(coord, traitState)) {
    // Post-fix, Nimble only ever matches empty-water cells. Forced miss,
    // no ship mutation needed.
    board.grid[coord.row][coord.col] = CellState.Miss;
    return { result: ShotResult.Miss, coordinate: coord, deflected: false };
  }

  if (!board.isValidTarget(coord)) {
    // Cell already shot — shouldn't happen in well-formed tests but guard it.
    return { result: ShotResult.Miss, coordinate: coord };
  }

  const outcome = board.receiveShot(coord);
  if (outcome.result === ShotResult.Hit || outcome.result === ShotResult.Sink) {
    const negated = processIronclad(board, coord, traitState);
    if (negated) {
      const ship = board.getShipAt(coord);
      if (ship) ship.hits.delete(coordKey(coord));
      board.grid[coord.row][coord.col] = CellState.Ship; // re-targetable
      return { result: ShotResult.Miss, coordinate: coord, deflected: true };
    }
  }
  return outcome;
}

// ─── Load-bearing invariant: every ship is always sinkable ────────────────────

describe('Sinkability invariant — every ship can be sunk regardless of trait placement', () => {
  it('submarine adjacent to destroyer can still be sunk (regression for Nimble bug)', () => {
    // STANDARD_SHIPS places Submarine at row 3 (cols 0-2) and Destroyer at
    // row 4 (cols 0-1). Submarine cells (3,0) and (3,1) are adjacent to the
    // Destroyer. Pre-fix: Nimble locked them as Miss permanently, making the
    // Submarine unsinkable. Post-fix: Nimble only protects empty water.
    const board = new Board();
    placeAllShips(board);

    const traitState = createTraitState();
    traitState.nimbleFirstShotAdjacent = initNimbleCells(board);

    // Fire at every Submarine cell.
    const subCells: Coordinate[] = [
      { row: 3, col: 0 },
      { row: 3, col: 1 },
      { row: 3, col: 2 },
    ];
    for (const cell of subCells) {
      fireWithTraits(board, cell, traitState);
    }

    const submarine = board.ships.find(s => s.type === ShipType.Submarine)!;
    expect(submarine.hits.size).toBe(submarine.cells.length);
  });

  it('completes a full match to Finished state with all traits active', () => {
    // Regression for Bug 2: prior to the fix, the game could stall because
    // Nimble-locked ship cells never accumulated hits. This test walks the
    // attacker through every ship cell once (plus a Battleship cell twice to
    // consume Ironclad) and asserts every ship is fully sunk.
    const board = new Board();
    placeAllShips(board);

    const traitState = createTraitState();
    traitState.nimbleFirstShotAdjacent = initNimbleCells(board);

    const shotsByShip: Record<ShipType, Coordinate[]> = {
      [ShipType.Carrier]:    [0,1,2,3,4].map(c => ({ row: 0, col: c })),
      [ShipType.Battleship]: [0,1,2,3].map(c => ({ row: 1, col: c })),
      [ShipType.Cruiser]:    [0,1,2].map(c => ({ row: 2, col: c })),
      [ShipType.Submarine]:  [0,1,2].map(c => ({ row: 3, col: c })),
      [ShipType.Destroyer]:  [0,1].map(c => ({ row: 4, col: c })),
    };

    // Observed deflections should happen at least once (Battleship first hit).
    let deflectionsSeen = 0;

    for (const ship of [ShipType.Carrier, ShipType.Battleship, ShipType.Cruiser, ShipType.Submarine, ShipType.Destroyer]) {
      for (const cell of shotsByShip[ship]) {
        const outcome = fireWithTraits(board, cell, traitState);
        if (outcome.deflected) deflectionsSeen++;
      }
    }

    // Ironclad deflects the first Battleship hit. Retry that cell to finish the Battleship.
    const battleshipFirstCell = { row: 1, col: 0 };
    if (board.grid[battleshipFirstCell.row][battleshipFirstCell.col] === CellState.Ship) {
      fireWithTraits(board, battleshipFirstCell, traitState);
    }

    for (const ship of board.ships) {
      expect(ship.hits.size).toBe(ship.cells.length);
    }
    expect(board.allShipsSunk()).toBe(true);
    expect(deflectionsSeen).toBeGreaterThanOrEqual(1);
  });

  it('full match completes via GameEngine with traits applied (end-to-end)', () => {
    const engine = new GameEngine();
    for (const placement of STANDARD_SHIPS) {
      engine.placePlayerShip(placement);
      engine.placeOpponentShip(placement);
    }
    engine.startGame();

    const traitState = createTraitState();
    traitState.nimbleFirstShotAdjacent = initNimbleCells(engine.opponentBoard);

    const allTargets: Coordinate[] = [];
    for (let r = 0; r <= 4; r++) {
      const len = r === 0 ? 5 : r === 1 ? 4 : r === 2 ? 3 : r === 3 ? 3 : 2;
      for (let c = 0; c < len; c++) allTargets.push({ row: r, col: c });
    }

    for (const coord of allTargets) {
      fireWithTraits(engine.opponentBoard, coord, traitState);
    }

    // Retry the Ironclad-deflected Battleship cell (grid = Ship after deflect)
    const bsCell = { row: 1, col: 0 };
    if (engine.opponentBoard.grid[bsCell.row][bsCell.col] === CellState.Ship) {
      fireWithTraits(engine.opponentBoard, bsCell, traitState);
    }

    expect(engine.opponentBoard.allShipsSunk()).toBe(true);
  });
});
