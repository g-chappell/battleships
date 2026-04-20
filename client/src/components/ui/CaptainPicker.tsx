import { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { CAPTAIN_DEFS, CAPTAIN_IDS, ABILITY_DEFS } from '@shared/index';
import type { AbilityType } from '@shared/index';
import { Tooltip, TooltipContent, TooltipTrigger } from '../shadcn/tooltip';

const labelStyle = { fontFamily: "'IM Fell English SC', serif" };
const pirateStyle = { fontFamily: "'Pirata One', serif" };
const bodyStyle = { fontFamily: "'IM Fell English', serif" };

interface CaptainPickerProps {
  requiredCaptain?: string;
  forbiddenAbilities?: AbilityType[];
}

export function CaptainPicker({ requiredCaptain, forbiddenAbilities = [] }: CaptainPickerProps) {
  const selectedCaptain = useGameStore((s) => s.selectedCaptain);
  const setSelectedCaptain = useGameStore((s) => s.setSelectedCaptain);

  useEffect(() => {
    if (requiredCaptain && selectedCaptain !== requiredCaptain) {
      setSelectedCaptain(requiredCaptain);
    }
  }, [requiredCaptain, selectedCaptain, setSelectedCaptain]);

  return (
    <div className="w-full">
      {requiredCaptain ? (
        <div className="mb-2 text-center">
          <p className="text-[#a06820] text-xs uppercase tracking-[0.25em]" style={labelStyle}>
            Required Captain
          </p>
          <p className="text-[#e8dcc8]/60 text-xs mt-1 italic" style={bodyStyle}>
            This mission is locked to {CAPTAIN_DEFS[requiredCaptain]?.name ?? requiredCaptain} — other captains are unavailable.
          </p>
        </div>
      ) : (
        <p className="text-aged-gold/70 text-xs uppercase tracking-[0.25em] mb-3 text-center" style={labelStyle}>
          Choose yer Captain
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl mx-auto">
        {CAPTAIN_IDS.map((id) => {
          const captain = CAPTAIN_DEFS[id];
          const isSelected = selectedCaptain === id;
          const isLocked = !!requiredCaptain && id !== requiredCaptain;
          return (
            <button
              key={id}
              onClick={() => !isLocked && setSelectedCaptain(id)}
              disabled={isLocked}
              className={`text-left rounded-lg border-2 p-4 transition-all ${
                isLocked
                  ? 'opacity-30 cursor-not-allowed bg-coal/20 border-mahogany-light/30'
                  : isSelected
                  ? 'shadow-lg panel-glow scale-[1.02]'
                  : 'bg-coal/40 border-mahogany-light hover:bg-mahogany-light/40 hover:border-blood/60'
              }`}
              style={{
                ...(isSelected && !isLocked
                  ? { borderColor: captain.color, backgroundColor: captain.color + '18', boxShadow: `0 0 20px ${captain.color}30` }
                  : {}),
              }}
            >
              <div className="flex items-baseline gap-2 mb-1">
                {isLocked && <span className="text-xs opacity-50">🔒</span>}
                <span
                  className="text-lg font-bold"
                  style={{ ...pirateStyle, color: isLocked ? '#e8dcc840' : isSelected ? captain.color : '#e8dcc8' }}
                >
                  {captain.name}
                </span>
              </div>
              <p
                className="text-xs mb-3 leading-tight"
                style={{ ...bodyStyle, color: isLocked ? '#a0682040' : isSelected ? captain.color + 'cc' : '#a06820' }}
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
                  const isForbidden = forbiddenAbilities.includes(abilityType);
                  if (isForbidden) {
                    return (
                      <Tooltip key={abilityType}>
                        <TooltipTrigger asChild>
                          <div
                            className="text-[11px] px-2 py-1 rounded border opacity-30 cursor-not-allowed bg-coal/50 border-mahogany-light/60 text-parchment/40 line-through"
                            style={labelStyle}
                          >
                            <span className="font-bold">{def.name}</span>
                            <span className="opacity-60 ml-1">— {def.description}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>Forbidden in this mission</TooltipContent>
                      </Tooltip>
                    );
                  }
                  return (
                    <div
                      key={abilityType}
                      className={`text-[11px] px-2 py-1 rounded border ${
                        isSelected && !isLocked
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
