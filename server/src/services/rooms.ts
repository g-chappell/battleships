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
  type AbilitySystemState,
} from '../../../shared/src/abilities.ts';
import {
  createTraitState,
  initNimbleCells,
  processIronclad,
  processNimble,
  type TraitState,
} from '../../../shared/src/traits.ts';
import type {
  PublicGameState,
  OwnBoardView,
  PublicBoardView,
  PlayerView,
  ChatMessage,
  SerializedShip,
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
}

const rooms = new Map<string, GameRoom>();
const codeToRoom = new Map<string, string>(); // private room code -> roomId
const socketToRoom = new Map<string, string>(); // socket ID -> roomId

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
  player.traits.nimbleFirstShotAdjacent = initNimbleCells(board);
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

  const opponent = room.players[isPlayer1 ? 1 : 0];
  if (!opponent || !opponent.traits) return null;

  // Nimble check
  if (processNimble(coord, opponent.traits)) {
    const outcome = isPlayer1
      ? room.engine.playerShoot(coord)
      : room.engine.opponentShoot(coord);
    if (outcome && outcome.result !== ShotResult.Miss) {
      const board = isPlayer1 ? room.engine.opponentBoard : room.engine.playerBoard;
      const ship = board.getShipAt(coord);
      if (ship) ship.hits.delete(coordKey(coord));
      board.grid[coord.row][coord.col] = CellState.Miss;
      outcome.result = ShotResult.Miss;
      outcome.sunkShip = undefined;
      // Force turn switch
      room.engine.currentTurn = isPlayer1 ? 'opponent' : 'player';
      if (!isPlayer1) room.engine.turnCount++;
    }
    room.lastActivityAt = Date.now();
    return outcome;
  }

  const outcome = isPlayer1
    ? room.engine.playerShoot(coord)
    : room.engine.opponentShoot(coord);
  if (!outcome) return null;

  // Ironclad
  if (outcome.result === ShotResult.Hit) {
    const negated = processIronclad(
      isPlayer1 ? room.engine.opponentBoard : room.engine.playerBoard,
      coord,
      opponent.traits
    );
    if (negated) {
      const board = isPlayer1 ? room.engine.opponentBoard : room.engine.playerBoard;
      const ship = board.getShipAt(coord);
      if (ship) ship.hits.delete(coordKey(coord));
      board.grid[coord.row][coord.col] = CellState.Ship; // re-targetable
      outcome.result = ShotResult.Miss;
      outcome.sunkShip = undefined;
      room.engine.currentTurn = isPlayer1 ? 'opponent' : 'player';
      if (!isPlayer1) room.engine.turnCount++;
    }
  }

  // Tick own ability cooldowns
  const self = room.players[playerIdx]!;
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

  let sonarShipDetected: boolean | undefined;

  switch (ability) {
    case AbilityType.CannonBarrage: {
      const result = executeCannonBarrage(targetBoard, coord, player.abilities);
      if (!result) return { ok: false };
      // After ability, switch turn
      room.engine.currentTurn = isPlayer1 ? 'opponent' : 'player';
      if (!isPlayer1) room.engine.turnCount++;
      // Check win
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
      room.engine.currentTurn = isPlayer1 ? 'opponent' : 'player';
      if (!isPlayer1) room.engine.turnCount++;
      break;
    }
    case AbilityType.SmokeScreen: {
      if (!executeSmokeScreen(coord, player.abilities)) return { ok: false };
      room.engine.currentTurn = isPlayer1 ? 'opponent' : 'player';
      if (!isPlayer1) room.engine.turnCount++;
      break;
    }
    case AbilityType.RepairKit: {
      const result = executeRepairKit(ownBoard, coord, player.abilities);
      if (!result) return { ok: false };
      room.engine.currentTurn = isPlayer1 ? 'opponent' : 'player';
      if (!isPlayer1) room.engine.turnCount++;
      break;
    }
    case AbilityType.ChainShot: {
      const result = executeChainShot(targetBoard, coord, player.abilities);
      if (!result) return { ok: false };
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
      executeBoardingParty(targetBoard, coord, player.abilities);
      room.engine.currentTurn = isPlayer1 ? 'opponent' : 'player';
      if (!isPlayer1) room.engine.turnCount++;
      break;
    }
  }

  room.lastActivityAt = Date.now();
  return { ok: true, sonarShipDetected };
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
  };
}

function serializeShip(ship: Ship): SerializedShip {
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
      // Hide ship cells
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
