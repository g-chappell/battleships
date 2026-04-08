/**
 * Standard ELO rating calculation.
 * K-factor = 32 (responsive to recent results).
 */

const K_FACTOR = 32;

export function expectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

/**
 * Returns the rating delta for the player given the result.
 * @param result 1 = win, 0.5 = draw, 0 = loss
 */
export function calculateDelta(
  playerRating: number,
  opponentRating: number,
  result: 0 | 0.5 | 1
): number {
  const expected = expectedScore(playerRating, opponentRating);
  return Math.round(K_FACTOR * (result - expected));
}

export function applyMatchResult(
  winnerRating: number,
  loserRating: number
): { winnerNew: number; loserNew: number; winnerDelta: number; loserDelta: number } {
  const winnerDelta = calculateDelta(winnerRating, loserRating, 1);
  const loserDelta = calculateDelta(loserRating, winnerRating, 0);
  return {
    winnerNew: Math.max(100, winnerRating + winnerDelta),
    loserNew: Math.max(100, loserRating + loserDelta),
    winnerDelta,
    loserDelta,
  };
}
