/**
 * In-memory game room management.
 * Each room owns a GameEngine instance from the shared package and is the
 * authoritative source of truth for game state.
 */

import { GameEngine } from '../../../shared/src/GameEngine.ts';
import { Board } from '../../../shared/src/Board.ts';
import {
  CellState,
  GamePhase,
  ShotResult,
  ShipType,
  type ShipPlacement,
  type Coordinate,
  type ShotOutcome,
  type Ship,
  coordKey,
} from '../../../shared/src/types.ts';
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
  executeSummonKraken,
  resolveKrakenStrike,
  fixStaleOutcomes,
  type AbilitySystemState,
} from '../../../shared/src/abilities.ts';
import {
  createTraitState,
  applyDeflectionTrait,
  processDepthCharge,
  resolveDepthChargeShots,
  type TraitState,
} from '../../../shared/src/traits.ts';
import type {
  PublicGameState,
  OwnBoardView,
  PublicBoardView,
  PlayerView,
  ChatMessage,
  SerializedShip,
  SpectatorGameState,
  SpectatableRoom,
} from '../../../shared/src/sockets.ts';

export interface RoomPlayer {
  id: string;
  username: string;
  rating: number;
  socketId: string;
  selectedAbilities: AbilityType[];
  abilities: AbilitySystemState | null;
  traits: TraitState | null;
  hasPlaced: boolean;
  isConnected: boolean;
  disconnectedAt?: number;
  // Kraken summoning ritual. Number of own-turns the caster still owes
  // before the strike resolves. null = no ritual active.
  ritualTurnsRemaining?: number | null;
}

export interface GameRoom {
  id: string;
  code?: string; // for private rooms
  isRanked: boolean;
  isPrivate: boolean;
  players: [RoomPlayer, RoomPlayer | null];
  engine: GameEngine;
  chatMessages: ChatMessage[];
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  lastActivityAt: number;
  rematchRequests: Set<string>; // player IDs that requested rematch
  abilitiesUsed: Record<string, Record<string, number>>; // playerId -> abilityType -> count
  spectators: Map<string, { socketId: string; username: string }>; // socketId -> info
  spectatorChat: Array<{ id: string; username: string; text: string; timestamp: number }>;
}

const MAX_SPECTATORS = 20;
const rooms = new Map<string, GameRoom>();
const codeToRoom = new Map<string, string>(); // private room code -> roomId
const socketToRoom = new Map<string, string>(); // socket ID -> roomId
const spectatorSocketToRoom = new Map<string, string>(); // spectator socketId -> roomId

export function getRoom(roomId: string): GameRoom | undefined {
  return rooms.get(roomId);
}

export function getRoomByCode(code: string): GameRoom | undefined {
  const id = codeToRoom.get(code.toUpperCase());
  return id ? rooms.get(id) : undefined;
}

export function getRoomBySocket(socketId: string): GameRoom | undefined {
  const id = socketToRoom.get(socketId);
  return id ? rooms.get(id) : undefined;
}

export function generateRoomId(): string {
  return 'room_' + Math.random().toString(36).slice(2, 10);
}

export function generatePrivateCode(): string {
  // 6-char alphanumeric, no ambiguous chars
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function createRoom(
  player1: Omit<RoomPlayer, 'abilities' | 'traits' | 'hasPlaced' | 'isConnected'>,
  isRanked: boolean,
  isPrivate: boolean
): GameRoom {
  const id = generateRoomId();
  const room: GameRoom = {
    id,
    isRanked,
    isPrivate,
    players: [
      {
        ...player1,
        abilities: null,
        traits: null,
        hasPlaced: false,
        isConnected: true,
      },
      null,
    ],
    engine: new GameEngine(),
    chatMessages: [],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    rematchRequests: new Set(),
    abilitiesUsed: {},
    spectators: new Map(),
    spectatorChat: [],
  };
  if (isPrivate) {
    let code = generatePrivateCode();
    while (codeToRoom.has(code)) code = generatePrivateCode();
    room.code = code;
    codeToRoom.set(code, id);
  }
  rooms.set(id, room);
  socketToRoom.set(player1.socketId, id);
  return room;
}

export function joinRoom(
  room: GameRoom,
  player2: Omit<RoomPlayer, 'abilities' | 'traits' | 'hasPlaced' | 'isConnected'>
): boolean {
  if (room.players[1]) return false;
  room.players[1] = {
    ...player2,
    abilities: null,
    traits: null,
    hasPlaced: false,
    isConnected: true,
  };
  socketToRoom.set(player2.socketId, room.id);
  room.lastActivityAt = Date.now();
  return true;
}

export function placeShips(
  room: GameRoom,
  playerId: string,
  placements: ShipPlacement[]
): boolean {
  if (room.engine.phase !== GamePhase.Placement) return false;

  const playerIdx = room.players.findIndex((p) => p && p.id === playerId);
  if (playerIdx < 0) return false;
  const player = room.players[playerIdx]!;
  if (player.hasPlaced) return false;

  // Place ships on the appropriate board
  // Player at index 0 = playerBoard, index 1 = opponentBoard
  const board = playerIdx === 0 ? room.engine.playerBoard : room.engine.opponentBoard;
  const placeFn = playerIdx === 0
    ? room.engine.placePlayerShip.bind(room.engine)
    : room.engine.placeOpponentShip.bind(room.engine);

  // Validate all placements first
  const validation = new GameEngine();
  for (const p of placements) {
    if (!validation.placePlayerShip(p)) return false;
  }

  // Apply
  for (const p of placements) {
    placeFn(p);
  }

  // Initialize traits + abilities for this player
  player.traits = createTraitState();
  player.abilities = createAbilitySystemState(player.selectedAbilities);
  player.hasPlaced = true;
  room.lastActivityAt = Date.now();

  // If both placed, start the game
  if (room.players[0]?.hasPlaced && room.players[1]?.hasPlaced) {
    room.engine.startGame();
    room.startedAt = Date.now();
  }

  return true;
}

/**
 * Player fires at a coordinate. Returns the outcome and applies trait effects.
 */
export function fireShot(
  room: GameRoom,
  playerId: string,
  coord: Coordinate
): ShotOutcome | null {
  if (room.engine.phase !== GamePhase.Playing) return null;

  const playerIdx = room.players.findIndex((p) => p && p.id === playerId);
  if (playerIdx < 0) return null;

  const isPlayer1 = playerIdx === 0;
  const expectedTurn = isPlayer1 ? 'player' : 'opponent';
  if (room.engine.currentTurn !== expectedTurn) return null;

  const self = room.players[playerIdx]!;
  const opponent = room.players[isPlayer1 ? 1 : 0];
  if (!opponent || !opponent.traits) return null;

  // Ritual in progress — caster cannot fire.
  if (self.ritualTurnsRemaining && self.ritualTurnsRemaining > 0) return null;

  const targetBoard = isPlayer1 ? room.engine.opponentBoard : room.engine.playerBoard;
  const attackerBoard = isPlayer1 ? room.engine.playerBoard : room.engine.opponentBoard;

  const outcome = isPlayer1
    ? room.engine.playerShoot(coord)
    : room.engine.opponentShoot(coord);
  if (!outcome) return null;

  // Unified deflection: Coastal Cover > Ironclad
  if (outcome.result === ShotResult.Hit) {
    const source = applyDeflectionTrait(targetBoard, coord, opponent.traits);
    if (source) {
      const ship = targetBoard.getShipAt(coord);
      if (ship) ship.hits.delete(coordKey(coord));
      targetBoard.grid[coord.row][coord.col] = CellState.Ship; // re-targetable
      outcome.result = ShotResult.Miss;
      outcome.sunkShip = undefined;
      outcome.deflected = true;
      outcome.deflectionSource = source;
      room.engine.currentTurn = isPlayer1 ? 'opponent' : 'player';
      if (!isPlayer1) room.engine.turnCount++;
    }
  }

  // Depth Charge retaliation — if the undeflected hit struck opponent's Destroyer.
  if (
    !outcome.deflected &&
    (outcome.result === ShotResult.Hit || outcome.result === ShotResult.Sink)
  ) {
    const triggered = processDepthCharge(targetBoard, coord, opponent.traits);
    if (triggered) {
      outcome.depthChargeShots = resolveDepthChargeShots(attackerBoard, 6);
    }
  }

  // Record action for accuracy (after trait processing)
  if (isPlayer1) {
    room.engine.recordPlayerAction(outcome.result === ShotResult.Hit || outcome.result === ShotResult.Sink);
  } else {
    room.engine.recordOpponentAction(outcome.result === ShotResult.Hit || outcome.result === ShotResult.Sink);
  }

  // Tick own ability cooldowns
  if (self.abilities) tickCooldowns(self.abilities);

  room.lastActivityAt = Date.now();
  return outcome;
}

export function useAbility(
  room: GameRoom,
  playerId: string,
  ability: AbilityType,
  coord: Coordinate
): { ok: boolean; sonarShipDetected?: boolean } {
  if (room.engine.phase !== GamePhase.Playing) return { ok: false };

  const playerIdx = room.players.findIndex((p) => p && p.id === playerId);
  if (playerIdx < 0) return { ok: false };

  const isPlayer1 = playerIdx === 0;
  const expectedTurn = isPlayer1 ? 'player' : 'opponent';
  if (room.engine.currentTurn !== expectedTurn) return { ok: false };

  const player = room.players[playerIdx]!;
  if (!player.abilities || !canUseAbility(player.abilities, ability)) return { ok: false };

  const targetBoard = isPlayer1 ? room.engine.opponentBoard : room.engine.playerBoard;
  const ownBoard = isPlayer1 ? room.engine.playerBoard : room.engine.opponentBoard;
  const opponentIdx = isPlayer1 ? 1 : 0;
  const opponent = room.players[opponentIdx];
  const opponentTraits = opponent?.traits ?? null;

  // Block actions while the caster is in a Kraken ritual.
  if (player.ritualTurnsRemaining && player.ritualTurnsRemaining > 0) {
    return { ok: false };
  }

  // Apply Coastal Cover / Ironclad / Depth Charge to ability-based shots.
  const attackerBoard = isPlayer1 ? room.engine.playerBoard : room.engine.opponentBoard;
  const applyTraits = (outcomes: ShotOutcome[]) => {
    if (!opponentTraits) return;
    let depthChargeFired = false;
    for (const outcome of outcomes) {
      const c = outcome.coordinate;
      if (outcome.result === ShotResult.Hit) {
        const source = applyDeflectionTrait(targetBoard, c, opponentTraits);
        if (source) {
          const ship = targetBoard.getShipAt(c);
          if (ship) ship.hits.delete(coordKey(c));
          targetBoard.grid[c.row][c.col] = CellState.Ship;
          outcome.result = ShotResult.Miss;
          outcome.sunkShip = undefined;
          outcome.deflected = true;
          outcome.deflectionSource = source;
          continue;
        }
      }
      // Depth Charge — one retaliation per batch, first Destroyer hit.
      if (
        !depthChargeFired &&
        (outcome.result === ShotResult.Hit || outcome.result === ShotResult.Sink) &&
        processDepthCharge(targetBoard, c, opponentTraits)
      ) {
        depthChargeFired = true;
        outcome.depthChargeShots = resolveDepthChargeShots(attackerBoard, 6);
      }
    }
  };

  let sonarShipDetected: boolean | undefined;

  switch (ability) {
    case AbilityType.CannonBarrage: {
      const result = executeCannonBarrage(targetBoard, coord, player.abilities);
      if (!result) return { ok: false };
      applyTraits(result.outcomes);
      fixStaleOutcomes(result.outcomes, targetBoard);
      const didHit = result.outcomes.some(o => o.result === ShotResult.Hit || o.result === ShotResult.Sink);
      if (isPlayer1) room.engine.recordPlayerAction(didHit); else room.engine.recordOpponentAction(didHit);
      room.engine.currentTurn = isPlayer1 ? 'opponent' : 'player';
      if (!isPlayer1) room.engine.turnCount++;
      if (targetBoard.allShipsSunk()) {
        room.engine.phase = GamePhase.Finished;
        room.engine.winner = isPlayer1 ? 'player' : 'opponent';
        room.endedAt = Date.now();
      }
      break;
    }
    case AbilityType.SonarPing: {
      const result = executeSonarPing(targetBoard, coord, player.abilities);
      if (!result) return { ok: false };
      sonarShipDetected = result.shipDetected;
      if (isPlayer1) room.engine.recordPlayerAction(result.shipDetected); else room.engine.recordOpponentAction(result.shipDetected);
      room.engine.currentTurn = isPlayer1 ? 'opponent' : 'player';
      if (!isPlayer1) room.engine.turnCount++;
      break;
    }
    case AbilityType.SmokeScreen: {
      if (!executeSmokeScreen(coord, player.abilities)) return { ok: false };
      if (isPlayer1) room.engine.recordPlayerAction(false); else room.engine.recordOpponentAction(false);
      room.engine.currentTurn = isPlayer1 ? 'opponent' : 'player';
      if (!isPlayer1) room.engine.turnCount++;
      break;
    }
    case AbilityType.RepairKit: {
      const result = executeRepairKit(ownBoard, coord, player.abilities);
      if (!result) return { ok: false };
      if (isPlayer1) room.engine.recordPlayerAction(false); else room.engine.recordOpponentAction(false);
      room.engine.currentTurn = isPlayer1 ? 'opponent' : 'player';
      if (!isPlayer1) room.engine.turnCount++;
      break;
    }
    case AbilityType.ChainShot: {
      const result = executeChainShot(targetBoard, coord, player.abilities);
      if (!result) return { ok: false };
      applyTraits(result.outcomes);
      fixStaleOutcomes(result.outcomes, targetBoard);
      const csHit = result.outcomes.some(o => o.result === ShotResult.Hit || o.result === ShotResult.Sink);
      if (isPlayer1) room.engine.recordPlayerAction(csHit); else room.engine.recordOpponentAction(csHit);
      room.engine.currentTurn = isPlayer1 ? 'opponent' : 'player';
      if (!isPlayer1) room.engine.turnCount++;
      if (targetBoard.allShipsSunk()) {
        room.engine.phase = GamePhase.Finished;
        room.engine.winner = isPlayer1 ? 'player' : 'opponent';
        room.endedAt = Date.now();
      }
      break;
    }
    case AbilityType.Spyglass: {
      const result = executeSpyglass(targetBoard, coord, player.abilities);
      if (!result) return { ok: false };
      applyTraits([result.shotOutcome]);
      fixStaleOutcomes([result.shotOutcome], targetBoard);
      const sgHit = result.shotOutcome.result === ShotResult.Hit || result.shotOutcome.result === ShotResult.Sink;
      if (isPlayer1) room.engine.recordPlayerAction(sgHit); else room.engine.recordOpponentAction(sgHit);
      room.engine.currentTurn = isPlayer1 ? 'opponent' : 'player';
      if (!isPlayer1) room.engine.turnCount++;
      if (targetBoard.allShipsSunk()) {
        room.engine.phase = GamePhase.Finished;
        room.engine.winner = isPlayer1 ? 'player' : 'opponent';
        room.endedAt = Date.now();
      }
      break;
    }
    case AbilityType.BoardingParty: {
      const bpResult = executeBoardingParty(targetBoard, coord, player.abilities);
      if (isPlayer1) room.engine.recordPlayerAction(bpResult !== null); else room.engine.recordOpponentAction(bpResult !== null);
      room.engine.currentTurn = isPlayer1 ? 'opponent' : 'player';
      if (!isPlayer1) room.engine.turnCount++;
      break;
    }
    case AbilityType.SummonKraken: {
      const ritual = executeSummonKraken(player.abilities);
      if (!ritual) return { ok: false };
      // Start the ritual — caster forfeits their next 2 own-turns.
      player.ritualTurnsRemaining = ritual.turnsRemaining;
      room.engine.currentTurn = isPlayer1 ? 'opponent' : 'player';
      if (!isPlayer1) room.engine.turnCount++;
      break;
    }
  }

  room.lastActivityAt = Date.now();
  return { ok: true, sonarShipDetected };
}

/**
 * Advance the caster's Kraken ritual by one turn. Caller should invoke this
 * whenever it becomes the caster's turn and they cannot fire (ritual active).
 * When the counter hits 0, the Kraken strike resolves.
 *
 * Returns:
 *   - { status: 'none' } if no ritual active,
 *   - { status: 'ticked' } if a turn was consumed (ritual continues),
 *   - { status: 'strike', strike } on resolution (strike may have sunkShip=null
 *     when every unsunk ship is warded).
 */
export type RitualAdvanceResult =
  | { status: 'none' }
  | { status: 'ticked' }
  | { status: 'strike'; sunkShipType: ShipType | null; cells: Coordinate[] };

export function advanceRitual(room: GameRoom, playerId: string): RitualAdvanceResult {
  if (room.engine.phase !== GamePhase.Playing) return { status: 'none' };
  const playerIdx = room.players.findIndex((p) => p && p.id === playerId);
  if (playerIdx < 0) return { status: 'none' };
  const isPlayer1 = playerIdx === 0;
  const expectedTurn = isPlayer1 ? 'player' : 'opponent';
  if (room.engine.currentTurn !== expectedTurn) return { status: 'none' };
  const player = room.players[playerIdx]!;
  const turns = player.ritualTurnsRemaining ?? 0;
  if (turns <= 0) return { status: 'none' };

  const remaining = turns - 1;
  if (remaining > 0) {
    player.ritualTurnsRemaining = remaining;
    room.engine.currentTurn = isPlayer1 ? 'opponent' : 'player';
    if (!isPlayer1) room.engine.turnCount++;
    room.lastActivityAt = Date.now();
    return { status: 'ticked' };
  }

  // Resolve strike against the defender's board (opposite of caster).
  const targetBoard = isPlayer1 ? room.engine.opponentBoard : room.engine.playerBoard;
  const strike = resolveKrakenStrike(targetBoard, new Set([ShipType.Cruiser]));
  player.ritualTurnsRemaining = null;
  room.engine.currentTurn = isPlayer1 ? 'opponent' : 'player';
  if (!isPlayer1) room.engine.turnCount++;
  if (targetBoard.allShipsSunk()) {
    room.engine.phase = GamePhase.Finished;
    room.engine.winner = isPlayer1 ? 'player' : 'opponent';
    room.endedAt = Date.now();
  }
  room.lastActivityAt = Date.now();
  if (strike) {
    return { status: 'strike', sunkShipType: strike.sunkShip.type, cells: strike.cells };
  }
  return { status: 'strike', sunkShipType: null, cells: [] };
}

export function resignPlayer(room: GameRoom, playerId: string): void {
  const playerIdx = room.players.findIndex((p) => p && p.id === playerId);
  if (playerIdx < 0) return;
  room.engine.phase = GamePhase.Finished;
  room.engine.winner = playerIdx === 0 ? 'opponent' : 'player';
  room.endedAt = Date.now();
}

export function addChatMessage(
  room: GameRoom,
  playerId: string,
  text: string
): ChatMessage | null {
  const player = room.players.find((p) => p && p.id === playerId);
  if (!player) return null;

  const message: ChatMessage = {
    id: Math.random().toString(36).slice(2),
    fromId: playerId,
    fromUsername: player.username,
    text: profanityFilter(text),
    timestamp: Date.now(),
  };
  room.chatMessages.push(message);
  if (room.chatMessages.length > 100) room.chatMessages.shift();
  return message;
}

const PROFANITY_LIST = ['fuck', 'shit', 'bitch', 'asshole', 'cunt'];
function profanityFilter(text: string): string {
  let result = text;
  for (const word of PROFANITY_LIST) {
    const re = new RegExp(word, 'gi');
    result = result.replace(re, (m) => '*'.repeat(m.length));
  }
  return result;
}

/**
 * Build the public game state for a specific player perspective.
 * Masks the opponent's ships unless they're sunk.
 */
export function buildPublicState(room: GameRoom, playerId: string): PublicGameState | null {
  const playerIdx = room.players.findIndex((p) => p && p.id === playerId);
  if (playerIdx < 0) return null;
  const isPlayer1 = playerIdx === 0;
  const self = room.players[playerIdx]!;
  const opponent = room.players[isPlayer1 ? 1 : 0];
  if (!opponent) return null;

  const ownBoard = isPlayer1 ? room.engine.playerBoard : room.engine.opponentBoard;
  const oppBoard = isPlayer1 ? room.engine.opponentBoard : room.engine.playerBoard;

  return {
    roomId: room.id,
    phase: room.engine.phase as 'placement' | 'playing' | 'finished',
    currentTurn: room.engine.currentTurn === (isPlayer1 ? 'player' : 'opponent') ? 'self' : 'opponent',
    turnCount: room.engine.turnCount,
    winner: room.engine.winner === null ? null : (room.engine.winner === (isPlayer1 ? 'player' : 'opponent') ? 'self' : 'opponent'),
    ownBoard: serializeOwnBoard(ownBoard),
    opponentBoard: serializePublicBoard(oppBoard),
    ownAbilities: self.abilities?.abilityStates.map((a) => ({
      type: a.type,
      cooldownRemaining: a.cooldownRemaining,
      usesRemaining: a.usesRemaining,
    })) ?? [],
    opponentAbilitiesSummary: opponent.abilities?.abilityStates.map((a) => ({
      type: a.type,
      cooldownRemaining: a.cooldownRemaining,
    })) ?? [],
    opponent: {
      id: opponent.id,
      username: opponent.username,
      rating: opponent.rating,
      isReady: opponent.hasPlaced,
    },
    isRanked: room.isRanked,
    ownRitualTurnsRemaining: self.ritualTurnsRemaining ?? null,
    opponentRitualTurnsRemaining: opponent.ritualTurnsRemaining ?? null,
  };
}

export function trackAbilityUsed(room: GameRoom, playerId: string, abilityType: string): void {
  if (!room.abilitiesUsed[playerId]) room.abilitiesUsed[playerId] = {};
  room.abilitiesUsed[playerId][abilityType] = (room.abilitiesUsed[playerId][abilityType] ?? 0) + 1;
}

export function serializeShip(ship: Ship): SerializedShip {
  return {
    type: ship.type,
    cells: ship.cells.map((c) => ({ row: c.row, col: c.col })),
    hits: Array.from(ship.hits),
  };
}

function serializeOwnBoard(board: Board): OwnBoardView {
  const cells = board.grid.map((row) =>
    row.map((c) => {
      if (c === CellState.Hit) return 'hit' as const;
      if (c === CellState.Miss) return 'miss' as const;
      if (c === CellState.Ship) return 'ship' as const;
      if (c === CellState.Land) return 'land' as const;
      if (c === CellState.LandRevealed) return 'land_revealed' as const;
      return 'empty' as const;
    })
  );
  return {
    width: board.grid[0].length,
    height: board.grid.length,
    cells,
    ships: board.ships.map(serializeShip),
  };
}

function serializePublicBoard(board: Board): PublicBoardView {
  const cells = board.grid.map((row) =>
    row.map((c) => {
      if (c === CellState.Hit) return 'hit' as const;
      if (c === CellState.Miss) return 'miss' as const;
      if (c === CellState.LandRevealed) return 'land_revealed' as const;
      // Hide ship and unrevealed land cells
      return 'empty' as const;
    })
  );
  return {
    width: board.grid[0].length,
    height: board.grid.length,
    cells,
    sunkShips: board.ships.filter((s) => s.hits.size === s.cells.length).map(serializeShip),
  };
}

export function deleteRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  if (room.code) codeToRoom.delete(room.code);
  for (const p of room.players) {
    if (p) socketToRoom.delete(p.socketId);
  }
  rooms.delete(roomId);
}

export function handleDisconnect(socketId: string): GameRoom | null {
  const room = getRoomBySocket(socketId);
  if (!room) return null;
  const player = room.players.find((p) => p && p.socketId === socketId);
  if (!player) return null;
  player.isConnected = false;
  player.disconnectedAt = Date.now();
  return room;
}

export function handleReconnect(playerId: string, newSocketId: string): GameRoom | null {
  for (const room of rooms.values()) {
    const player = room.players.find((p) => p && p.id === playerId);
    if (player && !player.isConnected) {
      socketToRoom.delete(player.socketId);
      player.socketId = newSocketId;
      player.isConnected = true;
      player.disconnectedAt = undefined;
      socketToRoom.set(newSocketId, room.id);
      return room;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════
// Spectator management
// ═══════════════════════════════════════════════════

export function addSpectator(room: GameRoom, socketId: string, username: string): { ok: true } | { error: string } {
  if (room.spectators.size >= MAX_SPECTATORS) return { error: 'Spectator limit reached' };
  room.spectators.set(socketId, { socketId, username });
  spectatorSocketToRoom.set(socketId, room.id);
  return { ok: true };
}

export function removeSpectator(socketId: string): void {
  const roomId = spectatorSocketToRoom.get(socketId);
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (room) room.spectators.delete(socketId);
  spectatorSocketToRoom.delete(socketId);
}

export function getSpectatingRoom(socketId: string): GameRoom | undefined {
  const roomId = spectatorSocketToRoom.get(socketId);
  return roomId ? rooms.get(roomId) : undefined;
}

export function buildSpectatorState(room: GameRoom): SpectatorGameState | null {
  if (!room.players[0] || !room.players[1]) return null;
  return {
    roomId: room.id,
    phase: room.engine.phase === GamePhase.Placement ? 'placement'
      : room.engine.phase === GamePhase.Finished ? 'finished' : 'playing',
    currentTurn: room.engine.currentTurn === 'player' ? 'player1' : 'player2',
    turnCount: room.engine.turnCount,
    winner: room.engine.winner === 'player' ? 'player1'
      : room.engine.winner === 'opponent' ? 'player2' : null,
    player1: { username: room.players[0].username, rating: room.players[0].rating },
    player2: { username: room.players[1].username, rating: room.players[1].rating },
    board1: serializePublicBoard(room.engine.playerBoard),
    board2: serializePublicBoard(room.engine.opponentBoard),
    spectatorCount: room.spectators.size,
  };
}

export function listSpectatableRooms(): SpectatableRoom[] {
  const result: SpectatableRoom[] = [];
  for (const room of rooms.values()) {
    if (room.engine.phase !== GamePhase.Playing) continue;
    if (!room.players[0] || !room.players[1]) continue;
    if (room.isPrivate) continue;
    result.push({
      roomId: room.id,
      player1: room.players[0].username,
      player2: room.players[1].username,
      turnCount: room.engine.turnCount,
      spectatorCount: room.spectators.size,
    });
  }
  return result;
}

// Garbage collection: rooms inactive for >10 minutes are cleaned up
setInterval(() => {
  const now = Date.now();
  const TIMEOUT_MS = 10 * 60 * 1000;
  for (const [id, room] of rooms.entries()) {
    if (now - room.lastActivityAt > TIMEOUT_MS) {
      console.log(`[rooms] GC removing inactive room ${id}`);
      deleteRoom(id);
    }
  }
}, 60 * 1000);
