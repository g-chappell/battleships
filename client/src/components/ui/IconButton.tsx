import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../shadcn/tooltip';

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
    'flex items-center justify-center rounded-lg transition-all relative cursor-pointer disabled:opacity-50 backdrop-blur-md';
  const styling = active
    ? 'bg-[#8b0000]/60 border border-[#c41e3a] text-[#c41e3a] shadow-md shadow-[#c41e3a]/30'
    : 'bg-[#221210]/85 border border-[#8b0000]/70 text-[#d4c4a1]/70 hover:bg-[#4d2e22]/90 hover:border-[#c41e3a]/80 hover:text-[#e8dcc8]';

  const button = (
    <button
      className={`${base} ${sizeClasses[size]} ${styling} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );

  if (!label) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
