import { useEffect, useState } from 'react';

export function LoadingSplash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeT = setTimeout(() => setFading(true), 1200);
    const hideT = setTimeout(() => setVisible(false), 2000);
    return () => {
      clearTimeout(fadeT);
      clearTimeout(hideT);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-b from-[#0d0606] via-[#1a0a0a] to-[#2a1410] transition-opacity duration-700"
      style={{ opacity: fading ? 0 : 1 }}
    >
      <h1
        className="text-7xl text-[#c41e3a] mb-4"
        style={{
          fontFamily: "'Pirata One', serif",
          textShadow: '0 0 30px rgba(196,30,58,0.5), 0 4px 12px rgba(0,0,0,0.8)',
          animation: 'pulse-slow 2s ease-in-out infinite',
        }}
      >
        IRONCLAD WATERS
      </h1>
      <div className="text-[#a06820] text-sm tracking-[0.4em] uppercase" style={{ fontFamily: "'IM Fell English SC', serif" }}>
        Hoisting the colors...
      </div>
      <div className="mt-8 w-64 h-1 bg-[#3d1f17] rounded overflow-hidden relative">
        <div
          className="h-full bg-gradient-to-r from-[#8b0000] to-[#c41e3a]"
          style={{ width: '100%', animation: 'shimmer 2s linear' }}
        />
      </div>
    </div>
  );
}
