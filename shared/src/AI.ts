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
import { AbilityType } from './abilities';

/** What the AI decided to do this turn. */
export interface AIAbilityChoice {
  type: AbilityType;
  coord: Coordinate;
}

export interface AIPlayer {
  chooseTarget(opponentBoard: Board): Coordinate;
  placeShips(board: Board): ShipPlacement[];
  notifyResult(coord: Coordinate, result: ShotResult): void;
  /**
   * Optional: decide whether to use an ability this turn instead of firing a
   * normal shot. Returns `null` to fall through to `chooseTarget`.
   *
   * `available` is the filtered list of abilities that are off-cooldown AND
   * have uses remaining. Caller must honour the returned choice (execute the
   * ability, don't fire).
   */
  pickAbility?(
    ownBoard: Board,
    opponentBoard: Board,
    available: AbilityType[]
  ): AIAbilityChoice | null;
}

// ─── Shared hunt-mode logic (used by every difficulty) ───────────────────────

/**
 * Pick the best cell to follow up on known hits. Collinearity-aware: if the
 * AI has 2+ hits in a line, it extends along that line before falling back to
 * orthogonal neighbours. This is the "finish-off-a-ship" logic that every
 * difficulty needs for consistent play.
 */
function findBestHuntTarget(
  board: Board,
  hits: Coordinate[],
  targeted: Set<string>
): Coordinate | null {
  if (hits.length === 0) return null;

  // If we have 2+ collinear hits, continue along the axis
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
      ].filter(
        (c) =>
          c.col >= 0 &&
          c.col < GRID_SIZE &&
          board.isValidTarget(c) &&
          !targeted.has(coordKey(c))
      );
      if (candidates.length > 0) return candidates[Math.floor(Math.random() * candidates.length)];
    }
    if (isVertical) {
      const col = sorted[0].col;
      const minRow = Math.min(...sorted.map((c) => c.row));
      const maxRow = Math.max(...sorted.map((c) => c.row));
      const candidates = [
        { row: minRow - 1, col },
        { row: maxRow + 1, col },
      ].filter(
        (c) =>
          c.row >= 0 &&
          c.row < GRID_SIZE &&
          board.isValidTarget(c) &&
          !targeted.has(coordKey(c))
      );
      if (candidates.length > 0) return candidates[Math.floor(Math.random() * candidates.length)];
    }
  }

  // Otherwise target any valid adjacent cell to any hit
  for (const hit of hits) {
    const adjacents: Coordinate[] = [
      { row: hit.row - 1, col: hit.col },
      { row: hit.row + 1, col: hit.col },
      { row: hit.row, col: hit.col - 1 },
      { row: hit.row, col: hit.col + 1 },
    ];
    const valid = adjacents.filter(
      (c) =>
        c.row >= 0 &&
        c.row < GRID_SIZE &&
        c.col >= 0 &&
        c.col < GRID_SIZE &&
        board.isValidTarget(c) &&
        !targeted.has(coordKey(c))
    );
    if (valid.length > 0) return valid[Math.floor(Math.random() * valid.length)];
  }

  return null;
}

/** Pick a random valid cell on a board. Returns null only if board is fully targeted. */
function pickRandomValidCell(board: Board, targeted: Set<string>): Coordinate | null {
  const available: Coordinate[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const coord = { row, col };
      if (!targeted.has(coordKey(coord)) && board.isValidTarget(coord)) {
        available.push(coord);
      }
    }
  }
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

/** Pick a random valid parity cell (checkerboard — half the cells). Falls back to any valid. */
function pickRandomParityCell(board: Board, targeted: Set<string>): Coordinate | null {
  const parityCells: Coordinate[] = [];
  const anyValid: Coordinate[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const coord = { row, col };
      if (targeted.has(coordKey(coord)) || !board.isValidTarget(coord)) continue;
      anyValid.push(coord);
      // Parity: only cells where (row+col) is even. The min ship length is 2,
      // so a ship must cross at least one parity-even cell.
      if ((row + col) % 2 === 0) parityCells.push(coord);
    }
  }
  const pool = parityCells.length > 0 ? parityCells : anyValid;
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Probability density (shared by Medium's targeting + Hard's ability picks) ──

function calculateDensity(board: Board, targeted: Set<string>): number[][] {
  const density: number[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  const allLengths = Object.values(ShipType).map((t) => SHIP_LENGTHS[t]);

  for (const length of allLengths) {
    // Horizontal
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col <= GRID_SIZE - length; col++) {
        let valid = true;
        for (let i = 0; i < length; i++) {
          const state = board.grid[row][col + i];
          if (
            state === CellState.Miss ||
            state === CellState.Hit ||
            state === CellState.LandRevealed
          ) {
            valid = false;
            break;
          }
          if (targeted.has(coordKey({ row, col: col + i }))) {
            valid = false;
            break;
          }
        }
        if (valid) {
          for (let i = 0; i < length; i++) density[row][col + i]++;
        }
      }
    }
    // Vertical
    for (let row = 0; row <= GRID_SIZE - length; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        let valid = true;
        for (let i = 0; i < length; i++) {
          const state = board.grid[row + i][col];
          if (
            state === CellState.Miss ||
            state === CellState.Hit ||
            state === CellState.LandRevealed
          ) {
            valid = false;
            break;
          }
          if (targeted.has(coordKey({ row: row + i, col }))) {
            valid = false;
            break;
          }
        }
        if (valid) {
          for (let i = 0; i < length; i++) density[row + i][col]++;
        }
      }
    }
  }

  return density;
}

function argmaxCell(density: number[][], filter: (c: Coordinate) => boolean): Coordinate | null {
  let best = -1;
  let bestCells: Coordinate[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const coord = { row, col };
      if (!filter(coord)) continue;
      const d = density[row][col];
      if (d > best) {
        best = d;
        bestCells = [coord];
      } else if (d === best) {
        bestCells.push(coord);
      }
    }
  }
  if (bestCells.length === 0) return null;
  return bestCells[Math.floor(Math.random() * bestCells.length)];
}

// ─── Ability picker helpers ──────────────────────────────────────────────────

/** Count unsunk hit cells on one of the player's (opponent-from-AI's-POV) ships. */
function damagedOwnShipCell(ownBoard: Board): Coordinate | null {
  for (const ship of ownBoard.ships) {
    const isSunk = ship.hits.size === ship.cells.length;
    if (isSunk) continue;
    const hitCell = ship.cells.find((c) => ship.hits.has(coordKey(c)));
    if (hitCell) return hitCell;
  }
  return null;
}

/** Basic targeter for Medium: random valid cell, anchored so 2×2 / 1×3 fits on board. */
function basicAbilityTarget(
  ability: AbilityType,
  ownBoard: Board,
  opponentBoard: Board,
  oppTargeted: Set<string>
): Coordinate | null {
  switch (ability) {
    case AbilityType.CannonBarrage: {
      // Anchor at top-left of a 2×2 area; ensure all cells are valid to target.
      const candidates: Coordinate[] = [];
      for (let row = 0; row < GRID_SIZE - 1; row++) {
        for (let col = 0; col < GRID_SIZE - 1; col++) {
          const anchor = { row, col };
          const cells = [anchor, { row, col: col + 1 }, { row: row + 1, col }, { row: row + 1, col: col + 1 }];
          if (cells.some((c) => !opponentBoard.isValidTarget(c))) continue;
          candidates.push(anchor);
        }
      }
      return candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : null;
    }
    case AbilityType.ChainShot: {
      const candidates: Coordinate[] = [];
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col <= GRID_SIZE - 3; col++) {
          const cells = [
            { row, col },
            { row, col: col + 1 },
            { row, col: col + 2 },
          ];
          if (cells.some((c) => !opponentBoard.isValidTarget(c))) continue;
          candidates.push({ row, col });
        }
      }
      return candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : null;
    }
    case AbilityType.SonarPing:
    case AbilityType.BoardingParty:
    case AbilityType.Spyglass:
      return pickRandomValidCell(opponentBoard, oppTargeted);
    case AbilityType.SmokeScreen: {
      // Smoke is placed on AI's OWN board; pick any cell
      const candidates: Coordinate[] = [];
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          candidates.push({ row, col });
        }
      }
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    case AbilityType.RepairKit: {
      return damagedOwnShipCell(ownBoard);
    }
    case AbilityType.SummonKraken:
      // Coord irrelevant — the ritual targets a random non-warded ship on resolution.
      return { row: 0, col: 0 };
  }
  return null;
}

/** Smart targeter for Hard: aim abilities where they actually pay off. */
function smartAbilityTarget(
  ability: AbilityType,
  ownBoard: Board,
  opponentBoard: Board,
  oppTargeted: Set<string>,
  unsunkHits: Coordinate[]
): Coordinate | null {
  const density = calculateDensity(opponentBoard, oppTargeted);

  switch (ability) {
    case AbilityType.CannonBarrage: {
      // If we have hits, anchor the 2×2 so it overlaps a hit and 3 fresh cells.
      if (unsunkHits.length > 0) {
        for (const hit of unsunkHits) {
          const anchorCandidates: Coordinate[] = [
            { row: hit.row - 1, col: hit.col - 1 },
            { row: hit.row - 1, col: hit.col },
            { row: hit.row, col: hit.col - 1 },
            { row: hit.row, col: hit.col },
          ];
          for (const a of anchorCandidates) {
            if (a.row < 0 || a.col < 0 || a.row >= GRID_SIZE - 1 || a.col >= GRID_SIZE - 1) continue;
            const cells = [a, { row: a.row, col: a.col + 1 }, { row: a.row + 1, col: a.col }, { row: a.row + 1, col: a.col + 1 }];
            if (cells.some((c) => !opponentBoard.isValidTarget(c))) continue;
            return a;
          }
        }
      }
      // Otherwise pick the 2×2 with highest density sum
      let best = -1;
      let bestAnchor: Coordinate | null = null;
      for (let row = 0; row < GRID_SIZE - 1; row++) {
        for (let col = 0; col < GRID_SIZE - 1; col++) {
          const anchor = { row, col };
          const cells = [anchor, { row, col: col + 1 }, { row: row + 1, col }, { row: row + 1, col: col + 1 }];
          if (cells.some((c) => !opponentBoard.isValidTarget(c))) continue;
          const score = cells.reduce((s, c) => s + density[c.row][c.col], 0);
          if (score > best) {
            best = score;
            bestAnchor = anchor;
          }
        }
      }
      return bestAnchor;
    }
    case AbilityType.ChainShot: {
      // Align with a hit row if possible
      if (unsunkHits.length > 0) {
        for (const hit of unsunkHits) {
          // Find a valid 1×3 that includes the hit row
          for (let startCol = Math.max(0, hit.col - 2); startCol <= Math.min(GRID_SIZE - 3, hit.col); startCol++) {
            const cells = [
              { row: hit.row, col: startCol },
              { row: hit.row, col: startCol + 1 },
              { row: hit.row, col: startCol + 2 },
            ];
            if (cells.some((c) => !opponentBoard.isValidTarget(c))) continue;
            return { row: hit.row, col: startCol };
          }
        }
      }
      // Otherwise densest 1×3
      let best = -1;
      let bestAnchor: Coordinate | null = null;
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col <= GRID_SIZE - 3; col++) {
          const cells = [
            { row, col },
            { row, col: col + 1 },
            { row, col: col + 2 },
          ];
          if (cells.some((c) => !opponentBoard.isValidTarget(c))) continue;
          const score = cells.reduce((s, c) => s + density[c.row][c.col], 0);
          if (score > best) {
            best = score;
            bestAnchor = { row, col };
          }
        }
      }
      return bestAnchor;
    }
    case AbilityType.SonarPing: {
      // Scan the densest 3×3 we haven't pinged before (approximation: any 3×3 with highest sum)
      let best = -1;
      let bestCenter: Coordinate | null = null;
      for (let row = 1; row < GRID_SIZE - 1; row++) {
        for (let col = 1; col < GRID_SIZE - 1; col++) {
          let score = 0;
          let validCells = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const c = { row: row + dr, col: col + dc };
              if (!opponentBoard.isValidTarget(c)) continue;
              score += density[c.row][c.col];
              validCells++;
            }
          }
          if (validCells < 4) continue; // area mostly already targeted
          if (score > best) {
            best = score;
            bestCenter = { row, col };
          }
        }
      }
      return bestCenter;
    }
    case AbilityType.Spyglass:
    case AbilityType.BoardingParty:
      // Hit the highest-density cell
      return argmaxCell(density, (c) => opponentBoard.isValidTarget(c) && !oppTargeted.has(coordKey(c)));
    case AbilityType.SmokeScreen: {
      // Cover an area containing an undamaged valuable ship (Carrier/Battleship cells)
      for (const ship of ownBoard.ships) {
        if (ship.type !== ShipType.Carrier && ship.type !== ShipType.Battleship) continue;
        if (ship.hits.size === ship.cells.length) continue;
        const cell = ship.cells[Math.floor(ship.cells.length / 2)];
        return cell;
      }
      return { row: Math.floor(GRID_SIZE / 2), col: Math.floor(GRID_SIZE / 2) };
    }
    case AbilityType.RepairKit:
      return damagedOwnShipCell(ownBoard);
    case AbilityType.SummonKraken:
      return { row: 0, col: 0 };
  }
  return null;
}

// ─── EasyAI: random search, no abilities ─────────────────────────────────────

/**
 * Easy AI — random search with simple hunt-follow-up.
 * - Search phase: random valid cell.
 * - Hunt phase: shared `findBestHuntTarget` so a found ship is actually finished.
 * - Abilities: NONE. Easy AI ignores its ability loadout entirely.
 */
export class EasyAI implements AIPlayer {
  protected targeted: Set<string> = new Set();
  protected hitCells: Coordinate[] = [];
  protected sunkShipCells: Set<string> = new Set();

  chooseTarget(opponentBoard: Board): Coordinate {
    const unsunkHits = this.hitCells.filter((c) => !this.sunkShipCells.has(coordKey(c)));
    if (unsunkHits.length > 0) {
      const target = findBestHuntTarget(opponentBoard, unsunkHits, this.targeted);
      if (target) {
        this.targeted.add(coordKey(target));
        return target;
      }
    }
    const chosen = pickRandomValidCell(opponentBoard, this.targeted) ?? { row: 0, col: 0 };
    this.targeted.add(coordKey(chosen));
    return chosen;
  }

  notifyResult(coord: Coordinate, result: ShotResult): void {
    if (result === ShotResult.Hit) {
      this.hitCells.push(coord);
    } else if (result === ShotResult.Sink) {
      this.hitCells.push(coord);
      for (const hit of this.hitCells) this.sunkShipCells.add(coordKey(hit));
      this.hitCells = this.hitCells.filter((c) => !this.sunkShipCells.has(coordKey(c)));
    }
  }

  placeShips(board: Board): ShipPlacement[] {
    return randomPlacement(board);
  }

  // No pickAbility — Easy AI never uses abilities.

  /** Mark a coord as targeted without firing (used when AI fires an ability on that cell). */
  markTargeted(coord: Coordinate): void {
    this.targeted.add(coordKey(coord));
  }
}

// ─── MediumAI: parity search + basic ability usage ───────────────────────────

const MEDIUM_ABILITY_CHANCE = 0.25;

/**
 * Medium AI — parity search, shared hunt mode, uses abilities ~25% of turns
 * with basic (random-valid) targeting. Summon Kraken triggers as early as
 * possible because its ritual takes two turns.
 */
export class MediumAI extends EasyAI {
  chooseTarget(opponentBoard: Board): Coordinate {
    const unsunkHits = this.hitCells.filter((c) => !this.sunkShipCells.has(coordKey(c)));
    if (unsunkHits.length > 0) {
      const target = findBestHuntTarget(opponentBoard, unsunkHits, this.targeted);
      if (target) {
        this.targeted.add(coordKey(target));
        return target;
      }
    }
    const chosen =
      pickRandomParityCell(opponentBoard, this.targeted) ??
      pickRandomValidCell(opponentBoard, this.targeted) ?? { row: 0, col: 0 };
    this.targeted.add(coordKey(chosen));
    return chosen;
  }

  pickAbility(
    ownBoard: Board,
    opponentBoard: Board,
    available: AbilityType[]
  ): AIAbilityChoice | null {
    if (available.length === 0) return null;

    // Always use Summon Kraken ASAP when available — it's too strong to save.
    if (available.includes(AbilityType.SummonKraken)) {
      return { type: AbilityType.SummonKraken, coord: { row: 0, col: 0 } };
    }

    // Probabilistic usage
    if (Math.random() >= MEDIUM_ABILITY_CHANCE) return null;

    // Skip RepairKit unless we're actually damaged
    const usable = available.filter((a) => {
      if (a === AbilityType.RepairKit) return damagedOwnShipCell(ownBoard) !== null;
      return true;
    });
    if (usable.length === 0) return null;

    const pick = usable[Math.floor(Math.random() * usable.length)];
    const target = basicAbilityTarget(pick, ownBoard, opponentBoard, this.targeted);
    if (!target) return null;
    return { type: pick, coord: target };
  }
}

// ─── HardAI: probability-density search + smart ability usage ────────────────

const HARD_ABILITY_CHANCE = 0.6;

/**
 * Hard AI — probability-density search, shared hunt mode, uses abilities
 * ~60% of turns with smart targeting (Cannon/Chain on detected hits, Sonar
 * on densest unexplored area, Repair on damaged ships, etc.).
 */
export class HardAI extends EasyAI {
  chooseTarget(opponentBoard: Board): Coordinate {
    const unsunkHits = this.hitCells.filter((c) => !this.sunkShipCells.has(coordKey(c)));
    if (unsunkHits.length > 0) {
      const target = findBestHuntTarget(opponentBoard, unsunkHits, this.targeted);
      if (target) {
        this.targeted.add(coordKey(target));
        return target;
      }
    }

    const density = calculateDensity(opponentBoard, this.targeted);
    const chosen =
      argmaxCell(density, (c) => opponentBoard.isValidTarget(c) && !this.targeted.has(coordKey(c))) ??
      pickRandomValidCell(opponentBoard, this.targeted) ?? { row: 0, col: 0 };
    this.targeted.add(coordKey(chosen));
    return chosen;
  }

  pickAbility(
    ownBoard: Board,
    opponentBoard: Board,
    available: AbilityType[]
  ): AIAbilityChoice | null {
    if (available.length === 0) return null;

    if (available.includes(AbilityType.SummonKraken)) {
      return { type: AbilityType.SummonKraken, coord: { row: 0, col: 0 } };
    }

    if (Math.random() >= HARD_ABILITY_CHANCE) return null;

    const usable = available.filter((a) => {
      if (a === AbilityType.RepairKit) return damagedOwnShipCell(ownBoard) !== null;
      return true;
    });
    if (usable.length === 0) return null;

    const unsunkHits = this.hitCells.filter((c) => !this.sunkShipCells.has(coordKey(c)));

    // Prefer offensive abilities when we have hits to exploit; otherwise
    // preference recon (Sonar / Spyglass / BoardingParty). Fall back to any.
    const offensive = usable.filter((a) =>
      [AbilityType.CannonBarrage, AbilityType.ChainShot, AbilityType.Spyglass].includes(a)
    );
    const recon = usable.filter((a) =>
      [AbilityType.SonarPing, AbilityType.Spyglass, AbilityType.BoardingParty].includes(a)
    );
    const pool = unsunkHits.length > 0 && offensive.length > 0 ? offensive : (recon.length > 0 ? recon : usable);
    const pick = pool[Math.floor(Math.random() * pool.length)];

    const target = smartAbilityTarget(pick, ownBoard, opponentBoard, this.targeted, unsunkHits);
    if (!target) return null;
    return { type: pick, coord: target };
  }
}

/**
 * Generate random ship placements. If an existing board is provided,
 * placements will respect its current state (e.g. land cells).
 * Otherwise a blank temp board is used.
 */
export function randomPlacement(existingBoard?: Board): ShipPlacement[] {
  const placements: ShipPlacement[] = [];
  const tempBoard = existingBoard ? existingBoard.clone() : new Board();
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
