/**
 * Socket.IO connection handler. Wires up matchmaking, room management,
 * game actions, and chat for the multiplayer experience.
 */

import type { Server, Socket } from 'socket.io';
import { verifyToken } from '../middleware/auth.js';
import {
  createRoom,
  joinRoom,
  getRoom,
  getRoomBySocket,
  getRoomByCode,
  placeShips,
  fireShot,
  useAbility,
  resignPlayer,
  addChatMessage,
  buildPublicState,
  handleDisconnect,
  deleteRoom,
  trackAbilityUsed,
  serializeShip,
  addSpectator,
  removeSpectator,
  getSpectatingRoom,
  buildSpectatorState,
  listSpectatableRooms,
  type RoomPlayer,
} from '../services/rooms.js';
import {
  joinQueue,
  leaveQueue,
  leaveQueueBySocket,
  tryMatch,
  removeBoth,
  queueSize,
  type QueueEntry,
} from '../services/matchmaking.js';
import { persistMatch } from '../services/persistence.js';
import { prisma } from '../services/db.js';
import { GamePhase, ShotResult } from '../../../shared/src/types.ts';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../../shared/src/sockets.ts';

interface SocketData {
  userId: string;
  username: string;
  rating: number;
  isGuest: boolean;
}

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const lastChatTimestamps = new Map<string, number[]>();

function rateLimitChat(playerId: string): boolean {
  const now = Date.now();
  const history = lastChatTimestamps.get(playerId) ?? [];
  // Keep only timestamps from the last 10 seconds
  const recent = history.filter((t) => now - t < 10000);
  if (recent.length >= 5) {
    lastChatTimestamps.set(playerId, recent);
    return false;
  }
  recent.push(now);
  lastChatTimestamps.set(playerId, recent);
  return true;
}

export function setupGameSocket(io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>): void {
  // Auth middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const guestName = socket.handshake.auth?.guestName as string | undefined;

    if (token) {
      try {
        const payload = verifyToken(token);
        // Try to fetch user details (rating, username) — fall back to defaults if DB unavailable
        let username = payload.email.split('@')[0];
        let rating = 1200;
        try {
          const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            include: { stats: true },
          });
          if (user) {
            username = user.username;
            rating = user.stats?.rating ?? 1200;
          }
        } catch {
          // DB unavailable, use defaults
        }
        socket.data = {
          userId: payload.userId,
          username,
          rating,
          isGuest: false,
        };
        return next();
      } catch {
        return next(new Error('Invalid auth token'));
      }
    }

    // Guest connection
    socket.data = {
      userId: 'guest_' + Math.random().toString(36).slice(2, 10),
      username: guestName || 'Guest_' + Math.random().toString(36).slice(2, 6),
      rating: 1200,
      isGuest: true,
    };
    next();
  });

  io.on('connection', (socket: GameSocket) => {
    console.log(`[socket] connected ${socket.data.username} (${socket.id})`);

    // === MATCHMAKING ===

    socket.on('mm:join', ({ selectedAbilities }) => {
      const entry: QueueEntry = {
        playerId: socket.data.userId,
        username: socket.data.username,
        rating: socket.data.rating,
        socketId: socket.id,
        joinedAt: Date.now(),
        selectedAbilities,
      };
      joinQueue(entry);

      // Try to match immediately
      const opponent = tryMatch(entry);
      if (opponent) {
        removeBoth(entry.playerId, opponent.playerId);
        startMatch(io, entry, opponent, /* isRanked */ !entry.playerId.startsWith('guest_') && !opponent.playerId.startsWith('guest_'), false);
      } else {
        socket.emit('mm:waiting', { queueSize: queueSize(), elapsed: 0 });
      }
    });

    socket.on('mm:leave', () => {
      leaveQueue(socket.data.userId);
      socket.emit('mm:cancelled');
    });

    // === PRIVATE ROOMS ===

    socket.on('room:create', ({ selectedAbilities }, ack) => {
      const player: Omit<RoomPlayer, 'abilities' | 'traits' | 'hasPlaced' | 'isConnected'> = {
        id: socket.data.userId,
        username: socket.data.username,
        rating: socket.data.rating,
        socketId: socket.id,
        selectedAbilities,
      };
      const room = createRoom(player, false, true);
      socket.join(room.id);
      ack({ code: room.code! });
      socket.emit('room:created', { code: room.code!, roomId: room.id });
    });

    socket.on('room:join', ({ code, selectedAbilities }, ack) => {
      const room = getRoomByCode(code);
      if (!room) {
        ack({ error: 'Room not found' });
        return;
      }
      if (room.players[1]) {
        ack({ error: 'Room is full' });
        return;
      }
      const player: Omit<RoomPlayer, 'abilities' | 'traits' | 'hasPlaced' | 'isConnected'> = {
        id: socket.data.userId,
        username: socket.data.username,
        rating: socket.data.rating,
        socketId: socket.id,
        selectedAbilities,
      };
      joinRoom(room, player);
      socket.join(room.id);
      ack({ ok: true });
      // Notify host
      const hostSocketId = room.players[0]?.socketId;
      if (hostSocketId) {
        io.to(hostSocketId).emit('room:opponent_joined', {
          opponent: {
            id: player.id,
            username: player.username,
            rating: player.rating,
            isReady: false,
          },
        });
      }
      // Send game state to both
      sendStateToBoth(io, room.id);
    });

    // === GAME ACTIONS ===

    socket.on('game:place', ({ placements }) => {
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      const ok = placeShips(room, socket.data.userId, placements);
      if (!ok) {
        socket.emit('error', { code: 'PLACE_FAILED', message: 'Invalid ship placement' });
        return;
      }
      sendStateToBoth(io, room.id);
    });

    socket.on('game:fire', ({ coord }) => {
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      const outcome = fireShot(room, socket.data.userId, coord);
      if (!outcome) {
        socket.emit('error', { code: 'FIRE_FAILED', message: 'Cannot fire here' });
        return;
      }
      // Notify the OPPONENT of the action (so they can play their animation)
      const opponentSocketId = room.players.find((p) => p && p.id !== socket.data.userId)?.socketId;
      if (opponentSocketId) {
        io.to(opponentSocketId).emit('game:opponent_action', {
          kind: 'fire',
          coord,
          outcome,
        });
      }
      sendStateToBoth(io, room.id);
      checkGameEnd(io, room.id);
    });

    socket.on('game:ability', ({ ability, coord }) => {
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      const result = useAbility(room, socket.data.userId, ability, coord);
      if (!result.ok) {
        socket.emit('error', { code: 'ABILITY_FAILED', message: 'Cannot use ability' });
        return;
      }
      trackAbilityUsed(room, socket.data.userId, ability);
      const opponentSocketId = room.players.find((p) => p && p.id !== socket.data.userId)?.socketId;
      if (opponentSocketId) {
        io.to(opponentSocketId).emit('game:opponent_action', {
          kind: 'ability',
          coord,
          outcome: { result: ShotResult.Miss, coordinate: coord },
        });
      }
      sendStateToBoth(io, room.id);
      checkGameEnd(io, room.id);
    });

    socket.on('game:resign', () => {
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      resignPlayer(room, socket.data.userId);
      sendStateToBoth(io, room.id);
      checkGameEnd(io, room.id);
    });

    // === CHAT ===

    socket.on('chat:message', ({ text }) => {
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      if (!rateLimitChat(socket.data.userId)) {
        socket.emit('error', { code: 'CHAT_RATE_LIMIT', message: 'Slow down, captain!' });
        return;
      }
      const trimmed = text.trim().slice(0, 200);
      if (!trimmed) return;
      const message = addChatMessage(room, socket.data.userId, trimmed);
      if (!message) return;
      io.to(room.id).emit('chat:message', message);
    });

    // === REMATCH ===

    socket.on('game:rematch_request', () => {
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      room.rematchRequests.add(socket.data.userId);
      const opponentSocketId = room.players.find((p) => p && p.id !== socket.data.userId)?.socketId;
      if (opponentSocketId) {
        io.to(opponentSocketId).emit('game:rematch_pending', { from: 'opponent' });
      }
      // If both requested, start a new game
      if (room.players[0] && room.players[1] && room.rematchRequests.has(room.players[0].id) && room.rematchRequests.has(room.players[1].id)) {
        startRematch(io, room.id);
      }
    });

    // === SPECTATOR ===

    socket.on('spectator:join', ({ roomId }, ack) => {
      const room = getRoom(roomId);
      if (!room) return ack({ error: 'Match not found' });
      if (room.engine.phase === GamePhase.Finished) return ack({ error: 'Match already ended' });
      const result = addSpectator(room, socket.id, socket.data.username ?? 'Spectator');
      if ('error' in result) return ack(result);
      socket.join(`${roomId}:spectators`);
      ack({ ok: true });
      const state = buildSpectatorState(room);
      if (state) socket.emit('spectator:state', state);
      io.to(`${roomId}:spectators`).emit('spectator:count', { count: room.spectators.size });
    });

    socket.on('spectator:leave', () => {
      const room = getSpectatingRoom(socket.id);
      if (!room) return;
      socket.leave(`${room.id}:spectators`);
      removeSpectator(socket.id);
      io.to(`${room.id}:spectators`).emit('spectator:count', { count: room.spectators.size });
    });

    socket.on('spectator:chat', ({ text }) => {
      const room = getSpectatingRoom(socket.id);
      if (!room) return;
      if (text.length > 200) return;
      const msg = {
        id: Math.random().toString(36).slice(2),
        username: socket.data.username ?? 'Spectator',
        text,
        timestamp: Date.now(),
      };
      room.spectatorChat.push(msg);
      if (room.spectatorChat.length > 100) room.spectatorChat.shift();
      io.to(`${room.id}:spectators`).emit('spectator:chat', msg);
    });

    socket.on('spectator:list', (ack) => {
      ack(listSpectatableRooms());
    });

    // === DISCONNECT ===

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected ${socket.data.username}`);
      leaveQueueBySocket(socket.id);
      removeSpectator(socket.id); // Clean up if they were spectating
      const room = handleDisconnect(socket.id);
      if (room) {
        const opponentSocketId = room.players.find((p) => p && p.socketId !== socket.id)?.socketId;
        if (opponentSocketId) {
          io.to(opponentSocketId).emit('game:opponent_disconnected', { secondsRemaining: 60 });
        }
        // Schedule forfeit if not reconnected within 60s
        setTimeout(() => {
          const stillRoom = getRoom(room.id);
          if (!stillRoom) return;
          const player = stillRoom.players.find((p) => p && p.socketId === socket.id);
          if (player && !player.isConnected && stillRoom.engine.phase !== GamePhase.Finished) {
            // Forfeit
            resignPlayer(stillRoom, player.id);
            checkGameEnd(io, stillRoom.id);
          }
        }, 60000);
      }
    });
  });
}

function sendStateToBoth(io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>, roomId: string): void {
  const room = getRoom(roomId);
  if (!room) return;
  for (const player of room.players) {
    if (!player) continue;
    const state = buildPublicState(room, player.id);
    if (state) io.to(player.socketId).emit('game:state', state);
  }
  // Also update spectators
  if (room.spectators.size > 0) {
    const specState = buildSpectatorState(room);
    if (specState) io.to(`${roomId}:spectators`).emit('spectator:state', specState);
  }
}

async function checkGameEnd(io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>, roomId: string): Promise<void> {
  const room = getRoom(roomId);
  if (!room) return;
  if (room.engine.phase !== GamePhase.Finished) return;
  if (!room.players[0] || !room.players[1]) return;

  // CRITICAL: sync the final game state to both clients so their local
  // engines transition to Finished phase. Without this, GameOverScreen
  // never appears (it gates on engine.phase === Finished).
  sendStateToBoth(io, roomId);

  const winnerId = room.engine.winner === 'player' ? room.players[0].id : room.players[1].id;
  const startedAt = room.startedAt ?? room.createdAt;
  const durationMs = (room.endedAt ?? Date.now()) - startedAt;

  // Persist (graceful fallback)
  const persistResult = await persistMatch({
    player1Id: room.players[0].id,
    player2Id: room.players[1].id,
    winnerId,
    isRanked: room.isRanked,
    turns: room.engine.turnCount,
    durationMs,
    p1Accuracy: room.engine.playerShotCount > 0
      ? room.engine.opponentBoard.ships.reduce((s, ship) => s + ship.hits.size, 0) / room.engine.playerShotCount
      : 0,
    p2Accuracy: room.engine.opponentShotCount > 0
      ? room.engine.playerBoard.ships.reduce((s, ship) => s + ship.hits.size, 0) / room.engine.opponentShotCount
      : 0,
    p1ShipsSunk: room.engine.opponentBoard.ships.filter((s) => s.hits.size === s.cells.length).length,
    p2ShipsSunk: room.engine.playerBoard.ships.filter((s) => s.hits.size === s.cells.length).length,
  });

  // Compute per-player accuracy
  const p1Acc = room.engine.playerShotCount > 0
    ? room.engine.opponentBoard.ships.reduce((s, ship) => s + ship.hits.size, 0) / room.engine.playerShotCount
    : 0;
  const p2Acc = room.engine.opponentShotCount > 0
    ? room.engine.playerBoard.ships.reduce((s, ship) => s + ship.hits.size, 0) / room.engine.opponentShotCount
    : 0;

  // Send match summary to both
  for (let i = 0; i < 2; i++) {
    const player = room.players[i];
    if (!player) continue;
    const isP1 = i === 0;
    io.to(player.socketId).emit('game:end', {
      winnerId,
      turns: room.engine.turnCount,
      durationMs,
      selfAccuracy: isP1 ? p1Acc : p2Acc,
      opponentAccuracy: isP1 ? p2Acc : p1Acc,
      selfShipsSunk: isP1
        ? room.engine.opponentBoard.ships.filter((s) => s.hits.size === s.cells.length).length
        : room.engine.playerBoard.ships.filter((s) => s.hits.size === s.cells.length).length,
      opponentShipsSunk: isP1
        ? room.engine.playerBoard.ships.filter((s) => s.hits.size === s.cells.length).length
        : room.engine.opponentBoard.ships.filter((s) => s.hits.size === s.cells.length).length,
      ratingDelta: persistResult?.ratingDelta ? (isP1 ? persistResult.ratingDelta.p1 : persistResult.ratingDelta.p2) : undefined,
      opponentShips: (isP1 ? room.engine.opponentBoard : room.engine.playerBoard).ships.map(serializeShip),
      abilitiesUsed: room.abilitiesUsed[player.id] ?? {},
      matchId: persistResult?.matchId,
    });
  }

  // Notify spectators
  if (room.spectators.size > 0) {
    io.to(`${room.id}:spectators`).emit('spectator:ended', { winnerId });
  }
}

function startMatch(
  io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>,
  p1: QueueEntry,
  p2: QueueEntry,
  isRanked: boolean,
  isPrivate: boolean
): void {
  const player1: Omit<RoomPlayer, 'abilities' | 'traits' | 'hasPlaced' | 'isConnected'> = {
    id: p1.playerId,
    username: p1.username,
    rating: p1.rating,
    socketId: p1.socketId,
    selectedAbilities: p1.selectedAbilities,
  };
  const room = createRoom(player1, isRanked, isPrivate);
  const player2: Omit<RoomPlayer, 'abilities' | 'traits' | 'hasPlaced' | 'isConnected'> = {
    id: p2.playerId,
    username: p2.username,
    rating: p2.rating,
    socketId: p2.socketId,
    selectedAbilities: p2.selectedAbilities,
  };
  joinRoom(room, player2);

  // Notify both players
  io.to(p1.socketId).socketsJoin(room.id);
  io.to(p2.socketId).socketsJoin(room.id);

  io.to(p1.socketId).emit('mm:matched', {
    roomId: room.id,
    opponent: { id: p2.playerId, username: p2.username, rating: p2.rating, isReady: false },
    isRanked,
  });
  io.to(p2.socketId).emit('mm:matched', {
    roomId: room.id,
    opponent: { id: p1.playerId, username: p1.username, rating: p1.rating, isReady: false },
    isRanked,
  });

  sendStateToBoth(io, room.id);
}

function startRematch(io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>, oldRoomId: string): void {
  const oldRoom = getRoom(oldRoomId);
  if (!oldRoom || !oldRoom.players[0] || !oldRoom.players[1]) return;

  const p1 = oldRoom.players[0];
  const p2 = oldRoom.players[1];

  const entry1: QueueEntry = {
    playerId: p1.id,
    username: p1.username,
    rating: p1.rating,
    socketId: p1.socketId,
    joinedAt: Date.now(),
    selectedAbilities: p1.selectedAbilities,
  };
  const entry2: QueueEntry = {
    playerId: p2.id,
    username: p2.username,
    rating: p2.rating,
    socketId: p2.socketId,
    joinedAt: Date.now(),
    selectedAbilities: p2.selectedAbilities,
  };
  // Clean up old room
  deleteRoom(oldRoomId);
  startMatch(io, entry1, entry2, oldRoom.isRanked, oldRoom.isPrivate);
}
