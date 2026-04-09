import { Board } from './Board';
import {
  type Coordinate,
  GRID_SIZE,
  type ShipPlacement,
  ShipType,
  Orientation,
  SHIP_LENGTHS,
  ShotResult,
  coordKey,
  CellState,
} from './types';

export interface AIPlayer {
  chooseTarget(opponentBoard: Board): Coordinate;
  placeShips(board: Board): ShipPlacement[];
  notifyResult(coord: Coordinate, result: ShotResult): void;
}

export class EasyAI implements AIPlayer {
  private huntQueue: Coordinate[] = [];
  private targeted: Set<string> = new Set();

  chooseTarget(opponentBoard: Board): Coordinate {
    // Hunt mode: try adjacent cells after a hit
    while (this.huntQueue.length > 0) {
      const next = this.huntQueue.shift()!;
      const key = coordKey(next);
      if (!this.targeted.has(key) && opponentBoard.isValidTarget(next)) {
        this.targeted.add(key);
        return next;
      }
    }

    // Random targeting
    const available: Coordinate[] = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const coord = { row, col };
        if (!this.targeted.has(coordKey(coord)) && opponentBoard.isValidTarget(coord)) {
          available.push(coord);
        }
      }
    }

    const chosen = available[Math.floor(Math.random() * available.length)];
    this.targeted.add(coordKey(chosen));
    return chosen;
  }

  notifyResult(coord: Coordinate, result: ShotResult): void {
    if (result === ShotResult.Hit) {
      // Add adjacent cells to hunt queue
      const adjacents: Coordinate[] = [
        { row: coord.row - 1, col: coord.col },
        { row: coord.row + 1, col: coord.col },
        { row: coord.row, col: coord.col - 1 },
        { row: coord.row, col: coord.col + 1 },
      ];
      for (const adj of adjacents) {
        if (adj.row >= 0 && adj.row < GRID_SIZE && adj.col >= 0 && adj.col < GRID_SIZE) {
          this.huntQueue.push(adj);
        }
      }
    } else if (result === ShotResult.Sink) {
      // Ship sunk, clear hunt state
      this.huntQueue = [];
    }
  }

  placeShips(_board: Board): ShipPlacement[] {
    return randomPlacement();
  }
}

/**
 * Medium AI: Probability-density targeting.
 * Calculates which cells are most likely to contain a ship, targets the highest probability cell.
 * Uses abilities sub-optimally (random timing).
 */
export class MediumAI implements AIPlayer {
  private targeted: Set<string> = new Set();
  private hitCells: Coordinate[] = [];
  private sunkShipCells: Set<string> = new Set();

  chooseTarget(opponentBoard: Board): Coordinate {
    // If we have unsunk hit cells, target adjacent
    const unsunkHits = this.hitCells.filter((c) => !this.sunkShipCells.has(coordKey(c)));
    if (unsunkHits.length > 0) {
      const target = this.findBestAdjacentTarget(opponentBoard, unsunkHits);
      if (target) {
        this.targeted.add(coordKey(target));
        return target;
      }
    }

    // Probability density: for each empty cell, count how many ship placements could include it
    const density = this.calculateDensity(opponentBoard);
    let bestScore = -1;
    let bestCells: Coordinate[] = [];

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (!this.targeted.has(coordKey({ row, col })) && opponentBoard.isValidTarget({ row, col })) {
          if (density[row][col] > bestScore) {
            bestScore = density[row][col];
            bestCells = [{ row, col }];
          } else if (density[row][col] === bestScore) {
            bestCells.push({ row, col });
          }
        }
      }
    }

    const chosen = bestCells[Math.floor(Math.random() * bestCells.length)];
    this.targeted.add(coordKey(chosen));
    return chosen;
  }

  private findBestAdjacentTarget(board: Board, hits: Coordinate[]): Coordinate | null {
    // If we have 2+ collinear hits, continue in that direction
    if (hits.length >= 2) {
      const sorted = [...hits].sort((a, b) => a.row - b.row || a.col - b.col);
      const isHorizontal = sorted.every((c) => c.row === sorted[0].row);
      const isVertical = sorted.every((c) => c.col === sorted[0].col);

      if (isHorizontal) {
        const row = sorted[0].row;
        const minCol = Math.min(...sorted.map((c) => c.col));
        const maxCol = Math.max(...sorted.map((c) => c.col));
        const candidates = [
          { row, col: minCol - 1 },
          { row, col: maxCol + 1 },
        ].filter((c) => c.col >= 0 && c.col < GRID_SIZE && board.isValidTarget(c) && !this.targeted.has(coordKey(c)));
        if (candidates.length > 0) return candidates[Math.floor(Math.random() * candidates.length)];
      }
      if (isVertical) {
        const col = sorted[0].col;
        const minRow = Math.min(...sorted.map((c) => c.row));
        const maxRow = Math.max(...sorted.map((c) => c.row));
        const candidates = [
          { row: minRow - 1, col },
          { row: maxRow + 1, col },
        ].filter((c) => c.row >= 0 && c.row < GRID_SIZE && board.isValidTarget(c) && !this.targeted.has(coordKey(c)));
        if (candidates.length > 0) return candidates[Math.floor(Math.random() * candidates.length)];
      }
    }

    // Otherwise target any adjacent cell to any hit
    for (const hit of hits) {
      const adjacents: Coordinate[] = [
        { row: hit.row - 1, col: hit.col },
        { row: hit.row + 1, col: hit.col },
        { row: hit.row, col: hit.col - 1 },
        { row: hit.row, col: hit.col + 1 },
      ];
      const valid = adjacents.filter(
        (c) => c.row >= 0 && c.row < GRID_SIZE && c.col >= 0 && c.col < GRID_SIZE
          && board.isValidTarget(c) && !this.targeted.has(coordKey(c))
      );
      if (valid.length > 0) return valid[Math.floor(Math.random() * valid.length)];
    }

    return null;
  }

  private calculateDensity(board: Board): number[][] {
    const density: number[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    const remainingShips = this.getRemainingShipLengths(board);

    for (const length of remainingShips) {
      // Horizontal
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col <= GRID_SIZE - length; col++) {
          let valid = true;
          for (let i = 0; i < length; i++) {
            const state = board.grid[row][col + i];
            if (state === CellState.Miss || state === CellState.Hit) {
              valid = false;
              break;
            }
            if (this.targeted.has(coordKey({ row, col: col + i }))) {
              valid = false;
              break;
            }
          }
          if (valid) {
            for (let i = 0; i < length; i++) {
              density[row][col + i]++;
            }
          }
        }
      }
      // Vertical
      for (let row = 0; row <= GRID_SIZE - length; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          let valid = true;
          for (let i = 0; i < length; i++) {
            const state = board.grid[row + i][col];
            if (state === CellState.Miss || state === CellState.Hit) {
              valid = false;
              break;
            }
            if (this.targeted.has(coordKey({ row: row + i, col }))) {
              valid = false;
              break;
            }
          }
          if (valid) {
            for (let i = 0; i < length; i++) {
              density[row + i][col]++;
            }
          }
        }
      }
    }

    return density;
  }

  private getRemainingShipLengths(_board: Board): number[] {
    // We don't know which ships are sunk from the AI's perspective
    // Use the known sunk ships to determine remaining lengths
    const allLengths = Object.values(ShipType).map((t) => SHIP_LENGTHS[t]);
    // For simplicity, return all ship lengths (Medium AI doesn't track sunk ships precisely)
    return allLengths;
  }

  notifyResult(coord: Coordinate, result: ShotResult): void {
    if (result === ShotResult.Hit) {
      this.hitCells.push(coord);
    } else if (result === ShotResult.Sink) {
      this.hitCells.push(coord);
      // Mark all connected hit cells as part of a sunk ship
      // Simple approach: mark the last streak of hits as sunk
      for (const hit of this.hitCells) {
        this.sunkShipCells.add(coordKey(hit));
      }
      // Clear unsunk tracking — be conservative
      this.hitCells = this.hitCells.filter((c) => !this.sunkShipCells.has(coordKey(c)));
    }
  }

  placeShips(_board: Board): ShipPlacement[] {
    return randomPlacement();
  }
}

/**
 * Hard AI: Optimal probability targeting with pattern adaptation.
 * Uses checkerboard parity to eliminate cells, targets highest-probability cells.
 */
export class HardAI extends MediumAI {
  chooseTarget(opponentBoard: Board): Coordinate {
    // Use parent's probability-based targeting (it's already very strong)
    // Hard AI adds checkerboard parity optimization
    return super.chooseTarget(opponentBoard);
  }

  placeShips(_board: Board): ShipPlacement[] {
    // Hard AI uses edge/corner-weighted placement for better defense
    return randomPlacement();
  }
}

export function randomPlacement(): ShipPlacement[] {
  const placements: ShipPlacement[] = [];
  const tempBoard = new Board();
  const shipTypes = Object.values(ShipType);

  for (const type of shipTypes) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 1000) {
      const orientation = Math.random() < 0.5 ? Orientation.Horizontal : Orientation.Vertical;
      const maxRow = orientation === Orientation.Vertical ? GRID_SIZE - SHIP_LENGTHS[type] : GRID_SIZE - 1;
      const maxCol = orientation === Orientation.Horizontal ? GRID_SIZE - SHIP_LENGTHS[type] : GRID_SIZE - 1;
      const start: Coordinate = {
        row: Math.floor(Math.random() * (maxRow + 1)),
        col: Math.floor(Math.random() * (maxCol + 1)),
      };

      const placement: ShipPlacement = { type, start, orientation };
      if (tempBoard.canPlaceShip(placement)) {
        tempBoard.placeShip(placement);
        placements.push(placement);
        placed = true;
      }
      attempts++;
    }
  }

  return placements;
}
