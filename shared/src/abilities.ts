import { Board } from './Board';
import {
  type Coordinate,
  type ShotOutcome,
  type Ship,
  ShipType,
  CellState,
  ShotResult,
  coordKey,
  GRID_SIZE,
} from './types';

export enum AbilityType {
  CannonBarrage = 'cannon_barrage',
  SonarPing = 'sonar_ping',
  SmokeScreen = 'smoke_screen',
  RepairKit = 'repair_kit',
  ChainShot = 'chain_shot',
  Spyglass = 'spyglass',
  BoardingParty = 'boarding_party',
  SummonKraken = 'summon_kraken',
}

export interface AbilityDef {
  type: AbilityType;
  name: string;
  description: string;
  cooldown: number; // turns between uses (0 = single use)
  maxUses: number;  // 0 = unlimited (limited by cooldown), >0 = limited uses
}

export const ABILITY_DEFS: Record<AbilityType, AbilityDef> = {
  [AbilityType.CannonBarrage]: {
    type: AbilityType.CannonBarrage,
    name: 'Cannon Barrage',
    description: 'Fire on a 2x2 area',
    cooldown: 3,
    maxUses: 0,
  },
  [AbilityType.SonarPing]: {
    type: AbilityType.SonarPing,
    name: 'Sonar Ping',
    description: 'Detect ships in a 3x3 area',
    cooldown: 4,
    maxUses: 0,
  },
  [AbilityType.SmokeScreen]: {
    type: AbilityType.SmokeScreen,
    name: 'Smoke Screen',
    description: 'Hide a 3x3 area for 2 turns',
    cooldown: 5,
    maxUses: 0,
  },
  [AbilityType.RepairKit]: {
    type: AbilityType.RepairKit,
    name: 'Repair Kit',
    description: 'Restore one hit cell on your ship',
    cooldown: 0,
    maxUses: 1,
  },
  [AbilityType.ChainShot]: {
    type: AbilityType.ChainShot,
    name: 'Chain Shot',
    description: 'Fire on a 1x3 horizontal line',
    cooldown: 3,
    maxUses: 0,
  },
  [AbilityType.Spyglass]: {
    type: AbilityType.Spyglass,
    name: 'Spyglass',
    description: 'Fire one shot + reveal ship count in that row',
    cooldown: 5,
    maxUses: 0,
  },
  [AbilityType.BoardingParty]: {
    type: AbilityType.BoardingParty,
    name: 'Boarding Party',
    description: 'Passive: next hit reveals ship type and HP',
    cooldown: 0,
    maxUses: 1,
  },
  [AbilityType.SummonKraken]: {
    type: AbilityType.SummonKraken,
    name: 'Summon Kraken',
    description: 'Ritual: forfeit 2 turns, then sink a random enemy ship (not the Cruiser)',
    cooldown: 0,
    maxUses: 1,
  },
};

export interface AbilityState {
  type: AbilityType;
  cooldownRemaining: number;
  usesRemaining: number; // -1 = unlimited
}

export interface SmokeZone {
  cells: Set<string>; // "row,col" keys
  turnsRemaining: number;
}

export interface AbilitySystemState {
  selectedAbilities: AbilityType[]; // 2 abilities chosen pre-match
  abilityStates: AbilityState[];
  smokeZones: SmokeZone[];         // active smoke screens on this player's board
}

export function createAbilitySystemState(selected: AbilityType[]): AbilitySystemState {
  return {
    selectedAbilities: selected,
    abilityStates: selected.map((type) => ({
      type,
      cooldownRemaining: 0,
      usesRemaining: ABILITY_DEFS[type].maxUses === 0 ? -1 : ABILITY_DEFS[type].maxUses,
    })),
    smokeZones: [],
  };
}

export function canUseAbility(state: AbilitySystemState, type: AbilityType): boolean {
  const ability = state.abilityStates.find((a) => a.type === type);
  if (!ability) return false;
  if (ability.cooldownRemaining > 0) return false;
  if (ability.usesRemaining === 0) return false;
  return true;
}

/**
 * Tick cooldowns at the start of a player's turn.
 */
export function tickCooldowns(state: AbilitySystemState): void {
  for (const ability of state.abilityStates) {
    if (ability.cooldownRemaining > 0) {
      ability.cooldownRemaining--;
    }
  }
  // Tick smoke zones
  state.smokeZones = state.smokeZones
    .map((z) => ({ ...z, turnsRemaining: z.turnsRemaining - 1 }))
    .filter((z) => z.turnsRemaining > 0);
}

/**
 * Activate an ability. Consumes a use and starts cooldown.
 */
function consumeAbility(state: AbilitySystemState, type: AbilityType): void {
  const ability = state.abilityStates.find((a) => a.type === type)!;
  if (ability.usesRemaining > 0) {
    ability.usesRemaining--;
  }
  ability.cooldownRemaining = ABILITY_DEFS[type].cooldown;
}

export interface CannonBarrageResult {
  outcomes: ShotOutcome[];
}

/**
 * Cannon Barrage: Fire on a 2x2 area starting at the given coordinate.
 */
export function executeCannonBarrage(
  targetBoard: Board,
  topLeft: Coordinate,
  abilityState: AbilitySystemState
): CannonBarrageResult | null {
  if (!canUseAbility(abilityState, AbilityType.CannonBarrage)) return null;

  const outcomes: ShotOutcome[] = [];
  for (let dr = 0; dr < 2; dr++) {
    for (let dc = 0; dc < 2; dc++) {
      const coord = { row: topLeft.row + dr, col: topLeft.col + dc };
      if (coord.row >= GRID_SIZE || coord.col >= GRID_SIZE) continue;
      if (!targetBoard.isValidTarget(coord)) continue;

      const outcome = targetBoard.receiveShot(coord);
      outcomes.push(outcome);
    }
  }

  consumeAbility(abilityState, AbilityType.CannonBarrage);
  return { outcomes };
}

export interface SonarPingResult {
  area: Coordinate[];
  /** True if any non-Submarine ship cell is in the area, OR a Submarine is in
   *  the area (coarse detection still works for subs). */
  shipDetected: boolean;
  /** Precise coordinates of non-Submarine ship cells detected in the area.
   *  Submarine cells are EXCLUDED from this list due to Silent Running. */
  revealedShipCells: Coordinate[];
}

/**
 * Sonar Ping: Scan a 3×3 area.
 * - For non-Submarine ships: returns precise coordinates in `revealedShipCells`.
 * - For a Submarine: contributes to `shipDetected=true` (coarse) but NOT to
 *   `revealedShipCells` (Silent Running). The attacker can tell there's
 *   something there but not exactly where.
 */
export function executeSonarPing(
  targetBoard: Board,
  center: Coordinate,
  abilityState: AbilitySystemState
): SonarPingResult | null {
  if (!canUseAbility(abilityState, AbilityType.SonarPing)) return null;

  const area: Coordinate[] = [];
  const revealedShipCells: Coordinate[] = [];
  let shipDetected = false;

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const coord = { row: center.row + dr, col: center.col + dc };
      if (coord.row < 0 || coord.row >= GRID_SIZE || coord.col < 0 || coord.col >= GRID_SIZE) continue;
      area.push(coord);

      const cell = targetBoard.grid[coord.row][coord.col];
      if (cell === CellState.Ship) {
        shipDetected = true;
        // Silent Running: Submarine cells contribute to coarse detection only.
        const ship = targetBoard.getShipAt(coord);
        if (ship && ship.type !== ShipType.Submarine) {
          revealedShipCells.push(coord);
        }
      }
    }
  }

  consumeAbility(abilityState, AbilityType.SonarPing);
  return { area, shipDetected, revealedShipCells };
}

/**
 * Smoke Screen: Hide a 3x3 area of your own board for 2 turns.
 */
export function executeSmokeScreen(
  center: Coordinate,
  abilityState: AbilitySystemState
): boolean {
  if (!canUseAbility(abilityState, AbilityType.SmokeScreen)) return false;

  const cells = new Set<string>();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const coord = { row: center.row + dr, col: center.col + dc };
      if (coord.row >= 0 && coord.row < GRID_SIZE && coord.col >= 0 && coord.col < GRID_SIZE) {
        cells.add(coordKey(coord));
      }
    }
  }

  abilityState.smokeZones.push({ cells, turnsRemaining: 2 });
  consumeAbility(abilityState, AbilityType.SmokeScreen);
  return true;
}

/**
 * Check if a cell is hidden by smoke.
 */
export function isCellSmoked(coord: Coordinate, smokeZones: SmokeZone[]): boolean {
  const key = coordKey(coord);
  return smokeZones.some((z) => z.cells.has(key));
}

export interface RepairResult {
  repairedCell: Coordinate;
}

/**
 * Repair Kit: Restore one hit cell on one of your own ships.
 * Picks the first hit (non-sunk) ship cell found.
 */
export function executeRepairKit(
  ownBoard: Board,
  targetCoord: Coordinate,
  abilityState: AbilitySystemState
): RepairResult | null {
  if (!canUseAbility(abilityState, AbilityType.RepairKit)) return null;

  const key = coordKey(targetCoord);
  const ship = ownBoard.getShipAt(targetCoord);

  if (!ship) return null;
  if (!ship.hits.has(key)) return null;
  // Can't repair a fully sunk ship
  if (ship.hits.size === ship.cells.length) return null;

  // Repair: remove from hits, restore grid cell
  ship.hits.delete(key);
  ownBoard.grid[targetCoord.row][targetCoord.col] = CellState.Ship;

  consumeAbility(abilityState, AbilityType.RepairKit);
  return { repairedCell: targetCoord };
}

export interface ChainShotResult {
  outcomes: ShotOutcome[];
}

/**
 * Chain Shot: Fire on a 1x3 horizontal line starting at the leftmost cell.
 */
export function executeChainShot(
  targetBoard: Board,
  start: Coordinate,
  abilityState: AbilitySystemState
): ChainShotResult | null {
  if (!canUseAbility(abilityState, AbilityType.ChainShot)) return null;

  const outcomes: ShotOutcome[] = [];
  for (let dc = 0; dc < 3; dc++) {
    const coord = { row: start.row, col: start.col + dc };
    if (coord.col >= GRID_SIZE) continue;
    if (!targetBoard.isValidTarget(coord)) continue;
    outcomes.push(targetBoard.receiveShot(coord));
  }

  if (outcomes.length === 0) return null;
  consumeAbility(abilityState, AbilityType.ChainShot);
  return { outcomes };
}

export interface SpyglassResult {
  shotOutcome: ShotOutcome;
  rowShipCount: number; // unrevealed ship cells remaining in the row
}

/**
 * Spyglass: Fire one shot AND reveal how many ship cells remain in that row.
 */
export function executeSpyglass(
  targetBoard: Board,
  coord: Coordinate,
  abilityState: AbilitySystemState
): SpyglassResult | null {
  if (!canUseAbility(abilityState, AbilityType.Spyglass)) return null;
  if (!targetBoard.isValidTarget(coord)) return null;

  const shotOutcome = targetBoard.receiveShot(coord);

  let rowShipCount = 0;
  for (let c = 0; c < GRID_SIZE; c++) {
    if (targetBoard.grid[coord.row][c] === CellState.Ship) rowShipCount++;
  }

  consumeAbility(abilityState, AbilityType.Spyglass);
  return { shotOutcome, rowShipCount };
}

export interface BoardingPartyResult {
  shipType: string;
  hitsTaken: number;
  totalCells: number;
}

/**
 * Boarding Party (passive): triggers on the next hit after activation.
 * Returns ship intel if there's a ship at coord; the caller arms the ability.
 * For simplicity, this acts as a one-time scout that doesn't fire a shot —
 * it inspects the cell. If there's a ship, returns its info. The cell is
 * NOT marked as hit (it's a stealth boarding).
 */
export function executeBoardingParty(
  targetBoard: Board,
  coord: Coordinate,
  abilityState: AbilitySystemState
): BoardingPartyResult | null {
  if (!canUseAbility(abilityState, AbilityType.BoardingParty)) return null;
  const ship = targetBoard.getShipAt(coord);
  if (!ship) {
    // No ship there — still consume the ability (intel gathering attempt)
    consumeAbility(abilityState, AbilityType.BoardingParty);
    return null;
  }
  consumeAbility(abilityState, AbilityType.BoardingParty);
  return {
    shipType: ship.type,
    hitsTaken: ship.hits.size,
    totalCells: ship.cells.length,
  };
}

/**
 * Fix stale Sink outcomes after trait processing.
 * Traits can revert hits, making a Sink outcome invalid. This function:
 * 1. Downgrades stale Sink outcomes (ship no longer fully hit)
 * 2. Upgrades missed sinks (ship now fully hit but no Sink outcome)
 */
export function fixStaleOutcomes(outcomes: ShotOutcome[], board: Board): void {
  // Downgrade stale Sinks
  for (const outcome of outcomes) {
    if (outcome.result === ShotResult.Sink && outcome.sunkShip) {
      const ship = board.ships.find(s => s.type === outcome.sunkShip);
      if (ship && ship.hits.size < ship.cells.length) {
        outcome.result = ShotResult.Hit;
        outcome.sunkShip = undefined;
      }
    }
  }
  // Upgrade missed sinks (ship fully hit but no Sink recorded)
  for (const ship of board.ships) {
    if (ship.hits.size === ship.cells.length) {
      const hasSink = outcomes.some(o => o.sunkShip === ship.type);
      if (!hasSink) {
        const lastHit = [...outcomes].reverse().find(o => {
          const key = coordKey(o.coordinate);
          return ship.cells.some(c => coordKey(c) === key) && o.result === ShotResult.Hit;
        });
        if (lastHit) {
          lastHit.result = ShotResult.Sink;
          lastHit.sunkShip = ship.type;
        }
      }
    }
  }
}

/**
 * Summon Kraken — ritual state.
 * The caster sets `turnsRemaining = 2` via executeSummonKraken, then loses
 * their next 2 own-turns without firing. On the 3rd own-turn the ritual
 * resolves via resolveKrakenStrike.
 */
export interface KrakenRitualState {
  turnsRemaining: number;
}

/**
 * Start the Kraken summoning ritual. Consumes the ability. Returns the
 * initial ritual state (or null if the ability can't be used).
 */
export function executeSummonKraken(
  abilityState: AbilitySystemState
): KrakenRitualState | null {
  if (!canUseAbility(abilityState, AbilityType.SummonKraken)) return null;
  consumeAbility(abilityState, AbilityType.SummonKraken);
  return { turnsRemaining: 2 };
}

export interface KrakenStrikeResult {
  sunkShip: Ship;
  cells: Coordinate[];
}

/**
 * Resolve the Kraken strike. Picks one random unsunk ship on the target board
 * that is NOT warded (e.g. Cruiser with Kraken Ward), marks every cell as Hit,
 * and returns the sunk ship.
 *
 * Returns null when EVERY unsunk ship is warded — the ritual is wasted. In
 * the current design this happens when only the Cruiser is left on the board.
 */
export function resolveKrakenStrike(
  targetBoard: Board,
  wardShipTypes: Set<ShipType> = new Set()
): KrakenStrikeResult | null {
  const unsunk = targetBoard.ships.filter(s => s.hits.size < s.cells.length);
  if (unsunk.length === 0) return null;

  const candidates = unsunk.filter(s => !wardShipTypes.has(s.type));
  if (candidates.length === 0) return null; // every unsunk ship is warded

  const target = candidates[Math.floor(Math.random() * candidates.length)];
  const cells: Coordinate[] = [];
  for (const cell of target.cells) {
    target.hits.add(coordKey(cell));
    targetBoard.grid[cell.row][cell.col] = CellState.Hit;
    cells.push(cell);
  }
  return { sunkShip: target, cells };
}
