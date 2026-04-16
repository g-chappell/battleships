/**
 * Socket.IO event protocol shared between client and server.
 * All multiplayer messages flow through these typed events.
 */

import type { Coordinate, ShipPlacement, ShotOutcome, ShipType } from './types';
import type { AbilityType } from './abilities';

// === Public state shapes (sent over the wire) ===

export interface PlayerView {
  id: string;
  username: string;
  rating: number;
  isReady: boolean;
}

export interface SerializedShip {
  type: ShipType;
  cells: Coordinate[];
  hits: string[]; // serialized "row,col" keys
}

export interface PublicBoardView {
  // What the OPPONENT sees of the player's board:
  // - hit/miss cells revealed
  // - ship cells masked as empty
  width: number;
  height: number;
  cells: Array<Array<'empty' | 'hit' | 'miss' | 'land_revealed'>>;
  sunkShips: SerializedShip[]; // sunk ships are revealed
}

export interface OwnBoardView {
  // What the PLAYER sees of their own board (full info)
  width: number;
  height: number;
  cells: Array<Array<'empty' | 'ship' | 'hit' | 'miss' | 'land' | 'land_revealed'>>;
  ships: SerializedShip[];
}

export interface AbilityStateView {
  type: AbilityType;
  cooldownRemaining: number;
  usesRemaining: number; // -1 = unlimited
}

export interface PublicGameState {
  roomId: string;
  phase: 'placement' | 'playing' | 'finished';
  currentTurn: 'self' | 'opponent';
  turnCount: number;
  winner: 'self' | 'opponent' | null;
  ownBoard: OwnBoardView;
  opponentBoard: PublicBoardView;
  ownAbilities: AbilityStateView[];
  opponentAbilitiesSummary: { type: AbilityType; cooldownRemaining: number }[];
  opponent: PlayerView;
  isRanked: boolean;
  // Kraken summoning ritual state — non-null when either side is mid-ritual.
  // Clients use this to render the RitualOverlay banner.
  ownRitualTurnsRemaining: number | null;
  opponentRitualTurnsRemaining: number | null;
}

export interface ChatMessage {
  id: string;
  fromId: string;
  fromUsername: string;
  text: string;
  timestamp: number;
}

export interface MatchSummary {
  winnerId: string;
  turns: number;
  durationMs: number;
  selfAccuracy: number;
  opponentAccuracy: number;
  selfShipsSunk: number;
  opponentShipsSunk: number;
  ratingDelta?: number; // only for ranked matches
  opponentShips?: SerializedShip[]; // full board reveal post-game
  abilitiesUsed?: Record<string, number>; // ability type → usage count
  matchId?: string; // for replay link
}

// === Spectator types ===

export interface SpectatorGameState {
  roomId: string;
  phase: 'placement' | 'playing' | 'finished';
  currentTurn: 'player1' | 'player2';
  turnCount: number;
  winner: 'player1' | 'player2' | null;
  player1: { username: string; rating: number };
  player2: { username: string; rating: number };
  // Fog-of-war: spectators see both boards as opponent-view (hits/misses/sinks only)
  board1: PublicBoardView;
  board2: PublicBoardView;
  spectatorCount: number;
}

export interface SpectatorChatMessage {
  id: string;
  username: string;
  text: string;
  timestamp: number;
}

export interface SpectatableRoom {
  roomId: string;
  player1: string;
  player2: string;
  turnCount: number;
  spectatorCount: number;
}

// === Client → Server events ===

export interface ClientToServerEvents {
  // Matchmaking
  'mm:join': (payload: { selectedAbilities: AbilityType[] }) => void;
  'mm:leave': () => void;

  // Private rooms
  'room:create': (payload: { selectedAbilities: AbilityType[] }, ack: (res: { code: string } | { error: string }) => void) => void;
  'room:join': (payload: { code: string; selectedAbilities: AbilityType[] }, ack: (res: { ok: true } | { error: string }) => void) => void;

  // Game actions
  'game:place': (payload: { placements: ShipPlacement[] }) => void;
  'game:fire': (payload: { coord: Coordinate }) => void;
  'game:ability': (payload: { ability: AbilityType; coord: Coordinate }) => void;
  'game:resign': () => void;
  'game:rematch_request': () => void;

  // Chat
  'chat:message': (payload: { text: string }) => void;

  // Tournaments
  'tournament:subscribe': (payload: { tournamentId: string }) => void;
  'tournament:unsubscribe': (payload: { tournamentId: string }) => void;

  // Clan chat
  'clan:chat:send': (payload: { text: string }) => void;

  // Spectator
  'spectator:join': (payload: { roomId: string }, ack: (res: { ok: true } | { error: string }) => void) => void;
  'spectator:leave': () => void;
  'spectator:chat': (payload: { text: string }) => void;
  'spectator:list': (ack: (rooms: SpectatableRoom[]) => void) => void;
}

// === Server → Client events ===

export interface ServerToClientEvents {
  // Matchmaking
  'mm:waiting': (payload: { queueSize: number; elapsed: number }) => void;
  'mm:matched': (payload: { roomId: string; opponent: PlayerView; isRanked: boolean }) => void;
  'mm:cancelled': () => void;

  // Private room
  'room:created': (payload: { code: string; roomId: string }) => void;
  'room:opponent_joined': (payload: { opponent: PlayerView }) => void;

  // Game state
  'game:state': (payload: PublicGameState) => void;
  'game:opponent_action': (payload: { kind: 'fire' | 'ability'; coord: Coordinate; outcome: ShotOutcome }) => void;
  'game:end': (payload: MatchSummary) => void;
  'game:opponent_disconnected': (payload: { secondsRemaining: number }) => void;
  'game:opponent_reconnected': () => void;
  'game:rematch_pending': (payload: { from: 'self' | 'opponent' }) => void;
  // Trait-specific events (clients replay/animate)
  'game:depth_charge': (payload: {
    side: 'self' | 'opponent';           // who triggered the retaliation
    triggeringShip: ShipType;             // which Destroyer fired
    shots: ShotOutcome[];                 // the 6 retaliatory outcomes on the attacker's board
  }) => void;
  'game:kraken_strike': (payload: {
    caster: 'self' | 'opponent';
    sunkShipType: ShipType | null;        // null when the ritual was wasted (Kraken Ward blocked)
    cells: Coordinate[];                  // cells of the sunk ship, for animation targets
  }) => void;

  // Chat
  'chat:message': (payload: ChatMessage) => void;

  // Tournaments
  'tournament:update': (payload: { tournamentId: string }) => void;
  'tournament:match_ready': (payload: { roomId: string; tournamentId: string; opponent: PlayerView }) => void;

  // Clan chat
  'clan:chat:message': (payload: { id: string; clanId: string; userId: string; username: string; text: string; createdAt: string }) => void;

  // Gold awards (shown as a toast)
  'gold:awarded': (payload: { amount: number; reason: string; newBalance: number }) => void;

  // Spectator
  'spectator:state': (payload: SpectatorGameState) => void;
  'spectator:chat': (payload: SpectatorChatMessage) => void;
  'spectator:count': (payload: { count: number }) => void;
  'spectator:ended': (payload: { winnerId: string }) => void;

  // Errors
  'error': (payload: { code: string; message: string }) => void;
}
