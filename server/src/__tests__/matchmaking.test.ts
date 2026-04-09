import { describe, it, expect, beforeEach } from 'vitest';
import {
  joinQueue,
  leaveQueue,
  tryMatch,
  queueSize,
  removeBoth,
  type QueueEntry,
} from '../services/matchmaking.ts';

function makeEntry(id: string, rating = 1500, joinedAt = Date.now()): QueueEntry {
  return {
    playerId: id,
    username: `user_${id}`,
    rating,
    socketId: `socket_${id}`,
    joinedAt,
    selectedAbilities: [],
  };
}

// The matchmaking module uses a module-level array, so we need to drain it
// between tests to avoid state leaking.
function drainQueue() {
  // Remove known entries by leaving a lot of IDs
  for (let i = 0; i < 50; i++) {
    leaveQueue(`p${i}`);
    leaveQueue(`${i}`);
  }
  leaveQueue('a');
  leaveQueue('b');
  leaveQueue('c');
  leaveQueue('far');
  leaveQueue('self');
}

describe('matchmaking queue', () => {
  beforeEach(() => {
    drainQueue();
  });

  it('joinQueue adds an entry and queueSize reflects it', () => {
    expect(queueSize()).toBe(0);
    joinQueue(makeEntry('a'));
    expect(queueSize()).toBe(1);
    joinQueue(makeEntry('b'));
    expect(queueSize()).toBe(2);
  });

  it('joinQueue replaces duplicate player entries', () => {
    joinQueue(makeEntry('a', 1500));
    joinQueue(makeEntry('a', 1600));
    expect(queueSize()).toBe(1);
  });

  it('leaveQueue removes an entry', () => {
    joinQueue(makeEntry('a'));
    joinQueue(makeEntry('b'));
    leaveQueue('a');
    expect(queueSize()).toBe(1);
  });

  it('leaveQueue is a no-op for unknown player', () => {
    joinQueue(makeEntry('a'));
    leaveQueue('nonexistent');
    expect(queueSize()).toBe(1);
  });

  it('tryMatch pairs two players within rating window', () => {
    const a = makeEntry('a', 1500);
    const b = makeEntry('b', 1550);
    joinQueue(a);
    joinQueue(b);
    const matched = tryMatch(a);
    expect(matched).not.toBeNull();
    expect(matched!.playerId).toBe('b');
  });

  it('tryMatch does not self-match', () => {
    const a = makeEntry('a', 1500);
    joinQueue(a);
    const matched = tryMatch(a);
    expect(matched).toBeNull();
  });

  it('tryMatch returns null when no one is in window', () => {
    const a = makeEntry('a', 1000);
    const far = makeEntry('far', 2000);
    joinQueue(a);
    joinQueue(far);
    const matched = tryMatch(a);
    expect(matched).toBeNull();
  });

  it('removeBoth removes both players from queue', () => {
    joinQueue(makeEntry('a'));
    joinQueue(makeEntry('b'));
    joinQueue(makeEntry('c'));
    removeBoth('a', 'b');
    expect(queueSize()).toBe(1);
  });
});
