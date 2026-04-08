/**
 * Tournament types + bracket helpers for single-elimination brackets.
 */

export type TournamentStatus = 'lobby' | 'active' | 'finished' | 'cancelled';
export type TournamentMatchStatus = 'pending' | 'ready' | 'in_progress' | 'done';

export const VALID_TOURNAMENT_SIZES = [4, 8, 16] as const;
export type TournamentSize = (typeof VALID_TOURNAMENT_SIZES)[number];

export interface TournamentSummary {
  id: string;
  name: string;
  status: TournamentStatus;
  maxPlayers: number;
  playerCount: number;
  createdBy: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  winnerId?: string;
}

export interface TournamentBracketMatch {
  id: string;
  round: number;
  bracketIdx: number;
  p1UserId: string | null;
  p2UserId: string | null;
  p1Username?: string;
  p2Username?: string;
  winnerUserId: string | null;
  status: TournamentMatchStatus;
  matchId?: string;
}

export interface TournamentDetail extends TournamentSummary {
  entries: { userId: string; username: string; seed: number; eliminated: boolean }[];
  matches: TournamentBracketMatch[];
}

/**
 * Given seeded players (in rating order), return bracket round-0 pairings.
 * Standard seeding: 1 vs N, 2 vs N-1, ... for tight brackets.
 * Assumes `ids.length` is a power of 2.
 */
export function seedPairings(ids: string[]): Array<[string, string]> {
  if (ids.length < 2 || (ids.length & (ids.length - 1)) !== 0) {
    throw new Error(`Tournament size must be a power of 2; got ${ids.length}`);
  }
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < ids.length / 2; i++) {
    pairs.push([ids[i], ids[ids.length - 1 - i]]);
  }
  return pairs;
}

/**
 * Given a match at (round, bracketIdx), compute the next round's
 * bracketIdx and which "side" (p1 or p2 slot) the winner goes into.
 */
export function nextBracketSlot(bracketIdx: number): { nextBracketIdx: number; slot: 'p1' | 'p2' } {
  return {
    nextBracketIdx: Math.floor(bracketIdx / 2),
    slot: bracketIdx % 2 === 0 ? 'p1' : 'p2',
  };
}

export function totalRounds(size: number): number {
  return Math.log2(size);
}

export function isFinalRound(size: number, round: number): boolean {
  return round === totalRounds(size) - 1;
}
