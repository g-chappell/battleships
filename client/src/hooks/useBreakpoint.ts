import { useEffect, useState } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

interface BreakpointInfo {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isPortrait: boolean;
}

function read(): BreakpointInfo {
  if (typeof window === 'undefined') {
    return {
      breakpoint: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isPortrait: false,
    };
  }
  const w = window.innerWidth;
  const isPortrait = window.innerHeight > window.innerWidth;
  const breakpoint: Breakpoint = w <= 768 ? 'mobile' : w <= 1024 ? 'tablet' : 'desktop';
  return {
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    isPortrait,
  };
}

export function useBreakpoint(): BreakpointInfo {
  const [info, setInfo] = useState<BreakpointInfo>(() => read());

  useEffect(() => {
    const handler = () => setInfo(read());
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, []);

  return info;
}
