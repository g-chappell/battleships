import { useGameStore } from '../store/gameStore';
import type { Difficulty } from '../store/gameStore';
import { AbilityType, ABILITY_DEFS } from '@shared/index';
import { Button } from '../components/ui/Button';
import { FONT_STYLES } from '../styles/fonts';

const DIFFICULTIES: { value: Difficulty; label: string; color: string }[] = [
  { value: 'easy', label: 'Easy', color: '#a06820' },
  { value: 'medium', label: 'Medium', color: '#b87333' },
  { value: 'hard', label: 'Hard', color: '#c41e3a' },
];

export function MainMenu() {
  const startNewGame = useGameStore((s) => s.startNewGame);
  const setScreen = useGameStore((s) => s.setScreen);
  const difficulty = useGameStore((s) => s.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const selectedAbilities = useGameStore((s) => s.selectedAbilityTypes);
  const toggleAbility = useGameStore((s) => s.toggleAbilitySelection);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center pt-24 overflow-y-auto bg-gradient-to-b from-pitch via-coal to-mahogany">
      {/* Hero title */}
      <div className="text-center mb-8 px-4">
        <p className="text-gold text-sm tracking-[0.4em] uppercase mb-2" style={FONT_STYLES.labelSC}>
          Welcome to
        </p>
        <h1
          className="text-7xl md:text-8xl text-blood-bright tracking-wider mb-2 leading-tight"
          style={{ ...FONT_STYLES.pirate, textShadow: '0 0 40px rgba(196, 30, 58, 0.5), 0 4px 20px rgba(0,0,0,0.9)' }}
        >
          IRONCLAD WATERS
        </h1>
        <p className="text-aged-gold text-base md:text-lg max-w-2xl mx-auto italic" style={FONT_STYLES.body}>
          Semi-Serious Pirate RP. Stylized 3D battleships, ability-driven combat, campaign of fifteen high-seas missions, and ranked multiplayer. Set sail when ready, captain.
        </p>
        <div className="mt-5 w-64 h-px bg-gradient-to-r from-transparent via-blood to-transparent mx-auto" />
        <div className="mt-1 w-48 h-px bg-gradient-to-r from-transparent via-blood-bright to-transparent mx-auto" />
      </div>

      {/* Hero CTAs — large pills, side by side */}
      <div className="flex gap-4 mb-8 flex-wrap justify-center">
        <Button variant="primary" size="lg" onClick={startNewGame}>
          ▶ Set Sail vs AI
        </Button>
        <Button variant="pill" size="lg" onClick={() => setScreen('campaign')}>
          Campaign
        </Button>
        <Button variant="pill" size="lg" onClick={() => setScreen('lobby')}>
          Multiplayer
        </Button>
      </div>

      {/* Difficulty pill chips */}
      <div className="text-center mb-6">
        <p className="text-aged-gold/70 text-xs uppercase tracking-[0.25em] mb-2" style={FONT_STYLES.labelSC}>
          Choose yer Difficulty
        </p>
        <div className="flex gap-2 justify-center">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.value}
              onClick={() => setDifficulty(d.value)}
              className={`px-5 py-1.5 text-sm rounded-full border transition-all ${
                difficulty === d.value
                  ? 'shadow-md scale-105'
                  : 'bg-coal/60 border-mahogany-light hover:bg-mahogany-light/60'
              }`}
              style={{
                ...FONT_STYLES.labelSC,
                ...(difficulty === d.value
                  ? { color: d.color, borderColor: d.color, backgroundColor: d.color + '25' }
                  : { color: '#d4c4a1' }),
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ability selector — pill chips */}
      <div className="text-center max-w-2xl px-4 mb-8">
        <p className="text-aged-gold/70 text-xs uppercase tracking-[0.25em] mb-2" style={FONT_STYLES.labelSC}>
          Pick 2 Abilities ({selectedAbilities.length}/2)
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.values(AbilityType).map((type) => {
            const def = ABILITY_DEFS[type];
            const isSelected = selectedAbilities.includes(type);
            return (
              <button
                key={type}
                onClick={() => toggleAbility(type)}
                className={`px-3 py-2 text-left rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-blood-dark/50 border-blood-bright/70 text-bone shadow-md shadow-blood-bright/20 panel-glow'
                    : 'bg-coal/40 border-mahogany-light text-parchment/60 hover:bg-mahogany-light/40 hover:border-blood/60'
                }`}
                style={FONT_STYLES.labelSC}
              >
                <div className="text-xs font-bold">{def.name}</div>
                <div className="text-[10px] opacity-70 leading-tight" style={FONT_STYLES.body}>
                  {def.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
