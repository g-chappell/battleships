import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import { useCosmeticsStore } from '../../store/cosmeticsStore';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { AuthPage } from '../../pages/AuthPage';
import type { AppScreen } from '../../store/gameStore';

const labelStyle = { fontFamily: "'IM Fell English SC', serif" };
const pirateStyle = { fontFamily: "'Pirata One', serif" };

interface NavLink {
  label: string;
  screen: AppScreen;
}

const NAV_LINKS: NavLink[] = [
  { label: 'Home', screen: 'menu' },
  { label: 'Campaign', screen: 'campaign' },
  { label: 'Multiplayer', screen: 'lobby' },
  { label: 'Tournaments', screen: 'tournaments' },
  { label: 'Clans', screen: 'clans' },
  { label: 'Shop', screen: 'shop' },
  { label: 'Leaderboard', screen: 'leaderboard' },
  { label: 'Friends', screen: 'friends' },
];

export function TopNav() {
  const screen = useGameStore((s) => s.screen);
  const setScreen = useGameStore((s) => s.setScreen);
  const user = useAuthStore((s) => s.user);
  const gold = useCosmeticsStore((s) => s.gold);
  const { isMobile } = useBreakpoint();

  const [showAuth, setShowAuth] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Floating centered pill navbar */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-40">
        <div
          className="flex items-center gap-1 px-3 py-2 bg-[#221210]/85 border border-[#8b0000]/60 rounded-full backdrop-blur-md"
          style={{
            boxShadow:
              '0 0 24px rgba(196, 30, 58, 0.25), inset 0 0 12px rgba(196, 30, 58, 0.12), 0 4px 20px rgba(0,0,0,0.6)',
          }}
        >
          {/* Logo */}
          <button
            onClick={() => setScreen('menu')}
            className="flex items-center gap-2 px-3 py-1 rounded-full hover:bg-[#4d2e22]/60 transition-colors"
            title="Home"
          >
            <div
              className="w-7 h-7 rounded-full bg-gradient-to-br from-[#c41e3a] to-[#5c0000] border border-[#c41e3a] flex items-center justify-center text-[#e8dcc8] text-xs font-bold"
              style={{ ...pirateStyle, textShadow: '0 0 6px rgba(196,30,58,0.6)' }}
            >
              IW
            </div>
            <span className="text-[#c41e3a] hidden md:block text-sm tracking-wide" style={pirateStyle}>
              Ironclad
            </span>
          </button>

          <div className="w-px h-6 bg-[#8b0000]/40 mx-1" />

          {/* Nav links — desktop/tablet only */}
          {!isMobile && NAV_LINKS.map((link) => {
            const active = screen === link.screen;
            return (
              <button
                key={link.screen}
                onClick={() => setScreen(link.screen)}
                className={`px-3 py-1.5 rounded-full text-xs lg:text-sm transition-all ${
                  active
                    ? 'bg-gradient-to-b from-[#c41e3a] to-[#8b0000] text-[#e8dcc8] shadow-md shadow-[#c41e3a]/30'
                    : 'text-[#d4c4a1]/80 hover:bg-[#4d2e22]/60 hover:text-[#e8dcc8]'
                }`}
                style={labelStyle}
              >
                {link.label}
              </button>
            );
          })}

          {/* Mobile hamburger */}
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="px-3 py-1.5 rounded-full text-[#d4c4a1] hover:bg-[#4d2e22]/60 transition-colors"
              title="Menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}

          <div className="w-px h-6 bg-[#8b0000]/40 mx-1" />

          {/* Gold pill — only for registered users */}
          {user && (
            <>
              <button
                onClick={() => setScreen('shop')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-b from-[#5c2010] to-[#3d1a08] border border-[#d4a040]/70 hover:border-[#d4a040] transition-colors"
                style={pirateStyle}
                title={`${gold} gold — click to visit shop`}
              >
                <span className="text-[#d4a040] text-sm leading-none">⛃</span>
                <span className="text-[#e8dcc8] text-sm font-bold">{gold}</span>
              </button>
              <div className="w-px h-6 bg-[#8b0000]/40 mx-1" />
            </>
          )}
          {!user && <div className="w-px h-6 bg-[#8b0000]/40 mx-1" />}

          {/* User / Account */}
          {user ? (
            <button
              onClick={() => setScreen('dashboard')}
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-b from-[#4d2e22] to-[#221210] border border-[#8b0000]/60 hover:border-[#c41e3a] transition-colors"
              style={labelStyle}
            >
              <div
                className="w-6 h-6 rounded-full bg-[#8b0000]/40 border border-[#c41e3a]/50 flex items-center justify-center text-[#c41e3a] text-xs font-bold"
                style={pirateStyle}
              >
                {user.username[0].toUpperCase()}
              </div>
              <span className="text-[#e8dcc8] text-sm hidden md:block">{user.username}</span>
            </button>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="px-4 py-1.5 rounded-full bg-gradient-to-b from-[#c41e3a] to-[#8b0000] text-[#e8dcc8] text-sm hover:from-[#e74c3c] hover:to-[#c41e3a] transition-all"
              style={pirateStyle}
            >
              Account
            </button>
          )}
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {isMobile && mobileMenuOpen && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-40 bg-[#221210]/95 border border-[#8b0000]/60 rounded-2xl backdrop-blur-md p-2 flex flex-col gap-1 min-w-[200px] panel-glow"
          style={{
            boxShadow: '0 0 24px rgba(196, 30, 58, 0.25), 0 4px 20px rgba(0,0,0,0.7)',
          }}
        >
          {NAV_LINKS.map((link) => {
            const active = screen === link.screen;
            return (
              <button
                key={link.screen}
                onClick={() => {
                  setScreen(link.screen);
                  setMobileMenuOpen(false);
                }}
                className={`px-4 py-2 rounded-full text-sm text-left transition-all ${
                  active
                    ? 'bg-gradient-to-b from-[#c41e3a] to-[#8b0000] text-[#e8dcc8]'
                    : 'text-[#d4c4a1] hover:bg-[#4d2e22]/60'
                }`}
                style={labelStyle}
              >
                {link.label}
              </button>
            );
          })}
        </div>
      )}

      {showAuth && <AuthPage onClose={() => setShowAuth(false)} />}
    </>
  );
}
