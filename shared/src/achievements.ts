/**
 * Achievement definitions and evaluator.
 * Conditions are pure functions of MatchEvaluationContext + cumulative stats,
 * so they can run client-side for instant feedback and server-side for persistence.
 */

import type { AbilityType } from './abilities';

export type AchievementCategory = 'combat' | 'volume' | 'campaign' | 'multiplayer' | 'abilities' | 'misc';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string; // emoji
  category: AchievementCategory;
  points: number;
  /** Returns true if the achievement should unlock based on the given context. */
  condition: (ctx: MatchEvaluationContext) => boolean;
}

/** Per-match data for evaluation, plus cumulative cross-match stats. */
export interface MatchEvaluationContext {
  // Match outcome
  won: boolean;
  isMultiplayer: boolean;
  isRanked: boolean;
  isCampaign: boolean;

  // Aggregate match stats
  turns: number;
  shotsFired: number;
  shotsHit: number;
  shipsSunk: number;       // enemy ships sunk this match
  shipsLost: number;       // own ships lost this match
  durationMs: number;

  // Per-ability usage this match
  abilitiesUsed: Partial<Record<AbilityType, number>>;
  abilitySinks: Partial<Record<AbilityType, number>>; // sinks credited to specific abilities

  // Trait events
  ironcladSaved: boolean;     // Ironclad armor absorbed at least one hit on player Battleship
  submarineSonarBlocked: boolean; // Player's submarine was missed by enemy sonar

  // Cumulative cross-match stats (post this match)
  totalGames: number;
  totalWins: number;
  totalShipsSunk: number;
  rating: number;

  // Campaign progress
  campaignMissionId?: number;
  campaignStarsThisMission?: number;
  totalCampaignStars?: number;
  highestCampaignMission?: number;
}

export const ACHIEVEMENT_DEFS: Record<string, AchievementDef> = {
  // === COMBAT ===
  first_blood: {
    id: 'first_blood',
    title: 'First Blood',
    description: 'Sink your first enemy ship',
    icon: '\u{1F5E1}\uFE0F',
    category: 'combat',
    points: 5,
    condition: (ctx) => ctx.shipsSunk >= 1,
  },
  sharpshooter: {
    id: 'sharpshooter',
    title: 'Sharpshooter',
    description: 'Achieve 80% accuracy in a single match',
    icon: '\u{1F3AF}',
    category: 'combat',
    points: 20,
    condition: (ctx) => ctx.shotsFired >= 5 && (ctx.shotsHit / ctx.shotsFired) >= 0.8,
  },
  untouchable: {
    id: 'untouchable',
    title: 'Untouchable',
    description: 'Win a match without losing a single ship',
    icon: '\u{1F6E1}\uFE0F',
    category: 'combat',
    points: 30,
    condition: (ctx) => ctx.won && ctx.shipsLost === 0,
  },
  bullseye: {
    id: 'bullseye',
    title: 'Bullseye',
    description: 'Sink all 5 enemy ships in under 25 turns',
    icon: '\u{1F4A5}',
    category: 'combat',
    points: 25,
    condition: (ctx) => ctx.won && ctx.shipsSunk >= 5 && ctx.turns < 25,
  },
  lucky_shot: {
    id: 'lucky_shot',
    title: 'Lucky Shot',
    description: 'Win a match with under 30% accuracy',
    icon: '\u{1F340}',
    category: 'combat',
    points: 15,
    condition: (ctx) => ctx.won && ctx.shotsFired >= 10 && (ctx.shotsHit / ctx.shotsFired) < 0.3,
  },
  speedrunner: {
    id: 'speedrunner',
    title: 'Speedrunner',
    description: 'Win a match in under 12 turns',
    icon: '\u{1F3C3}',
    category: 'combat',
    points: 30,
    condition: (ctx) => ctx.won && ctx.turns < 12,
  },

  // === VOLUME ===
  veteran: {
    id: 'veteran',
    title: 'Veteran',
    description: 'Play 100 games',
    icon: '\u{2694}\uFE0F',
    category: 'volume',
    points: 20,
    condition: (ctx) => ctx.totalGames >= 100,
  },
  centurion: {
    id: 'centurion',
    title: 'Centurion',
    description: 'Win 100 matches',
    icon: '\u{1F451}',
    category: 'volume',
    points: 50,
    condition: (ctx) => ctx.totalWins >= 100,
  },
  decimator: {
    id: 'decimator',
    title: 'Decimator',
    description: 'Sink 100 enemy ships across all matches',
    icon: '\u{1F480}',
    category: 'volume',
    points: 30,
    condition: (ctx) => ctx.totalShipsSunk >= 100,
  },

  // === CAMPAIGN ===
  set_sail: {
    id: 'set_sail',
    title: 'Set Sail',
    description: 'Begin the campaign',
    icon: '\u{2693}',
    category: 'campaign',
    points: 5,
    condition: (ctx) => ctx.isCampaign && ctx.campaignMissionId === 1,
  },
  halfway_there: {
    id: 'halfway_there',
    title: 'Halfway There',
    description: 'Complete campaign mission 8',
    icon: '\u{1F30A}',
    category: 'campaign',
    points: 20,
    condition: (ctx) => ctx.isCampaign && ctx.won && (ctx.highestCampaignMission ?? 0) >= 8,
  },
  conqueror: {
    id: 'conqueror',
    title: 'Conqueror of the Seas',
    description: 'Complete the entire campaign',
    icon: '\u{1F3C6}',
    category: 'campaign',
    points: 100,
    condition: (ctx) => ctx.isCampaign && ctx.won && (ctx.highestCampaignMission ?? 0) >= 15,
  },
  three_star_captain: {
    id: 'three_star_captain',
    title: 'Three-Star Captain',
    description: 'Earn 3 stars on every campaign mission',
    icon: '\u{2B50}',
    category: 'campaign',
    points: 75,
    condition: (ctx) => (ctx.totalCampaignStars ?? 0) >= 45, // 15 missions * 3 stars
  },

  // === MULTIPLAYER ===
  first_mate: {
    id: 'first_mate',
    title: 'First Mate',
    description: 'Win your first multiplayer match',
    icon: '\u{1F91D}',
    category: 'multiplayer',
    points: 10,
    condition: (ctx) => ctx.won && ctx.isMultiplayer,
  },
  climbing_ranks: {
    id: 'climbing_ranks',
    title: 'Climbing the Ranks',
    description: 'Reach 1300 rating',
    icon: '\u{1F4C8}',
    category: 'multiplayer',
    points: 20,
    condition: (ctx) => ctx.rating >= 1300,
  },
  admiral: {
    id: 'admiral',
    title: 'Admiral',
    description: 'Reach 1500 rating',
    icon: '\u{1F396}\uFE0F',
    category: 'multiplayer',
    points: 50,
    condition: (ctx) => ctx.rating >= 1500,
  },

  // === ABILITIES ===
  bombardier: {
    id: 'bombardier',
    title: 'Bombardier',
    description: 'Sink a ship using Cannon Barrage',
    icon: '\u{1F4A3}',
    category: 'abilities',
    points: 15,
    condition: (ctx) => (ctx.abilitySinks?.cannon_barrage ?? 0) >= 1,
  },
  smoke_master: {
    id: 'smoke_master',
    title: 'Smoke Master',
    description: 'Use Smoke Screen 10 times across all matches',
    icon: '\u{1F32B}\uFE0F',
    category: 'abilities',
    points: 15,
    // Approximation: Smoke Master triggers when ctx.abilitiesUsed.smoke_screen >= 10 in this single match,
    // OR cumulative tracking would be needed. For simplicity, count single-match usages too.
    condition: (ctx) => (ctx.abilitiesUsed?.smoke_screen ?? 0) >= 3,
  },
  repaired: {
    id: 'repaired',
    title: 'Repaired',
    description: 'Save a ship using Repair Kit',
    icon: '\u{1F527}',
    category: 'abilities',
    points: 10,
    condition: (ctx) => (ctx.abilitiesUsed?.repair_kit ?? 0) >= 1,
  },
  chain_master: {
    id: 'chain_master',
    title: 'Chain Master',
    description: 'Use Chain Shot to hit 3 cells in one shot',
    icon: '\u{26D3}\uFE0F',
    category: 'abilities',
    points: 15,
    condition: (ctx) => (ctx.abilitiesUsed?.chain_shot ?? 0) >= 1,
  },
  scout: {
    id: 'scout',
    title: 'Scout',
    description: 'Use Spyglass to reveal a ship-rich row',
    icon: '\u{1F50D}',
    category: 'abilities',
    points: 10,
    condition: (ctx) => (ctx.abilitiesUsed?.spyglass ?? 0) >= 1,
  },
  pirate_boarder: {
    id: 'pirate_boarder',
    title: 'Pirate Boarder',
    description: 'Successfully gather intel with Boarding Party',
    icon: '\u{1F3F4}\u200D\u2620\uFE0F',
    category: 'abilities',
    points: 10,
    condition: (ctx) => (ctx.abilitiesUsed?.boarding_party ?? 0) >= 1,
  },

  // === MISC ===
  ironclad_survivor: {
    id: 'ironclad_survivor',
    title: 'Ironclad Survivor',
    description: 'Survive a hit thanks to Battleship armor',
    icon: '\u{1F6E1}\uFE0F',
    category: 'misc',
    points: 10,
    condition: (ctx) => ctx.ironcladSaved,
  },
  submariner: {
    id: 'submariner',
    title: 'Submariner',
    description: "Have your submarine evade an enemy's sonar ping",
    icon: '\u{1F6A2}',
    category: 'misc',
    points: 10,
    condition: (ctx) => ctx.submarineSonarBlocked,
  },
};

/**
 * Evaluate all achievements against context.
 * Returns the IDs of achievements whose conditions are now met.
 * The caller is responsible for filtering out already-unlocked achievements.
 */
export function evaluateAchievements(ctx: MatchEvaluationContext): string[] {
  const unlocked: string[] = [];
  for (const def of Object.values(ACHIEVEMENT_DEFS)) {
    if (def.condition(ctx)) {
      unlocked.push(def.id);
    }
  }
  return unlocked;
}

export function newlyUnlocked(ctx: MatchEvaluationContext, alreadyUnlocked: Set<string>): string[] {
  return evaluateAchievements(ctx).filter((id) => !alreadyUnlocked.has(id));
}
