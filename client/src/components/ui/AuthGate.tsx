import { useState, type ReactNode } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { AuthPage } from '../../pages/AuthPage';
import { PageShell } from './PageShell';
import { Button } from './Button';
import { FONT_STYLES } from '../../styles/fonts';

const UNLOCK_FEATURES = [
  { icon: '⚔', label: 'Campaign (15 missions)' },
  { icon: '🏆', label: 'Tournaments' },
  { icon: '⚓', label: 'Clans & Chat' },
  { icon: '🛒', label: 'Ship Shop & Cosmetics' },
  { icon: '📊', label: 'Leaderboard Rankings' },
  { icon: '👥', label: 'Friends List' },
  { icon: '📈', label: 'Dashboard & Stats' },
  { icon: '💰', label: 'Earn & Spend Gold' },
];

interface AuthGateProps {
  children: ReactNode;
  featureName: string;
}

export function AuthGate({ children, featureName }: AuthGateProps) {
  const user = useAuthStore((s) => s.user);
  const setScreen = useGameStore((s) => s.setScreen);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');

  if (user) return <>{children}</>;

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto text-center">
        {/* Title */}
        <h1
          className="text-4xl md:text-5xl text-blood-bright mb-3"
          style={{ ...FONT_STYLES.pirate, textShadow: '0 0 20px rgba(196,30,58,0.4)' }}
        >
          Restricted Waters, Captain
        </h1>
        <p className="text-aged-gold text-sm tracking-widest uppercase mb-6" style={FONT_STYLES.labelSC}>
          {featureName} requires an account
        </p>

        {/* Decorative divider */}
        <div className="w-64 h-px bg-gradient-to-r from-transparent via-blood to-transparent mx-auto mb-8" />

        {/* Description */}
        <p className="text-parchment/80 text-base mb-8 max-w-lg mx-auto" style={FONT_STYLES.body}>
          Register yer name in the captain's log to unlock the full Ironclad Waters experience.
          A free account grants ye access to all these features:
        </p>

        {/* Feature grid */}
        <div className="grid grid-cols-2 gap-3 mb-10 max-w-lg mx-auto">
          {UNLOCK_FEATURES.map((f) => (
            <div
              key={f.label}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-coal/60 border border-mahogany-light text-left"
            >
              <span className="text-lg">{f.icon}</span>
              <span className="text-parchment/80 text-sm" style={FONT_STYLES.labelSC}>{f.label}</span>
            </div>
          ))}
        </div>

        {/* Decorative divider */}
        <div className="w-48 h-px bg-gradient-to-r from-transparent via-blood-bright to-transparent mx-auto mb-8" />

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-6">
          <Button
            variant="primary"
            size="lg"
            onClick={() => { setAuthMode('register'); setShowAuth(true); }}
          >
            Join the Crew
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => { setAuthMode('login'); setShowAuth(true); }}
          >
            Sign In
          </Button>
        </div>

        <button
          onClick={() => setScreen('menu')}
          className="text-parchment/40 text-sm hover:text-parchment/70 transition-colors"
          style={FONT_STYLES.labelSC}
        >
          ← Continue as Guest
        </button>
      </div>

      {showAuth && <AuthPage onClose={() => setShowAuth(false)} initialMode={authMode} />}
    </PageShell>
  );
}
