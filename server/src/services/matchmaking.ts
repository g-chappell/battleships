/**
 * In-memory matchmaking queue with rating-window expansion.
 */

import type { AbilityType } from '../../../shared/src/abilities.ts';

export interface QueueEntry {
  playerId: string;
  username: string;
  rating: number;
  socketId: string;
  joinedAt: number;
  selectedAbilities: AbilityType[];
}

const queue: QueueEntry[] = [];

export function joinQueue(entry: QueueEntry): void {
  // Remove any existing entry for this player
  leaveQueue(entry.playerId);
  queue.push(entry);
}

export function leaveQueue(playerId: string): void {
  const idx = queue.findIndex((e) => e.playerId === playerId);
  if (idx >= 0) queue.splice(idx, 1);
}

export function leaveQueueBySocket(socketId: string): void {
  const idx = queue.findIndex((e) => e.socketId === socketId);
  if (idx >= 0) queue.splice(idx, 1);
}

export function queueSize(): number {
  return queue.length;
}

export function getQueueEntry(playerId: string): QueueEntry | undefined {
  return queue.find((e) => e.playerId === playerId);
}

/**
 * Try to match the given player with another in the queue.
 * Returns the matched opponent or null.
 */
export function tryMatch(player: QueueEntry): QueueEntry | null {
  const now = Date.now();
  // Rating window expands over time: ±200 base + 100 per 5 seconds elapsed
  const elapsed = (now - player.joinedAt) / 1000;
  const window = 200 + Math.floor(elapsed / 5) * 100;

  // Find the closest opponent within the window (excluding self)
  let best: QueueEntry | null = null;
  let bestDelta = Infinity;
  for (const other of queue) {
    if (other.playerId === player.playerId) continue;
    const delta = Math.abs(other.rating - player.rating);
    // Other player's window must also accept this player
    const otherElapsed = (now - other.joinedAt) / 1000;
    const otherWindow = 200 + Math.floor(otherElapsed / 5) * 100;
    if (delta <= window && delta <= otherWindow && delta < bestDelta) {
      best = other;
      bestDelta = delta;
    }
  }
  return best;
}

export function removeBoth(playerId1: string, playerId2: string): void {
  leaveQueue(playerId1);
  leaveQueue(playerId2);
}
