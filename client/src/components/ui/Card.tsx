import type { HTMLAttributes, ReactNode } from 'react';

export type CardVariant = 'default' | 'glow' | 'active' | 'muted';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  children: ReactNode;
}

const VARIANT: Record<CardVariant, string> = {
  default: 'bg-coal/80 border border-blood/50',
  glow: 'bg-coal/80 border border-blood/60 panel-glow',
  active: 'bg-gradient-to-b from-mahogany-light to-coal border-2 border-blood-bright panel-glow',
  muted: 'bg-pitch/70 border border-mahogany-light',
};

const PAD: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
};

/**
 * Reusable card / panel container.
 *
 * Variants:
 * - default: standard dark panel
 * - glow: standard panel + inner crimson glow (for page sub-sections)
 * - active: highlighted selection state (bright border + glow)
 * - muted: dimmer secondary panel
 *
 * Pass `onClick` to make it clickable with hover feedback.
 */
export function Card({
  variant = 'default',
  padding = 'md',
  className = '',
  onClick,
  children,
  ...rest
}: CardProps) {
  const interactive = onClick ? 'cursor-pointer hover:scale-[1.01] hover:border-blood-bright transition-all' : '';
  return (
    <div
      className={`rounded-lg ${VARIANT[variant]} ${PAD[padding]} ${interactive} ${className}`}
      onClick={onClick}
      {...rest}
    >
      {children}
    </div>
  );
}
