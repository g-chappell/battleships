/**
 * Design token hex constants.
 *
 * Prefer Tailwind utility classes (bg-blood, text-bone, border-gold, etc.)
 * in JSX. Use these constants only where Tailwind cannot reach:
 *   - inline style={{ color: COLORS.blood }} props
 *   - SVG fill/stroke attributes
 *   - dynamic gradient strings
 *   - three.js material colors
 *   - shader uniforms
 */

export const COLORS = {
  blood: '#8b0000',
  bloodDark: '#5c0000',
  bloodBright: '#c41e3a',
  crimson: '#6b0a0a',
  mahogany: '#2a1410',
  mahoganyLight: '#3d1f17',
  mahoganyMid: '#4a2820',
  pitch: '#0d0606',
  coal: '#1a0a0a',
  copper: '#b87333',
  agedGold: '#a06820',
  gold: '#d4a040',
  bone: '#e8dcc8',
  parchment: '#d4c4a1',
  rust: '#8b3a1c',
} as const;

export type ColorToken = keyof typeof COLORS;
