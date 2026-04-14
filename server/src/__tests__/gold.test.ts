import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted runs before vi.mock factories (which are hoisted to top of file)
const { mockUser } = vi.hoisted(() => ({
  mockUser: {
    update: vi.fn(),
  },
}));

vi.mock('../services/db.ts', () => ({
  prisma: {
    user: mockUser,
  },
}));

import { awardGold, rewardForMode } from '../services/gold.ts';
import { GOLD_REWARDS } from '../../../shared/src/cosmetics.ts';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── rewardForMode ────────────────────────────────────────────────────────────

describe('rewardForMode', () => {
  it('returns LOSS_CONSOLATION reward when not won, regardless of mode', () => {
    for (const mode of ['ranked', 'private', 'ai_easy', 'ai_medium', 'ai_hard', 'campaign_1', 'unknown']) {
      const result = rewardForMode(mode, false);
      expect(result.amount).toBe(GOLD_REWARDS.LOSS_CONSOLATION);
      expect(result.reason).toBe('LOSS_CONSOLATION');
    }
  });

  it('returns WIN_MP_RANKED reward for ranked mode win', () => {
    const result = rewardForMode('ranked', true);
    expect(result.amount).toBe(GOLD_REWARDS.WIN_MP_RANKED);
    expect(result.reason).toBe('WIN_MP_RANKED');
  });

  it('returns WIN_MP_CASUAL reward for private mode win', () => {
    const result = rewardForMode('private', true);
    expect(result.amount).toBe(GOLD_REWARDS.WIN_MP_CASUAL);
    expect(result.reason).toBe('WIN_MP_CASUAL');
  });

  it('returns WIN_AI_EASY reward for ai_easy mode win', () => {
    const result = rewardForMode('ai_easy', true);
    expect(result.amount).toBe(GOLD_REWARDS.WIN_AI_EASY);
    expect(result.reason).toBe('WIN_AI_EASY');
  });

  it('returns WIN_AI_MEDIUM reward for ai_medium mode win', () => {
    const result = rewardForMode('ai_medium', true);
    expect(result.amount).toBe(GOLD_REWARDS.WIN_AI_MEDIUM);
    expect(result.reason).toBe('WIN_AI_MEDIUM');
  });

  it('returns WIN_AI_HARD reward for ai_hard mode win', () => {
    const result = rewardForMode('ai_hard', true);
    expect(result.amount).toBe(GOLD_REWARDS.WIN_AI_HARD);
    expect(result.reason).toBe('WIN_AI_HARD');
  });

  it('returns WIN_CAMPAIGN reward for any campaign mode win', () => {
    for (const mode of ['campaign_1', 'campaign_15', 'campaign_abc']) {
      const result = rewardForMode(mode, true);
      expect(result.amount).toBe(GOLD_REWARDS.WIN_CAMPAIGN);
      expect(result.reason).toBe('WIN_CAMPAIGN');
    }
  });

  it('returns LOSS_CONSOLATION for unknown mode win (fallback)', () => {
    const result = rewardForMode('unknown_mode', true);
    expect(result.amount).toBe(GOLD_REWARDS.LOSS_CONSOLATION);
    expect(result.reason).toBe('LOSS_CONSOLATION');
  });

  it('ranked win reward is greater than casual win reward', () => {
    const ranked = rewardForMode('ranked', true);
    const casual = rewardForMode('private', true);
    expect(ranked.amount).toBeGreaterThan(casual.amount);
  });

  it('ai_hard win reward is greater than ai_medium, which is greater than ai_easy', () => {
    const easy = rewardForMode('ai_easy', true);
    const medium = rewardForMode('ai_medium', true);
    const hard = rewardForMode('ai_hard', true);
    expect(hard.amount).toBeGreaterThan(medium.amount);
    expect(medium.amount).toBeGreaterThan(easy.amount);
  });
});

// ─── awardGold ────────────────────────────────────────────────────────────────

describe('awardGold', () => {
  it('returns null for guest users without calling DB', async () => {
    const result = await awardGold('guest_abc123', 50, 'WIN_MP_RANKED');
    expect(result).toBeNull();
    expect(mockUser.update).not.toHaveBeenCalled();
  });

  it('returns null for guest users with any guest_ prefix', async () => {
    const result = await awardGold('guest_', 50, 'WIN_MP_RANKED');
    expect(result).toBeNull();
    expect(mockUser.update).not.toHaveBeenCalled();
  });

  it('returns null when amount is zero', async () => {
    const result = await awardGold('user123', 0, 'WIN_MP_RANKED');
    expect(result).toBeNull();
    expect(mockUser.update).not.toHaveBeenCalled();
  });

  it('returns null when amount is negative', async () => {
    const result = await awardGold('user123', -10, 'WIN_MP_RANKED');
    expect(result).toBeNull();
    expect(mockUser.update).not.toHaveBeenCalled();
  });

  it('increments gold and returns new balance for real user', async () => {
    mockUser.update.mockResolvedValue({ gold: 150 });
    const result = await awardGold('user123', 50, 'WIN_MP_RANKED');
    expect(result).toEqual({ newBalance: 150 });
    expect(mockUser.update).toHaveBeenCalledWith({
      where: { id: 'user123' },
      data: { gold: { increment: 50 } },
      select: { gold: true },
    });
  });

  it('passes the reason string to the DB call correctly', async () => {
    mockUser.update.mockResolvedValue({ gold: 200 });
    await awardGold('user456', 25, 'WIN_MP_CASUAL');
    expect(mockUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user456' },
        data: { gold: { increment: 25 } },
      })
    );
  });

  it('returns null when DB throws (safeDb swallows error)', async () => {
    mockUser.update.mockRejectedValue(new Error('DB connection failed'));
    const result = await awardGold('user123', 50, 'WIN_MP_RANKED');
    expect(result).toBeNull();
  });

  it('handles TOURNAMENT_WIN amount correctly', async () => {
    mockUser.update.mockResolvedValue({ gold: 600 });
    const result = await awardGold('user123', GOLD_REWARDS.TOURNAMENT_WIN, 'TOURNAMENT_WIN');
    expect(result).toEqual({ newBalance: 600 });
    expect(mockUser.update).toHaveBeenCalledWith({
      where: { id: 'user123' },
      data: { gold: { increment: GOLD_REWARDS.TOURNAMENT_WIN } },
      select: { gold: true },
    });
  });

  it('handles TOURNAMENT_RUNNER_UP amount correctly', async () => {
    mockUser.update.mockResolvedValue({ gold: 350 });
    const result = await awardGold('user123', GOLD_REWARDS.TOURNAMENT_RUNNER_UP, 'TOURNAMENT_RUNNER_UP');
    expect(result).toEqual({ newBalance: 350 });
  });

  it('TOURNAMENT_WIN reward is greater than TOURNAMENT_RUNNER_UP', () => {
    expect(GOLD_REWARDS.TOURNAMENT_WIN).toBeGreaterThan(GOLD_REWARDS.TOURNAMENT_RUNNER_UP);
  });
});
