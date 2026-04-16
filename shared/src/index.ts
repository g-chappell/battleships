// Value exports (enums, constants, functions, classes)
export {
  GRID_SIZE,
  CellState,
  ShipType,
  SHIP_LENGTHS,
  SHIP_NAMES,
  Orientation,
  GamePhase,
  ShotResult,
  coordKey,
  parseCoordKey,
} from './types';

// Type-only exports (interfaces)
export type {
  Coordinate,
  ShipPlacement,
  Ship,
  CellGrid,
  ShotOutcome,
  GameState,
} from './types';

export { Board } from './Board';
export { GameEngine } from './GameEngine';
export { EasyAI, MediumAI, HardAI, randomPlacement } from './AI';
export type { AIPlayer } from './AI';

// Traits
export {
  createTraitState,
  processIronclad,
  processSpotter,
  processCoastalCover,
  processDepthCharge,
  resolveDepthChargeShots,
  applyDeflectionTrait,
  isCoastalShip,
  isSubmarineCell,
} from './traits';
export type { TraitEffect, TraitState, DeflectionSource, DepthChargeShot } from './traits';

// Abilities
export {
  AbilityType,
  ABILITY_DEFS,
  createAbilitySystemState,
  canUseAbility,
  tickCooldowns,
  executeCannonBarrage,
  executeSonarPing,
  executeSmokeScreen,
  isCellSmoked,
  executeRepairKit,
  executeChainShot,
  executeSpyglass,
  executeBoardingParty,
  executeSummonKraken,
  resolveKrakenStrike,
  fixStaleOutcomes,
} from './abilities';
export type {
  AbilityDef,
  AbilityState,
  AbilitySystemState,
  SmokeZone,
  CannonBarrageResult,
  SonarPingResult,
  RepairResult,
  ChainShotResult,
  SpyglassResult,
  BoardingPartyResult,
  KrakenRitualState,
  KrakenStrikeResult,
} from './abilities';

// Campaign
export {
  CAMPAIGN_MISSIONS,
  calculateStars,
  getMission,
} from './campaign';
export type {
  CampaignMission,
  ComicPanel,
  MissionModifiers,
  MissionStarRequirements,
  AIPersonality,
} from './campaign';

// Achievements
export {
  ACHIEVEMENT_DEFS,
  evaluateAchievements,
  newlyUnlocked,
} from './achievements';
export type {
  AchievementDef,
  AchievementCategory,
  MatchEvaluationContext,
} from './achievements';

// Sockets
export type {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerView,
  SerializedShip,
  PublicBoardView,
  OwnBoardView,
  AbilityStateView,
  PublicGameState,
  ChatMessage,
  MatchSummary,
} from './sockets';

// Captains
export {
  CAPTAIN_DEFS,
  CAPTAIN_IDS,
  DEFAULT_CAPTAIN,
} from './captains';
export type { CaptainDef } from './captains';

// Cosmetics
export {
  COSMETIC_CATALOG,
  GOLD_REWARDS,
  getCosmetic,
  getCosmeticsByKind,
} from './cosmetics';
export type {
  CosmeticKind,
  CosmeticRarity,
  CosmeticDef,
  GoldRewardReason,
} from './cosmetics';

// Tournaments
export {
  VALID_TOURNAMENT_SIZES,
  seedPairings,
  nextBracketSlot,
  totalRounds,
  isFinalRound,
} from './tournaments';
export type {
  TournamentStatus,
  TournamentMatchStatus,
  TournamentSize,
  TournamentSummary,
  TournamentBracketMatch,
  TournamentDetail,
} from './tournaments';

// Clans
export type {
  ClanRole,
  ClanSummary,
  ClanMember,
  ClanChatMessage as ClanChatMessageType,
  ClanDetail,
} from './clans';

// Replay
export { MAX_REPLAY_EVENTS } from './replay';
export type {
  ReplayEvent,
  ReplayData,
  ReplaySide,
  ReplayPlayerRef,
} from './replay';

// Seasons
export {
  getSeasonTimeRemaining,
  SEASON_DEFAULT_DURATION_DAYS,
  SEASON_START_RATING,
} from './seasons';
export type {
  SeasonInfo,
  SeasonTimeRemaining,
} from './seasons';
