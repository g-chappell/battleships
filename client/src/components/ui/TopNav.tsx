import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useCosmeticsStore } from '../../store/cosmeticsStore';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { AuthPage } from '../../pages/AuthPage';
import { SettingsModal } from './SettingsModal';
import { IconButton } from './IconButton';
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
  const muted = useSettingsStore((s) => s.muted);
  const toggleMuted = useSettingsStore((s) => s.toggleMuted);
  const gold = useCosmeticsStore((s) => s.gold);
  const { isMobile } = useBreakpoint();

  const [showAuth, setShowAuth] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Top-left corner cluster: sound + settings icon buttons */}
      <div className="fixed top-4 left-4 z-40 flex gap-2">
        <IconButton
          label={muted ? 'Unmute' : 'Mute'}
          active={muted}
          onClick={toggleMuted}
        >
          {muted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
        </IconButton>

        <IconButton label="Settings" onClick={() => setShowSettings(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </IconButton>
      </div>

      {/* Floating centered pill navbar */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-40">
        <div
          className="flex items-center gap-1 px-3 py-2 bg-[#1a0a0a]/85 border border-[#8b0000]/60 rounded-full backdrop-blur-md"
          style={{
            boxShadow:
              '0 0 24px rgba(196, 30, 58, 0.25), inset 0 0 12px rgba(196, 30, 58, 0.12), 0 4px 20px rgba(0,0,0,0.6)',
          }}
        >
          {/* Logo */}
          <button
            onClick={() => setScreen('menu')}
            className="flex items-center gap-2 px-3 py-1 rounded-full hover:bg-[#3d1f17]/60 transition-colors"
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
                    : 'text-[#d4c4a1]/80 hover:bg-[#3d1f17]/60 hover:text-[#e8dcc8]'
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
              className="px-3 py-1.5 rounded-full text-[#d4c4a1] hover:bg-[#3d1f17]/60 transition-colors"
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

          {/* Gold pill */}
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

          {/* User / Account */}
          {user ? (
            <button
              onClick={() => setScreen('dashboard')}
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-b from-[#3d1f17] to-[#1a0a0a] border border-[#8b0000]/60 hover:border-[#c41e3a] transition-colors"
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
          className="fixed top-20 left-1/2 -translate-x-1/2 z-40 bg-[#1a0a0a]/95 border border-[#8b0000]/60 rounded-2xl backdrop-blur-md p-2 flex flex-col gap-1 min-w-[200px] panel-glow"
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
                    : 'text-[#d4c4a1] hover:bg-[#3d1f17]/60'
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
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
