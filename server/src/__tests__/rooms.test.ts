import { describe, it, expect, beforeEach } from 'vitest';
import {
  createRoom,
  joinRoom,
  placeShips,
  fireShot,
  buildPublicState,
  resignPlayer,
  addSpectator,
  removeSpectator,
  buildSpectatorState,
  listSpectatableRooms,
  trackAbilityUsed,
  deleteRoom,
  type GameRoom,
  type RoomPlayer,
} from '../services/rooms.ts';
import { ShipType, Orientation, GamePhase } from '../../../shared/src/types.ts';
import type { ShipPlacement } from '../../../shared/src/types.ts';

const STANDARD_PLACEMENTS: ShipPlacement[] = [
  { type: ShipType.Carrier,    start: { row: 0, col: 0 }, orientation: Orientation.Horizontal },
  { type: ShipType.Battleship, start: { row: 1, col: 0 }, orientation: Orientation.Horizontal },
  { type: ShipType.Cruiser,    start: { row: 2, col: 0 }, orientation: Orientation.Horizontal },
  { type: ShipType.Submarine,  start: { row: 3, col: 0 }, orientation: Orientation.Horizontal },
  { type: ShipType.Destroyer,  start: { row: 4, col: 0 }, orientation: Orientation.Horizontal },
];

function makePlayer(id: string): Omit<RoomPlayer, 'abilities' | 'traits' | 'hasPlaced' | 'isConnected'> {
  return {
    id,
    username: `user_${id}`,
    rating: 1500,
    socketId: `socket_${id}`,
    selectedAbilities: [],
  };
}

function createFullRoom(): GameRoom {
  const room = createRoom(makePlayer('p1'), false, false);
  joinRoom(room, makePlayer('p2'));
  return room;
}

function createPlayingRoom(): GameRoom {
  const room = createFullRoom();
  placeShips(room, 'p1', STANDARD_PLACEMENTS);
  placeShips(room, 'p2', STANDARD_PLACEMENTS);
  return room;
}

describe('createRoom', () => {
  it('returns a room with correct defaults', () => {
    const room = createRoom(makePlayer('p1'), true, false);
    expect(room.id).toMatch(/^room_/);
    expect(room.isRanked).toBe(true);
    expect(room.isPrivate).toBe(false);
    expect(room.players[0]!.id).toBe('p1');
    expect(room.players[0]!.hasPlaced).toBe(false);
    expect(room.players[1]).toBeNull();
    expect(room.engine.phase).toBe(GamePhase.Placement);
    deleteRoom(room.id);
  });

  it('generates a private code for private rooms', () => {
    const room = createRoom(makePlayer('p1'), false, true);
    expect(room.code).toBeDefined();
    expect(room.code!.length).toBe(6);
    expect(room.isPrivate).toBe(true);
    deleteRoom(room.id);
  });
});

describe('joinRoom', () => {
  it('adds player2 to the room', () => {
    const room = createRoom(makePlayer('p1'), false, false);
    const result = joinRoom(room, makePlayer('p2'));
    expect(result).toBe(true);
    expect(room.players[1]!.id).toBe('p2');
    deleteRoom(room.id);
  });

  it('rejects a third player', () => {
    const room = createFullRoom();
    const result = joinRoom(room, makePlayer('p3'));
    expect(result).toBe(false);
    deleteRoom(room.id);
  });
});

describe('placeShips', () => {
  it('accepts valid standard placement', () => {
    const room = createFullRoom();
    const result = placeShips(room, 'p1', STANDARD_PLACEMENTS);
    expect(result).toBe(true);
    expect(room.players[0]!.hasPlaced).toBe(true);
    deleteRoom(room.id);
  });

  it('rejects placement for unknown player', () => {
    const room = createFullRoom();
    const result = placeShips(room, 'unknown', STANDARD_PLACEMENTS);
    expect(result).toBe(false);
    deleteRoom(room.id);
  });

  it('starts the game once both players place', () => {
    const room = createPlayingRoom();
    expect(room.engine.phase).toBe(GamePhase.Playing);
    expect(room.startedAt).toBeDefined();
    deleteRoom(room.id);
  });

  it('rejects duplicate placement by same player', () => {
    const room = createFullRoom();
    placeShips(room, 'p1', STANDARD_PLACEMENTS);
    const result = placeShips(room, 'p1', STANDARD_PLACEMENTS);
    expect(result).toBe(false);
    deleteRoom(room.id);
  });
});

describe('fireShot', () => {
  it('returns a valid outcome for a shot', () => {
    const room = createPlayingRoom();
    // Player whose turn it is fires
    const currentTurn = room.engine.currentTurn;
    const shooterId = currentTurn === 'player' ? 'p1' : 'p2';
    const outcome = fireShot(room, shooterId, { row: 0, col: 0 });
    expect(outcome).not.toBeNull();
    expect(outcome!.coordinate).toEqual({ row: 0, col: 0 });
    // Ships are at row 0-4 col 0+, so this should hit
    expect(outcome!.result).toBe('hit');
    deleteRoom(room.id);
  });

  it('returns null when not the players turn', () => {
    const room = createPlayingRoom();
    const currentTurn = room.engine.currentTurn;
    const wrongPlayer = currentTurn === 'player' ? 'p2' : 'p1';
    const outcome = fireShot(room, wrongPlayer, { row: 5, col: 5 });
    expect(outcome).toBeNull();
    deleteRoom(room.id);
  });
});

describe('buildPublicState', () => {
  it('masks opponent ship cells as empty (fog-of-war)', () => {
    const room = createPlayingRoom();
    const state = buildPublicState(room, 'p1');
    expect(state).not.toBeNull();
    // Opponent board should show no 'ship' cells
    for (const row of state!.opponentBoard.cells) {
      for (const cell of row) {
        expect(cell).not.toBe('ship');
      }
    }
    // Own board should show ships
    const hasShip = state!.ownBoard.cells.some((row) => row.some((c) => c === 'ship'));
    expect(hasShip).toBe(true);
    deleteRoom(room.id);
  });

  it('returns null for non-participant', () => {
    const room = createPlayingRoom();
    const state = buildPublicState(room, 'stranger');
    expect(state).toBeNull();
    deleteRoom(room.id);
  });
});

describe('resignPlayer', () => {
  it('sets the game to finished with opponent as winner', () => {
    const room = createPlayingRoom();
    resignPlayer(room, 'p1');
    expect(room.engine.phase).toBe(GamePhase.Finished);
    expect(room.engine.winner).toBe('opponent'); // p1 is index 0, so opponent wins
    expect(room.endedAt).toBeDefined();
    deleteRoom(room.id);
  });
});

describe('spectators', () => {
  it('addSpectator and removeSpectator manage the list', () => {
    const room = createPlayingRoom();
    const result = addSpectator(room, 'spec1', 'viewer1');
    expect(result).toEqual({ ok: true });
    expect(room.spectators.size).toBe(1);

    removeSpectator('spec1');
    expect(room.spectators.size).toBe(0);
    deleteRoom(room.id);
  });

  it('addSpectator rejects beyond max capacity', () => {
    const room = createPlayingRoom();
    for (let i = 0; i < 20; i++) {
      addSpectator(room, `spec_${i}`, `viewer_${i}`);
    }
    const result = addSpectator(room, 'spec_overflow', 'overflow');
    expect(result).toEqual({ error: 'Spectator limit reached' });
    // cleanup
    for (let i = 0; i < 20; i++) removeSpectator(`spec_${i}`);
    deleteRoom(room.id);
  });
});

describe('buildSpectatorState', () => {
  it('returns fog-of-war for both boards', () => {
    const room = createPlayingRoom();
    const state = buildSpectatorState(room);
    expect(state).not.toBeNull();
    for (const board of [state!.board1, state!.board2]) {
      for (const row of board.cells) {
        for (const cell of row) {
          expect(cell).not.toBe('ship');
        }
      }
    }
    deleteRoom(room.id);
  });
});

describe('listSpectatableRooms', () => {
  it('returns only active non-private games in playing phase', () => {
    const room = createPlayingRoom();
    const privateRoom = createRoom(makePlayer('pp1'), false, true);
    joinRoom(privateRoom, makePlayer('pp2'));
    placeShips(privateRoom, 'pp1', STANDARD_PLACEMENTS);
    placeShips(privateRoom, 'pp2', STANDARD_PLACEMENTS);

    const list = listSpectatableRooms();
    const ids = list.map((r) => r.roomId);
    expect(ids).toContain(room.id);
    expect(ids).not.toContain(privateRoom.id);

    deleteRoom(room.id);
    deleteRoom(privateRoom.id);
  });
});

describe('trackAbilityUsed', () => {
  it('increments usage count', () => {
    const room = createPlayingRoom();
    trackAbilityUsed(room, 'p1', 'sonar_ping');
    trackAbilityUsed(room, 'p1', 'sonar_ping');
    trackAbilityUsed(room, 'p1', 'cannon_barrage');
    expect(room.abilitiesUsed['p1']['sonar_ping']).toBe(2);
    expect(room.abilitiesUsed['p1']['cannon_barrage']).toBe(1);
    deleteRoom(room.id);
  });
});

describe('rematch', () => {
  it('rematchRequests starts empty on room creation', () => {
    const room = createRoom(makePlayer('p1'), false, false);
    expect(room.rematchRequests).toBeInstanceOf(Set);
    expect(room.rematchRequests.size).toBe(0);
    deleteRoom(room.id);
  });

  it('can track a single player requesting rematch', () => {
    const room = createFullRoom();
    room.rematchRequests.add('p1');
    expect(room.rematchRequests.has('p1')).toBe(true);
    expect(room.rematchRequests.has('p2')).toBe(false);
    deleteRoom(room.id);
  });

  it('detects when both players have requested rematch', () => {
    const room = createFullRoom();
    room.rematchRequests.add('p1');
    room.rematchRequests.add('p2');
    const bothReady =
      room.players[0] !== null &&
      room.players[1] !== null &&
      room.rematchRequests.has(room.players[0]!.id) &&
      room.rematchRequests.has(room.players[1]!.id);
    expect(bothReady).toBe(true);
    deleteRoom(room.id);
  });

  it('does not treat one request as both ready', () => {
    const room = createFullRoom();
    room.rematchRequests.add('p1');
    const bothReady =
      room.players[0] !== null &&
      room.players[1] !== null &&
      room.rematchRequests.has(room.players[0]!.id) &&
      room.rematchRequests.has(room.players[1]!.id);
    expect(bothReady).toBe(false);
    deleteRoom(room.id);
  });

  it('rematchRequests resets when room is deleted and recreated', () => {
    const room = createFullRoom();
    room.rematchRequests.add('p1');
    room.rematchRequests.add('p2');
    expect(room.rematchRequests.size).toBe(2);
    deleteRoom(room.id);

    // A new room should have empty rematchRequests
    const newRoom = createRoom(makePlayer('p1'), false, false);
    expect(newRoom.rematchRequests.size).toBe(0);
    deleteRoom(newRoom.id);
  });
});
