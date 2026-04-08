/**
 * Replay event schema — compact event log for replaying matches.
 * Stored in Match.events JSON column.
 */

import type { Coordinate, ShipPlacement, ShotOutcome } from './types';
import type { AbilityType } from './abilities';

export type ReplaySide = 'p1' | 'p2';

export type ReplayEvent =
  | { t: number; kind: 'placement'; side: ReplaySide; placements: ShipPlacement[] }
  | { t: number; kind: 'fire'; side: ReplaySide; coord: Coordinate; outcome: ShotOutcome }
  | { t: number; kind: 'ability'; side: ReplaySide; ability: AbilityType; coord: Coordinate }
  | { t: number; kind: 'turn'; turn: number }
  | { t: number; kind: 'end'; winnerSide: ReplaySide };

export interface ReplayPlayerRef {
  id: string;
  username: string;
}

export interface ReplayData {
  version: 1;
  matchId: string;
  p1: ReplayPlayerRef;
  p2: ReplayPlayerRef;
  mode: string;
  startedAt: number;
  events: ReplayEvent[];
}

/** Max events stored per match (safety cap for abnormally long games). */
export const MAX_REPLAY_EVENTS = 500;
