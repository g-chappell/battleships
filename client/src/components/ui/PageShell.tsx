import type { ReactNode } from 'react';

export type PageMaxWidth = 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | 'full';

interface PageShellProps {
  children: ReactNode;
  /** Inner content max-width. Defaults to 4xl. */
  maxWidth?: PageMaxWidth;
  /** Reduce top padding when no TopNav is present. */
  noTopNav?: boolean;
  /** Override outer wrapper classes. */
  className?: string;
}

const MAX_W: Record<PageMaxWidth, string> = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  full: 'max-w-full',
};

/**
 * Standard page wrapper.
 *
 * Provides the canonical dark pirate gradient background, overflow scroll,
 * and top padding that clears the floating TopNav. Inner content is
 * constrained to a centered max-width container.
 *
 * Use in every "list" style page (Dashboard, Leaderboard, Shop, etc).
 * Do NOT use in gameplay screens (GamePage) or modal-ish pages (AuthPage).
 */
export function PageShell({
  children,
  maxWidth = '4xl',
  noTopNav = false,
  className = '',
}: PageShellProps) {
  return (
    <div
      className={`w-full h-full overflow-y-auto px-6 py-8 md:px-12 ${
        noTopNav ? 'pt-8' : 'pt-24'
      } bg-gradient-to-b from-pitch via-coal to-mahogany ${className}`}
    >
      <div className={`${MAX_W[maxWidth]} mx-auto`}>{children}</div>
    </div>
  );
}
