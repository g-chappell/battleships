import { useGameStore } from '../../store/gameStore';
import { CAPTAIN_DEFS, CAPTAIN_IDS, ABILITY_DEFS } from '@shared/index';

const labelStyle = { fontFamily: "'IM Fell English SC', serif" };
const pirateStyle = { fontFamily: "'Pirata One', serif" };
const bodyStyle = { fontFamily: "'IM Fell English', serif" };

export function CaptainPicker() {
  const selectedCaptain = useGameStore((s) => s.selectedCaptain);
  const setSelectedCaptain = useGameStore((s) => s.setSelectedCaptain);

  return (
    <div className="w-full">
      <p className="text-aged-gold/70 text-xs uppercase tracking-[0.25em] mb-3 text-center" style={labelStyle}>
        Choose yer Captain
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-3xl mx-auto">
        {CAPTAIN_IDS.map((id) => {
          const captain = CAPTAIN_DEFS[id];
          const isSelected = selectedCaptain === id;
          return (
            <button
              key={id}
              onClick={() => setSelectedCaptain(id)}
              className={`text-left rounded-lg border-2 p-4 transition-all ${
                isSelected
                  ? 'shadow-lg panel-glow scale-[1.02]'
                  : 'bg-coal/40 border-mahogany-light hover:bg-mahogany-light/40 hover:border-blood/60'
              }`}
              style={{
                ...(isSelected
                  ? { borderColor: captain.color, backgroundColor: captain.color + '18', boxShadow: `0 0 20px ${captain.color}30` }
                  : {}),
              }}
            >
              <div className="flex items-baseline gap-2 mb-1">
                <span
                  className="text-lg font-bold"
                  style={{ ...pirateStyle, color: isSelected ? captain.color : '#e8dcc8' }}
                >
                  {captain.name}
                </span>
              </div>
              <p
                className="text-xs mb-3 leading-tight"
                style={{ ...bodyStyle, color: isSelected ? captain.color + 'cc' : '#a06820' }}
              >
                {captain.title}
              </p>
              <p
                className="text-[11px] text-parchment/50 mb-3 italic leading-snug"
                style={bodyStyle}
              >
                {captain.description}
              </p>
              <div className="flex flex-col gap-1">
                {captain.abilities.map((abilityType) => {
                  const def = ABILITY_DEFS[abilityType];
                  return (
                    <div
                      key={abilityType}
                      className={`text-[11px] px-2 py-1 rounded border ${
                        isSelected
                          ? 'bg-blood-dark/30 border-blood-bright/40 text-bone/90'
                          : 'bg-coal/50 border-mahogany-light/60 text-parchment/60'
                      }`}
                      style={labelStyle}
                    >
                      <span className="font-bold">{def.name}</span>
                      <span className="opacity-60 ml-1">— {def.description}</span>
                    </div>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
