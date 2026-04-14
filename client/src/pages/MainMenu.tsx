import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { FONT_STYLES } from '../styles/fonts';

export function MainMenu() {
  const setScreen = useGameStore((s) => s.setScreen);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center pt-24 overflow-y-auto bg-gradient-to-b from-pitch via-coal to-mahogany">
      {/* Hero title */}
      <div className="text-center px-4" style={{ marginBottom: 120 }}>
        <p className="text-gold text-sm tracking-[0.4em] uppercase mb-3" style={FONT_STYLES.labelSC}>
          Welcome to
        </p>
        <h1
          className="text-7xl md:text-8xl text-blood-bright tracking-wider mb-4 leading-tight"
          style={{ ...FONT_STYLES.pirate, textShadow: '0 0 40px rgba(196, 30, 58, 0.5), 0 4px 20px rgba(0,0,0,0.9)' }}
        >
          IRONCLAD WATERS
        </h1>
        <p className="text-aged-gold text-base md:text-lg max-w-2xl mx-auto italic" style={FONT_STYLES.body}>
          Semi-Serious Pirate RP. Stylized 3D battleships, ability-driven combat, campaign of fifteen high-seas missions, and ranked multiplayer. Set sail when ready, captain.
        </p>
        <div className="mt-6 w-64 h-px bg-gradient-to-r from-transparent via-blood to-transparent mx-auto" />
        <div className="mt-1 w-48 h-px bg-gradient-to-r from-transparent via-blood-bright to-transparent mx-auto" />
      </div>

      {/* Hero CTAs — large pills, side by side */}
      <div className="flex gap-6 flex-wrap justify-center">
        <Button variant="pill" size="lg" onClick={() => setScreen('setup_ai')}>
          ▶ Set Sail vs AI
        </Button>
        <Button variant="pill" size="lg" onClick={() => setScreen('campaign')}>
          Campaign
        </Button>
        <Button variant="pill" size="lg" onClick={() => setScreen('lobby')}>
          Multiplayer
        </Button>
      </div>

      {/* Guest registration prompt */}
      {!user && (
        <Button
          variant="ghost"
          size="md"
          onClick={() => setScreen('guide')}
          className="mt-12 border border-blood/40 hover:border-blood"
          style={FONT_STYLES.labelSC}
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="opacity-60">
              <path d="M18 10V8A6 6 0 0 0 6 8v2H4v12h16V10h-2ZM8 8a4 4 0 0 1 8 0v2H8V8Z"/>
            </svg>
          }
        >
          Register to unlock Campaign, Tournaments, Clans & more
        </Button>
      )}
    </div>
  );
}
