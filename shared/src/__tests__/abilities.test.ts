import { describe, it, expect } from 'vitest';
import { Board } from '../Board';
import {
  AbilityType,
  createAbilitySystemState,
  canUseAbility,
  tickCooldowns,
  executeCannonBarrage,
  executeSonarPing,
  executeSmokeScreen,
  executeRepairKit,
  executeChainShot,
  executeSpyglass,
  executeBoardingParty,
  isCellSmoked,
} from '../abilities';
import { ShipType, Orientation, CellState } from '../types';

describe('Abilities', () => {
  describe('ability system state', () => {
    it('creates state with selected abilities', () => {
      const state = createAbilitySystemState([AbilityType.CannonBarrage, AbilityType.SonarPing]);
      expect(state.selectedAbilities).toHaveLength(2);
      expect(state.abilityStates).toHaveLength(2);
      expect(canUseAbility(state, AbilityType.CannonBarrage)).toBe(true);
    });

    it('cannot use ability not in selection', () => {
      const state = createAbilitySystemState([AbilityType.CannonBarrage]);
      expect(canUseAbility(state, AbilityType.SonarPing)).toBe(false);
    });

    it('ticks cooldowns correctly', () => {
      const state = createAbilitySystemState([AbilityType.CannonBarrage]);
      state.abilityStates[0].cooldownRemaining = 3;
      expect(canUseAbility(state, AbilityType.CannonBarrage)).toBe(false);

      tickCooldowns(state);
      expect(state.abilityStates[0].cooldownRemaining).toBe(2);

      tickCooldowns(state);
      tickCooldowns(state);
      expect(state.abilityStates[0].cooldownRemaining).toBe(0);
      expect(canUseAbility(state, AbilityType.CannonBarrage)).toBe(true);
    });
  });

  describe('Cannon Barrage', () => {
    it('fires on a 2x2 area', () => {
      const board = new Board();
      board.placeShip({ type: ShipType.Destroyer, start: { row: 0, col: 0 }, orientation: Orientation.Horizontal });
      const state = createAbilitySystemState([AbilityType.CannonBarrage]);

      const result = executeCannonBarrage(board, { row: 0, col: 0 }, state);
      expect(result).not.toBeNull();
      expect(result!.outcomes.length).toBeGreaterThanOrEqual(1);
      expect(result!.outcomes.length).toBeLessThanOrEqual(4);
    });

    it('goes on cooldown after use', () => {
      const board = new Board();
      const state = createAbilitySystemState([AbilityType.CannonBarrage]);

      executeCannonBarrage(board, { row: 5, col: 5 }, state);
      expect(canUseAbility(state, AbilityType.CannonBarrage)).toBe(false);
      expect(state.abilityStates[0].cooldownRemaining).toBe(3);
    });
  });

  describe('Sonar Ping', () => {
    it('detects ship in 3x3 area', () => {
      const board = new Board();
      board.placeShip({ type: ShipType.Destroyer, start: { row: 5, col: 5 }, orientation: Orientation.Horizontal });
      const state = createAbilitySystemState([AbilityType.SonarPing]);

      const result = executeSonarPing(board, { row: 5, col: 5 }, state);
      expect(result).not.toBeNull();
      expect(result!.shipDetected).toBe(true);
      expect(result!.area.length).toBeGreaterThan(0);
    });

    it('reports no ship when area is empty', () => {
      const board = new Board();
      board.placeShip({ type: ShipType.Destroyer, start: { row: 0, col: 0 }, orientation: Orientation.Horizontal });
      const state = createAbilitySystemState([AbilityType.SonarPing]);

      const result = executeSonarPing(board, { row: 8, col: 8 }, state);
      expect(result).not.toBeNull();
      expect(result!.shipDetected).toBe(false);
    });
  });

  describe('Smoke Screen', () => {
    it('creates a smoke zone', () => {
      const state = createAbilitySystemState([AbilityType.SmokeScreen]);
      const success = executeSmokeScreen({ row: 5, col: 5 }, state);
      expect(success).toBe(true);
      expect(state.smokeZones).toHaveLength(1);
      expect(state.smokeZones[0].turnsRemaining).toBe(2);
    });

    it('reports cells as smoked', () => {
      const state = createAbilitySystemState([AbilityType.SmokeScreen]);
      executeSmokeScreen({ row: 5, col: 5 }, state);

      expect(isCellSmoked({ row: 5, col: 5 }, state.smokeZones)).toBe(true);
      expect(isCellSmoked({ row: 4, col: 4 }, state.smokeZones)).toBe(true);
      expect(isCellSmoked({ row: 3, col: 3 }, state.smokeZones)).toBe(false);
    });

    it('smoke expires after ticking', () => {
      const state = createAbilitySystemState([AbilityType.SmokeScreen]);
      executeSmokeScreen({ row: 5, col: 5 }, state);

      tickCooldowns(state); // turns remaining: 1
      expect(state.smokeZones).toHaveLength(1);

      tickCooldowns(state); // turns remaining: 0 → removed
      expect(state.smokeZones).toHaveLength(0);
      expect(isCellSmoked({ row: 5, col: 5 }, state.smokeZones)).toBe(false);
    });
  });

  describe('Repair Kit', () => {
    it('repairs a hit cell', () => {
      const board = new Board();
      board.placeShip({ type: ShipType.Cruiser, start: { row: 0, col: 0 }, orientation: Orientation.Horizontal });
      board.receiveShot({ row: 0, col: 0 }); // hit
      expect(board.grid[0][0]).toBe(CellState.Hit);

      const state = createAbilitySystemState([AbilityType.RepairKit]);
      const result = executeRepairKit(board, { row: 0, col: 0 }, state);

      expect(result).not.toBeNull();
      expect(board.grid[0][0]).toBe(CellState.Ship);
      // Hit should be removed from ship
      const cruiser = board.ships.find((s) => s.type === ShipType.Cruiser)!;
      expect(cruiser.hits.size).toBe(0);
    });

    it('cannot repair a sunk ship', () => {
      const board = new Board();
      board.placeShip({ type: ShipType.Destroyer, start: { row: 0, col: 0 }, orientation: Orientation.Horizontal });
      board.receiveShot({ row: 0, col: 0 });
      board.receiveShot({ row: 0, col: 1 }); // sunk

      const state = createAbilitySystemState([AbilityType.RepairKit]);
      const result = executeRepairKit(board, { row: 0, col: 0 }, state);
      expect(result).toBeNull();
    });

    it('can only be used once', () => {
      const board = new Board();
      board.placeShip({ type: ShipType.Carrier, start: { row: 0, col: 0 }, orientation: Orientation.Horizontal });
      board.receiveShot({ row: 0, col: 0 });
      board.receiveShot({ row: 0, col: 1 });

      const state = createAbilitySystemState([AbilityType.RepairKit]);
      executeRepairKit(board, { row: 0, col: 0 }, state);
      const result2 = executeRepairKit(board, { row: 0, col: 1 }, state);
      expect(result2).toBeNull();
    });
  });

  describe('Chain Shot', () => {
    it('fires on a 1x3 horizontal line', () => {
      const board = new Board();
      board.placeShip({ type: ShipType.Cruiser, start: { row: 5, col: 0 }, orientation: Orientation.Horizontal });
      const state = createAbilitySystemState([AbilityType.ChainShot]);

      const result = executeChainShot(board, { row: 5, col: 0 }, state);
      expect(result).not.toBeNull();
      expect(result!.outcomes.length).toBe(3);
      expect(result!.outcomes.every((o) => o.result !== 'miss')).toBe(true);
    });

    it('clamps at right edge', () => {
      const board = new Board();
      const state = createAbilitySystemState([AbilityType.ChainShot]);
      const result = executeChainShot(board, { row: 0, col: 9 }, state);
      expect(result).not.toBeNull();
      expect(result!.outcomes.length).toBe(1);
    });

    it('goes on cooldown', () => {
      const board = new Board();
      const state = createAbilitySystemState([AbilityType.ChainShot]);
      executeChainShot(board, { row: 0, col: 0 }, state);
      expect(canUseAbility(state, AbilityType.ChainShot)).toBe(false);
      expect(state.abilityStates[0].cooldownRemaining).toBe(3);
    });
  });

  describe('Spyglass', () => {
    it('fires a shot and counts row ship cells', () => {
      const board = new Board();
      board.placeShip({ type: ShipType.Cruiser, start: { row: 3, col: 0 }, orientation: Orientation.Horizontal });
      board.placeShip({ type: ShipType.Destroyer, start: { row: 3, col: 7 }, orientation: Orientation.Horizontal });
      const state = createAbilitySystemState([AbilityType.Spyglass]);

      const result = executeSpyglass(board, { row: 3, col: 5 }, state);
      expect(result).not.toBeNull();
      // The shot at (3,5) is a miss; remaining unrevealed ship cells in row 3:
      // Cruiser (3,0)-(3,2) = 3 cells, Destroyer (3,7)-(3,8) = 2 cells = 5 total
      expect(result!.rowShipCount).toBe(5);
      expect(result!.shotOutcome.result).toBe('miss');
    });

    it('counts the shot ship cells correctly when hitting', () => {
      const board = new Board();
      board.placeShip({ type: ShipType.Destroyer, start: { row: 0, col: 0 }, orientation: Orientation.Horizontal });
      const state = createAbilitySystemState([AbilityType.Spyglass]);

      const result = executeSpyglass(board, { row: 0, col: 0 }, state);
      expect(result).not.toBeNull();
      expect(result!.shotOutcome.result).not.toBe('miss');
      // After hitting (0,0), only (0,1) remains as Ship in row 0
      expect(result!.rowShipCount).toBe(1);
    });
  });

  describe('Boarding Party', () => {
    it('reveals ship type and HP when targeting a ship', () => {
      const board = new Board();
      board.placeShip({ type: ShipType.Battleship, start: { row: 4, col: 4 }, orientation: Orientation.Horizontal });
      board.receiveShot({ row: 4, col: 5 }); // pre-existing hit

      const state = createAbilitySystemState([AbilityType.BoardingParty]);
      const result = executeBoardingParty(board, { row: 4, col: 4 }, state);
      expect(result).not.toBeNull();
      expect(result!.shipType).toBe(ShipType.Battleship);
      expect(result!.totalCells).toBe(4);
      expect(result!.hitsTaken).toBe(1);
    });

    it('returns null when targeting empty cell, but consumes the use', () => {
      const board = new Board();
      const state = createAbilitySystemState([AbilityType.BoardingParty]);
      const result = executeBoardingParty(board, { row: 0, col: 0 }, state);
      expect(result).toBeNull();
      expect(canUseAbility(state, AbilityType.BoardingParty)).toBe(false);
    });
  });
});
