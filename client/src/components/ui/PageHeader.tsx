import type { ReactNode } from 'react';
import { FONT_STYLES } from '../../styles/fonts';

interface PageHeaderProps {
  /** Main page title (uses pirate display font). */
  title: string;
  /** Optional italic subtitle under the title. */
  subtitle?: string;
  /** Right-hand slot: back button, action buttons, filter chips, etc. */
  actions?: ReactNode;
  /** Override the title color (defaults to canonical blood-bright). */
  titleColorClass?: string;
  /** Override h1 text size (defaults to text-5xl). */
  titleSizeClass?: string;
}

/**
 * Standard page header.
 *
 * Title on the left (Pirata One, blood-bright, text-shadow), optional subtitle
 * beneath, and an actions slot on the right for back buttons or filters.
 * Used by every list/page inside PageShell.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  titleColorClass = 'text-blood-bright',
  titleSizeClass = 'text-5xl',
}: PageHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4 mb-8">
      <div>
        <h1
          className={`${titleSizeClass} ${titleColorClass}`}
          style={{
            ...FONT_STYLES.pirate,
            textShadow: '0 0 20px rgba(196, 30, 58, 0.4)',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-aged-gold text-sm tracking-widest uppercase mt-1" style={FONT_STYLES.labelSC}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
