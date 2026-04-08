/**
 * Centralized font-family style objects.
 *
 * Use these instead of declaring `const pirateStyle = { fontFamily: "'Pirata One', serif" }`
 * inline in every component.
 *
 *   import { FONT_STYLES } from '@/styles/fonts';
 *   <h1 style={FONT_STYLES.pirate}>IRONCLAD WATERS</h1>
 *   <span style={FONT_STYLES.labelSC}>Turn 5</span>
 *   <p style={FONT_STYLES.body}>Ye shall taste the sea, landlubber.</p>
 *
 * Tailwind equivalents (auto-generated from @theme in index.css):
 *   font-pirate   → Pirata One
 *   font-label    → IM Fell English SC
 *   font-body     → IM Fell English
 */

export const FONT_STYLES = {
  pirate: { fontFamily: "'Pirata One', serif" } as const,
  labelSC: { fontFamily: "'IM Fell English SC', serif" } as const,
  body: { fontFamily: "'IM Fell English', serif" } as const,
} as const;

export const FONT_FAMILIES = {
  pirate: "'Pirata One', serif",
  labelSC: "'IM Fell English SC', serif",
  body: "'IM Fell English', serif",
} as const;
