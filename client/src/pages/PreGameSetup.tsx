import { useGameStore } from '../store/gameStore';
import type { Difficulty } from '../store/gameStore';
import { Button } from '../components/ui/Button';
import { CaptainPicker } from '../components/ui/CaptainPicker';
import { FONT_STYLES } from '../styles/fonts';

const DIFFICULTIES: { value: Difficulty; label: string; color: string }[] = [
  { value: 'easy', label: 'Easy', color: '#a06820' },
  { value: 'medium', label: 'Medium', color: '#b87333' },
  { value: 'hard', label: 'Hard', color: '#c41e3a' },
];

export function PreGameSetup() {
  const startNewGame = useGameStore((s) => s.startNewGame);
  const setScreen = useGameStore((s) => s.setScreen);
  const difficulty = useGameStore((s) => s.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);

  return (
    <div data-testid="pregame-setup" className="w-full h-full flex flex-col items-center justify-center pt-24 pb-12 overflow-y-auto bg-gradient-to-b from-pitch via-coal to-mahogany px-4">
      <h1
        className="text-4xl md:text-5xl text-blood-bright mb-2"
        style={{ ...FONT_STYLES.pirate, textShadow: '0 0 20px rgba(196,30,58,0.4)' }}
      >
        Prepare for Battle
      </h1>
      <p className="text-aged-gold tracking-widest mb-10" style={FONT_STYLES.labelSC}>
        vs AI
      </p>

      {/* Difficulty selector */}
      <div className="text-center mb-10">
        <p className="text-aged-gold/70 text-xs uppercase tracking-[0.25em] mb-3" style={FONT_STYLES.labelSC}>
          Choose yer Difficulty
        </p>
        <div className="flex gap-3 justify-center">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.value}
              data-testid={`difficulty-${d.value}`}
              onClick={() => setDifficulty(d.value)}
              className={`px-6 py-2 text-sm rounded-full border-2 transition-all ${
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

      {/* Captain picker */}
      <div className="mb-12 w-full max-w-3xl">
        <CaptainPicker />
      </div>

      {/* Action buttons */}
      <div className="flex gap-4">
        <Button variant="ghost" size="md" onClick={() => setScreen('menu')}>
          ← Back
        </Button>
        <Button data-testid="btn-set-sail" variant="primary" size="lg" onClick={startNewGame}>
          Set Sail
        </Button>
      </div>
    </div>
  );
}
