import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { FONT_STYLES } from '../styles/fonts';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

type AdminSection = 'users' | 'seasons' | 'tournaments' | 'telemetry';

const NAV_ITEMS: { id: AdminSection; label: string; icon: string }[] = [
  { id: 'users', label: 'Users', icon: '⚓' },
  { id: 'seasons', label: 'Seasons', icon: '🌊' },
  { id: 'tournaments', label: 'Tournaments', icon: '⚔️' },
  { id: 'telemetry', label: 'Telemetry', icon: '🔭' },
];

const STUB_DESCRIPTIONS: Record<AdminSection, string> = {
  users: 'Search users, reset passwords, adjust gold, and ban accounts.',
  seasons: 'Create seasons, view standings, and manually close active seasons.',
  tournaments: 'Create tournaments, seed brackets, and advance rounds.',
  telemetry: 'View active players, games in progress, and recent match outcomes.',
};

function StubContent({ section }: { section: AdminSection }) {
  const item = NAV_ITEMS.find((n) => n.id === section)!;
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[320px] text-center gap-4">
      <div className="text-6xl">{item.icon}</div>
      <h2 className="text-3xl text-gold" style={FONT_STYLES.pirate}>{item.label}</h2>
      <p className="text-parchment/70 text-sm max-w-xs" style={FONT_STYLES.body}>
        {STUB_DESCRIPTIONS[section]}
      </p>
      <p className="text-blood/60 text-xs tracking-widest uppercase mt-2" style={FONT_STYLES.labelSC}>
        Coming soon
      </p>
    </div>
  );
}

export function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const setScreen = useGameStore((s) => s.setScreen);
  const [activeSection, setActiveSection] = useState<AdminSection>('users');

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      setScreen('dashboard');
    }
  }, [user, setScreen]);

  if (!user || user.role !== 'admin') return null;

  return (
    <div
      className="w-full h-full flex bg-gradient-to-b from-pitch via-coal to-mahogany overflow-hidden"
      style={{ paddingTop: 60 }}
    >
      {/* Left sidebar */}
      <aside className="w-52 shrink-0 flex flex-col border-r border-blood/30 bg-pitch/60 overflow-y-auto">
        <div className="px-4 py-5 border-b border-blood/30">
          <p className="text-xs tracking-widest uppercase text-blood/60" style={FONT_STYLES.labelSC}>
            Admin Panel
          </p>
          <h1 className="text-xl text-gold mt-1" style={FONT_STYLES.pirate}>
            Command Deck
          </h1>
        </div>

        <nav className="flex-1 py-3">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={[
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                  isActive
                    ? 'bg-blood/20 border-r-2 border-blood-bright text-bone'
                    : 'text-parchment/60 hover:bg-coal/60 hover:text-parchment',
                ].join(' ')}
                style={FONT_STYLES.body}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-blood/30">
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            onClick={() => setScreen('dashboard')}
          >
            ← Back
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="text-3xl">
            {NAV_ITEMS.find((n) => n.id === activeSection)?.icon}
          </span>
          <div>
            <h2
              className="text-3xl text-blood-bright"
              style={{
                ...FONT_STYLES.pirate,
                textShadow: '0 0 16px rgba(196, 30, 58, 0.4)',
              }}
            >
              {NAV_ITEMS.find((n) => n.id === activeSection)?.label}
            </h2>
            <p className="text-parchment/50 text-xs tracking-widest uppercase mt-0.5" style={FONT_STYLES.labelSC}>
              Admin › {NAV_ITEMS.find((n) => n.id === activeSection)?.label}
            </p>
          </div>
        </div>

        <Card variant="default" padding="lg">
          <StubContent section={activeSection} />
        </Card>
      </main>
    </div>
  );
}
