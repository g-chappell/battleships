/**
 * Design token hex constants — SINGLE SOURCE OF TRUTH.
 *
 * These values must stay in sync with the @theme block in index.css.
 *
 * Prefer Tailwind utility classes (bg-blood, text-bone, border-gold, etc.)
 * in JSX. Use these constants only where Tailwind cannot reach:
 *   - Three.js material colors / shader uniforms
 *   - Canvas drawing (shareResult)
 *   - inline style props where Tailwind classes aren't available
 */

// ── Theme palette (mirrored from index.css @theme) ──

export const COLORS = {
  blood: '#8b0000',
  bloodDark: '#5c0000',
  bloodBright: '#c41e3a',
  crimson: '#6b0a0a',
  mahogany: '#3a1e18',
  mahoganyLight: '#4d2e22',
  mahoganyMid: '#5a3828',
  pitch: '#150c0c',
  coal: '#221210',
  copper: '#b87333',
  agedGold: '#a06820',
  gold: '#d4a040',
  bone: '#e8dcc8',
  parchment: '#d4c4a1',
  rust: '#8b3a1c',
} as const;

// ── 3D scene colors (used by Three.js materials, not Tailwind) ──

export const SCENE = {
  // Board grid cell states
  cellEmpty: '#1a4a6a',       // ocean blue (the "sea" tiles)
  cellEmptyHover: '#2a6088',  // lighter blue on hover
  cellHit: '#bb1a1a',         // bright red
  cellMiss: '#4a7090',        // steel blue-gray
  cellShip: '#8a5e44',        // tan/wood
  cellLand: '#7a5838',
  cellLandRevealed: '#6a4828',        // darker tan
  cellPlacementValid: '#d4a040',
  cellPlacementInvalid: '#c41e3a',

  // Board frame
  boardBase: '#4a2f2a',
  boardTrim: '#5a3328',
  boardOutline: '#d4a040',
  boardOutlineEmissive: '#c41e3a',

  // Grid lines
  gridLine: '#d4a040',

  // Sonar
  sonarShipDetected: '#e74c3c',
  sonarClear: '#2ecc71',

  // Hit/miss markers
  hitFlame: '#e74c3c',
  hitFlameEmissive: '#ff4444',
  hitCore: '#ff6600',
  hitCoreEmissive: '#ff4400',
  hitCenter: '#ffcc00',
  hitCenterEmissive: '#ffaa00',
  hitDebris: '#8b4513',
  hitDebrisEmissive: '#ff6600',
  missSplashRing: '#555555',
  missDroplet: '#5dade2',
  missDropletAlt: '#3498db',

  // Ironclad deflection marker (armor plating + spark)
  deflectRing: '#d4a040',
  deflectRingEmissive: '#ff8800',
  deflectCore: '#e8dcc8',
  deflectCoreEmissive: '#ffcc66',

  // Coastal Cover deflection marker (rocky splash + sand)
  coastalRock: '#5a4838',
  coastalSand: '#a8855a',
  coastalSpray: '#9ec4d4',

  // Coastal terrain
  terrainSand: '#8a6a44',
  terrainDirt: '#5a4030',
  terrainRock: '#3d2818',
  terrainGrass: '#3a6028',
  terrainPlanks: '#4a3a2a',
  terrainPlanksDark: '#3a2a1a',

  // Lighting
  hemisphereSkySide: '#1a3050',
  hemisphereGround: '#1a0606',
  directionalColor: '#d4a060',
  pointRed: '#c41e3a',
  pointGold: '#d4a040',
  pointWarm: '#e8a060',
  fogColor: '#0a1825',
} as const;

export type ColorToken = keyof typeof COLORS;
