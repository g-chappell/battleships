---
name: brand-guidelines
description: Ironclad Waters brand system — colors, typography, component patterns, and anti-patterns for all UI work
user_invocable: false
---

# Brand Guidelines — Ironclad Waters

Follow these guidelines for ALL UI work: game client components, standalone artifacts, landing pages, and marketing materials. The brand is **aged pirate nautical** — weathered wood, brass fittings, old parchment, blood-red accents, candlelit warmth.

## Color Palette

| Token           | Hex       | Usage                                       |
|-----------------|-----------|---------------------------------------------|
| `blood`         | `#8b0000` | Primary actions, borders, active states      |
| `blood-dark`    | `#5c0000` | Hover/pressed states, deep shadows           |
| `blood-bright`  | `#c41e3a` | Destructive actions, alerts, glowing accents  |
| `crimson`       | `#6b0a0a` | Panel backgrounds, subtle danger              |
| `mahogany`      | `#3a1e18` | Secondary surfaces, card backgrounds          |
| `mahogany-light`| `#4d2e22` | Borders, input outlines, dividers             |
| `mahogany-mid`  | `#5a3828` | Hover surfaces, elevated panels               |
| `pitch`         | `#150c0c` | Page background, deepest layer                |
| `coal`          | `#221210` | Card/popover backgrounds, secondary depth     |
| `copper`        | `#b87333` | Tertiary accents, icons, rank badges           |
| `aged-gold`     | `#a06820` | Muted gold for less emphasis                   |
| `gold`          | `#d4a040` | Accent highlights, focus rings, currency       |
| `bone`          | `#e8dcc8` | Primary text, foreground                       |
| `parchment`     | `#d4c4a1` | Muted text, secondary labels                   |
| `rust`          | `#8b3a1c` | Warning states, aged metal accents              |

### shadcn Semantic Mapping
When using shadcn components, these map automatically via CSS variables in `client/src/index.css`:
- `--background` → pitch | `--foreground` → bone
- `--primary` → blood | `--primary-foreground` → bone
- `--secondary` → mahogany | `--accent` → gold
- `--destructive` → blood-bright
- `--border` / `--input` → mahogany-light
- `--ring` → gold
- `--muted` → mahogany | `--muted-foreground` → parchment
- `--card` / `--popover` → coal

## Typography

| Role     | Font                  | Tailwind class | Usage                              |
|----------|-----------------------|----------------|------------------------------------|
| Heading  | Pirata One            | `font-pirate`  | h1–h4, game title, section headers |
| Label    | IM Fell English SC    | `font-label`   | Buttons, badges, nav items         |
| Body     | IM Fell English       | `font-body`    | Paragraphs, descriptions, chat     |

- Never use Inter, Geist, system-ui, or sans-serif fonts
- Headings get `letter-spacing: 0.05em`
- Buttons get `letter-spacing: 0.03em`

## Component Aesthetic

### Panels & Cards
- Dark backgrounds (`coal` or `mahogany`) with subtle inner glow
- Borders: `1px solid rgba(139, 0, 0, 0.6)` or `border-mahogany-light`
- Use the `.panel-glow` and `.panel-border` utility classes
- Subtle box-shadow with blood-red tint: `box-shadow: inset 0 0 14px rgba(196, 30, 58, 0.18)`

### Buttons
- Primary: gradient from `blood-bright` to `blood`, `bone` text, `blood-bright` border
- Rounded-full shape, bold pirate font
- Hover: slight scale-up (1.05×), brighter gradient
- Active: scale-down (0.95×)
- Use the existing `<Button>` component from `client/src/components/ui/Button.tsx`

### Inputs & Forms
- Background: transparent or `mahogany`
- Border: `mahogany-light`, focus ring: `gold`
- Text: `bone`, placeholder: `parchment` at lower opacity

### Modals & Popovers
- Background: `coal` with `panel-glow`
- Border: blood-tinted
- Backdrop: dark overlay with slight blur

## Animations
- Subtle flicker (candlelight feel): `@keyframes flicker`
- Smooth scale entrance: `@keyframes fadeInScale`
- Slide from right for notifications: `@keyframes slideInRight`
- Slow pulse for highlights: `@keyframes pulse-slow`
- Shimmer for loading: `@keyframes shimmer`

## Anti-Patterns — DO NOT

- **No purple gradients** — this is pirate themed, not tech-startup themed
- **No Inter / Geist / sans-serif fonts** — always use the pirate font stack
- **No pastel colors** — the palette is dark and saturated
- **No generic rounded cards with white backgrounds** — everything is dark, textured, aged
- **No excessive centering** — vary layouts, use asymmetry
- **No bright whites** — `bone` (#e8dcc8) is the lightest color, never pure white
- **No flat/minimal design** — lean into the pirate aesthetic with shadows, glows, gradients
- **No stock icon libraries without theming** — if using Lucide icons, ensure they're colored with the palette (gold, bone, copper)

## Standalone Artifacts
When building pages outside the game client (landing pages, docs, marketing):
- Import Google Fonts: Pirata One, IM Fell English, IM Fell English SC
- Define the same CSS variables (copy the `:root` block from `client/src/index.css`)
- Use the same color/typography rules above
- Add subtle background textures (CSS gradients simulating aged paper or dark wood grain)
