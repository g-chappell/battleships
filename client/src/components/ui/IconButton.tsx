import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  active?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

export function IconButton({
  label,
  active,
  size = 'md',
  children,
  className = '',
  ...rest
}: IconButtonProps & { children: ReactNode }) {
  const base =
    'flex items-center justify-center rounded-lg transition-all relative group cursor-pointer disabled:opacity-50 backdrop-blur-md';
  const styling = active
    ? 'bg-[#8b0000]/60 border border-[#c41e3a] text-[#c41e3a] shadow-md shadow-[#c41e3a]/30'
    : 'bg-[#221210]/85 border border-[#8b0000]/40 text-[#d4c4a1]/70 hover:bg-[#4d2e22]/90 hover:border-[#c41e3a]/60 hover:text-[#e8dcc8]';

  return (
    <button
      className={`${base} ${sizeClasses[size]} ${styling} ${className}`}
      title={label}
      {...rest}
    >
      {children}
      {label && (
        <span
          className="absolute top-12 left-1/2 -translate-x-1/2 bg-[#221210] border border-[#8b0000]/40 text-[#e8dcc8] text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50"
          style={{ fontFamily: "'IM Fell English SC', serif" }}
        >
          {label}
        </span>
      )}
    </button>
  );
}
