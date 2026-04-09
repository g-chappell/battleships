import {
  CellState,
  type CellGrid,
  type Coordinate,
  type Ship,
  ShipType,
  type ShipPlacement,
  Orientation,
  ShotResult,
  type ShotOutcome,
  GRID_SIZE,
  SHIP_LENGTHS,
  coordKey,
} from './types';

export class Board {
  grid: CellGrid;
  ships: Ship[] = [];
  private size: number;

  constructor(size: number = GRID_SIZE) {
    this.size = size;
    this.grid = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => CellState.Empty)
    );
  }

  getShipCells(placement: ShipPlacement): Coordinate[] {
    const { type, start, orientation } = placement;
    const length = SHIP_LENGTHS[type];
    const cells: Coordinate[] = [];
    for (let i = 0; i < length; i++) {
      cells.push({
        row: start.row + (orientation === Orientation.Vertical ? i : 0),
        col: start.col + (orientation === Orientation.Horizontal ? i : 0),
      });
    }
    return cells;
  }

  canPlaceShip(placement: ShipPlacement): boolean {
    const cells = this.getShipCells(placement);

    for (const cell of cells) {
      if (cell.row < 0 || cell.row >= this.size || cell.col < 0 || cell.col >= this.size) {
        return false;
      }
      if (this.grid[cell.row][cell.col] !== CellState.Empty) {
        return false;
      }
    }

    // Check ship type not already placed
    if (this.ships.some((s) => s.type === placement.type)) {
      return false;
    }

    return true;
  }

  placeShip(placement: ShipPlacement): boolean {
    if (!this.canPlaceShip(placement)) return false;

    const cells = this.getShipCells(placement);
    const ship: Ship = {
      type: placement.type,
      cells,
      hits: new Set(),
    };

    for (const cell of cells) {
      this.grid[cell.row][cell.col] = CellState.Ship;
    }

    this.ships.push(ship);
    return true;
  }

  allShipsPlaced(): boolean {
    const requiredTypes = Object.values(ShipType);
    return requiredTypes.every((type) => this.ships.some((s) => s.type === type));
  }

  receiveShot(coord: Coordinate): ShotOutcome {
    const { row, col } = coord;

    if (row < 0 || row >= this.size || col < 0 || col >= this.size) {
      throw new Error(`Shot out of bounds: (${row}, ${col})`);
    }

    const currentState = this.grid[row][col];
    if (currentState === CellState.Hit || currentState === CellState.Miss) {
      throw new Error(`Cell already targeted: (${row}, ${col})`);
    }

    if (currentState === CellState.Ship) {
      this.grid[row][col] = CellState.Hit;
      const key = coordKey(coord);
      const ship = this.ships.find((s) => s.cells.some((c) => coordKey(c) === key))!;
      ship.hits.add(key);

      if (ship.hits.size === ship.cells.length) {
        return { result: ShotResult.Sink, coordinate: coord, sunkShip: ship.type };
      }
      return { result: ShotResult.Hit, coordinate: coord };
    }

    this.grid[row][col] = CellState.Miss;
    return { result: ShotResult.Miss, coordinate: coord };
  }

  allShipsSunk(): boolean {
    return this.ships.length > 0 && this.ships.every((s) => s.hits.size === s.cells.length);
  }

  isValidTarget(coord: Coordinate): boolean {
    const { row, col } = coord;
    if (row < 0 || row >= this.size || col < 0 || col >= this.size) return false;
    const state = this.grid[row][col];
    return state !== CellState.Hit && state !== CellState.Miss && state !== CellState.Land;
  }

  /**
   * Generate random impassable land cells. Must be called BEFORE ship placement.
   * Avoids placing two islands within Chebyshev distance of 2, and avoids the
   * outermost row/column so ships can still hug the edges.
   */
  generateLandCells(count: number = 3): Coordinate[] {
    const placed: Coordinate[] = [];
    const inset = 1; // skip outermost ring
    let attempts = 0;
    while (placed.length < count && attempts < 200) {
      attempts++;
      const row = inset + Math.floor(Math.random() * (this.size - 2 * inset));
      const col = inset + Math.floor(Math.random() * (this.size - 2 * inset));
      if (this.grid[row][col] !== CellState.Empty) continue;
      // Min distance check
      const tooClose = placed.some(
        (p) => Math.max(Math.abs(p.row - row), Math.abs(p.col - col)) < 2
      );
      if (tooClose) continue;
      this.grid[row][col] = CellState.Land;
      placed.push({ row, col });
    }
    return placed;
  }

  getShipAt(coord: Coordinate): Ship | undefined {
    const key = coordKey(coord);
    return this.ships.find((s) => s.cells.some((c) => coordKey(c) === key));
  }

  clone(): Board {
    const board = new Board(this.size);
    board.grid = this.grid.map((row) => [...row]);
    board.ships = this.ships.map((ship) => ({
      ...ship,
      cells: [...ship.cells],
      hits: new Set(ship.hits),
    }));
    return board;
  }
}
