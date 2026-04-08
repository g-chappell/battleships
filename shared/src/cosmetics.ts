/**
 * Cosmetics catalog and gold economy constants.
 * Shared between client and server so pricing/unlocks stay in sync.
 */

export type CosmeticKind = 'ship_skin' | 'board_theme' | 'explosion_fx';
export type CosmeticRarity = 'common' | 'rare' | 'legendary';

export interface CosmeticDef {
  id: string;
  kind: CosmeticKind;
  name: string;
  description: string;
  price: number;
  rarity: CosmeticRarity;
  /** Primary preview color (used in shop thumbnails) */
  previewColor: string;
  /** Optional secondary color used by 3D material swaps */
  accentColor?: string;
  /** Only for ship_skin — overrides default hull/accent pairs */
  shipMaterial?: { hull: string; accent: string; emissive?: string };
  /** Only for board_theme — overrides ocean + board tint */
  boardTint?: { ocean: [number, number, number]; grid: string; frame: string };
  /** Only for explosion_fx — overrides hit marker colors */
  explosionTint?: { primary: string; secondary: string };
}

export const COSMETIC_CATALOG: CosmeticDef[] = [
  // === SHIP SKINS ===
  {
    id: 'default',
    kind: 'ship_skin',
    name: 'Standard Fleet',
    description: 'The classic battered hulls of yer starting fleet.',
    price: 0,
    rarity: 'common',
    previewColor: '#8a5e44',
  },
  {
    id: 'skin.blackbeard',
    kind: 'ship_skin',
    name: 'Blackbeard\'s Fury',
    description: 'Pitch-black hulls with brass fittings, sails torn by a thousand battles.',
    price: 500,
    rarity: 'rare',
    previewColor: '#1a0a08',
    accentColor: '#d4a040',
    shipMaterial: { hull: '#0d0606', accent: '#d4a040', emissive: '#c41e3a' },
  },
  {
    id: 'skin.ghost_fleet',
    kind: 'ship_skin',
    name: 'Ghost Fleet',
    description: 'Spectral hulls that phase through the water. Said to be cursed.',
    price: 1200,
    rarity: 'legendary',
    previewColor: '#8ab8d4',
    accentColor: '#e8ecf0',
    shipMaterial: { hull: '#4a6478', accent: '#c0d8e8', emissive: '#8ab8d4' },
  },
  {
    id: 'skin.royal_navy',
    kind: 'ship_skin',
    name: 'Royal Navy',
    description: 'The enemy\'s pride — captured and repainted in yer colors.',
    price: 800,
    rarity: 'rare',
    previewColor: '#5a4a8a',
    accentColor: '#f0d8a0',
    shipMaterial: { hull: '#3a3a6a', accent: '#f0d8a0', emissive: '#c41e3a' },
  },

  // === BOARD THEMES ===
  {
    id: 'default',
    kind: 'board_theme',
    name: 'Blood Tide',
    description: 'The crimson waters of the Devil\'s Triangle.',
    price: 0,
    rarity: 'common',
    previewColor: '#8b0000',
  },
  {
    id: 'theme.iron_fog',
    kind: 'board_theme',
    name: 'Iron Fog',
    description: 'A cold grey sea under eternal mist.',
    price: 400,
    rarity: 'rare',
    previewColor: '#5a6878',
    boardTint: {
      ocean: [0.15, 0.18, 0.22],
      grid: '#8ab0c0',
      frame: '#3a4a58',
    },
  },
  {
    id: 'theme.molten_depths',
    kind: 'board_theme',
    name: 'Molten Depths',
    description: 'Waters that boil over lava vents. Rare and deadly.',
    price: 1500,
    rarity: 'legendary',
    previewColor: '#ff6020',
    boardTint: {
      ocean: [0.32, 0.08, 0.02],
      grid: '#ff8040',
      frame: '#6a2010',
    },
  },

  // === EXPLOSION FX ===
  {
    id: 'default',
    kind: 'explosion_fx',
    name: 'Cannonfire',
    description: 'Classic fire and smoke.',
    price: 0,
    rarity: 'common',
    previewColor: '#ff6600',
  },
  {
    id: 'fx.hellfire',
    kind: 'explosion_fx',
    name: 'Hellfire',
    description: 'Crimson flames that consume yer enemies.',
    price: 600,
    rarity: 'rare',
    previewColor: '#c41e3a',
    explosionTint: { primary: '#c41e3a', secondary: '#ff4040' },
  },
  {
    id: 'fx.spectral',
    kind: 'explosion_fx',
    name: 'Spectral',
    description: 'Ghostly blue-green wisps rise from the wreckage.',
    price: 900,
    rarity: 'legendary',
    previewColor: '#40e0c0',
    explosionTint: { primary: '#40e0c0', secondary: '#b0f0e0' },
  },
];

export function getCosmetic(id: string): CosmeticDef | undefined {
  return COSMETIC_CATALOG.find((c) => c.id === id);
}

export function getCosmeticsByKind(kind: CosmeticKind): CosmeticDef[] {
  return COSMETIC_CATALOG.filter((c) => c.kind === kind);
}

// === GOLD ECONOMY ===

export const GOLD_REWARDS = {
  WIN_MP_RANKED: 50,
  WIN_MP_CASUAL: 25,
  WIN_AI_EASY: 5,
  WIN_AI_MEDIUM: 10,
  WIN_AI_HARD: 20,
  WIN_CAMPAIGN: 30,
  LOSS_CONSOLATION: 10,
  TOURNAMENT_WIN: 500,
  TOURNAMENT_RUNNER_UP: 250,
} as const;

export type GoldRewardReason = keyof typeof GOLD_REWARDS;
