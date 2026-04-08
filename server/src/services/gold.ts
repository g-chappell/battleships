/**
 * Gold economy: award gold to users for wins.
 * Wrapped in safeDbCall so it no-ops gracefully if Postgres is unreachable.
 */

import { prisma } from './db.ts';
import type { GoldRewardReason } from '../../../shared/src/cosmetics.ts';
import { GOLD_REWARDS } from '../../../shared/src/cosmetics.ts';

let dbWarned = false;
async function safeDb<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (!dbWarned) {
      console.warn(`[gold] DB unreachable (${label}): ${(err as Error).message}`);
      dbWarned = true;
    }
    return null;
  }
}

export async function awardGold(
  userId: string,
  amount: number,
  reason: GoldRewardReason | string
): Promise<{ newBalance: number } | null> {
  if (userId.startsWith('guest_')) return null;
  if (amount <= 0) return null;
  return safeDb('awardGold', async () => {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { gold: { increment: amount } },
      select: { gold: true },
    });
    console.log(`[gold] +${amount} to ${userId} (${reason}) = ${user.gold}`);
    return { newBalance: user.gold };
  });
}

export function rewardForMode(mode: string, won: boolean): { amount: number; reason: GoldRewardReason } {
  if (!won) return { amount: GOLD_REWARDS.LOSS_CONSOLATION, reason: 'LOSS_CONSOLATION' };
  if (mode === 'ranked') return { amount: GOLD_REWARDS.WIN_MP_RANKED, reason: 'WIN_MP_RANKED' };
  if (mode === 'private') return { amount: GOLD_REWARDS.WIN_MP_CASUAL, reason: 'WIN_MP_CASUAL' };
  if (mode === 'ai_easy') return { amount: GOLD_REWARDS.WIN_AI_EASY, reason: 'WIN_AI_EASY' };
  if (mode === 'ai_medium') return { amount: GOLD_REWARDS.WIN_AI_MEDIUM, reason: 'WIN_AI_MEDIUM' };
  if (mode === 'ai_hard') return { amount: GOLD_REWARDS.WIN_AI_HARD, reason: 'WIN_AI_HARD' };
  if (mode.startsWith('campaign')) return { amount: GOLD_REWARDS.WIN_CAMPAIGN, reason: 'WIN_CAMPAIGN' };
  return { amount: GOLD_REWARDS.LOSS_CONSOLATION, reason: 'LOSS_CONSOLATION' };
}
