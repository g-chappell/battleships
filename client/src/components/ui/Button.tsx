import type { ReactNode, ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'pill' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const pirateStyle = { fontFamily: "'Pirata One', serif" };

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-4 text-xs',
  md: 'h-10 px-5 text-sm',
  lg: 'h-14 px-8 text-lg',
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-b from-[#c41e3a] to-[#8b0000] text-[#e8dcc8] border-2 border-[#c41e3a] hover:from-[#e74c3c] hover:to-[#c41e3a] hover:scale-105 active:scale-95 shadow-lg shadow-[#8b0000]/30',
  secondary:
    'bg-[#3d1f17] text-[#e8dcc8] border border-[#8b0000]/60 hover:bg-[#5c2820] hover:border-[#c41e3a]',
  pill:
    'bg-[#1a0a0a]/85 text-[#e8dcc8] border border-[#8b0000]/60 hover:bg-[#3d1f17]/90 hover:border-[#c41e3a]/80 backdrop-blur-md',
  ghost:
    'bg-transparent text-[#d4c4a1]/70 hover:text-[#e8dcc8] hover:bg-[#3d1f17]/40',
  danger:
    'bg-gradient-to-b from-[#8b0000] to-[#5c0000] text-[#e8dcc8] border border-[#c41e3a]/50 hover:from-[#c41e3a] hover:to-[#8b0000]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth,
  children,
  className = '',
  style,
  ...rest
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-full font-bold transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 select-none whitespace-nowrap';
  return (
    <button
      className={`${base} ${sizeClasses[size]} ${variantClasses[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      style={{ ...pirateStyle, ...style }}
      {...rest}
    >
      {icon && <span className="flex items-center">{icon}</span>}
      {children}
    </button>
  );
}
