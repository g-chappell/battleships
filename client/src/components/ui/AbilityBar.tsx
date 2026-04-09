import { useGameStore } from '../../store/gameStore';
import { ABILITY_DEFS, canUseAbility, GamePhase } from '@shared/index';

export function AbilityBar() {
  const engine = useGameStore((s) => s.engine);
  useGameStore((s) => s.tick); // subscribe for re-renders
  const playerAbilities = useGameStore((s) => s.playerAbilities);
  const activeAbility = useGameStore((s) => s.activeAbility);
  const setActiveAbility = useGameStore((s) => s.setActiveAbility);
  const isAnimating = useGameStore((s) => s.isAnimating);
  const sonarResult = useGameStore((s) => s.sonarResult);
  const resetGame = useGameStore((s) => s.resetGame);
  const setScreen = useGameStore((s) => s.setScreen);

  const isPlaying = engine.phase === GamePhase.Playing || engine.phase === GamePhase.Placement;
  const isPlayerTurn = engine.currentTurn === 'player';

  if (!isPlaying && engine.phase !== GamePhase.Finished) return null;

  const labelStyle = { fontFamily: "'IM Fell English SC', serif" };

  return (
    <div className="mx-4 mb-4 h-14 bg-[#1a0a0a]/85 backdrop-blur-md border border-[#8b0000]/60 rounded-full flex items-center px-6 gap-3 shrink-0 panel-glow">
      {playerAbilities && engine.phase === GamePhase.Playing && (
        <>
          {playerAbilities.abilityStates.map((ability) => {
            const def = ABILITY_DEFS[ability.type];
            const usable = canUseAbility(playerAbilities, ability.type) && isPlayerTurn && !isAnimating;
            const isActive = activeAbility === ability.type;
            const onCooldown = ability.cooldownRemaining > 0;
            const exhausted = ability.usesRemaining === 0;

            return (
              <button
                key={ability.type}
                onClick={() => usable && setActiveAbility(isActive ? null : ability.type)}
                disabled={!usable}
                className={`relative h-10 px-4 rounded-full border transition-all flex items-center gap-2 text-xs ${
                  isActive
                    ? 'bg-[#8b0000]/40 border-[#c41e3a] text-[#c41e3a]'
                    : usable
                    ? 'bg-[#3d1f17]/70 border-[#8b0000]/40 text-[#e8dcc8] hover:bg-[#5c0000]/40 hover:border-[#c41e3a]/60'
                    : 'bg-[#1a0a0a]/60 border-[#3d1f17]/40 text-[#d4c4a1]/25 cursor-not-allowed'
                }`}
                style={labelStyle}
              >
                <span className="font-bold">{def.name}</span>
                {onCooldown && (
                  <span className="bg-[#c41e3a] text-[#0d0606] text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {ability.cooldownRemaining}
                  </span>
                )}
                {exhausted && <span className="text-[#c41e3a] text-[10px]">USED</span>}
              </button>
            );
          })}

          {activeAbility && (
            <span className="text-xs text-[#c41e3a] italic" style={{ fontFamily: "'IM Fell English', serif" }}>
              Click target on board
            </span>
          )}

          {sonarResult && (
            <span className={`text-xs font-bold px-2 py-1 rounded border ${
              sonarResult.shipDetected
                ? 'text-[#c41e3a] bg-[#5c0000]/40 border-[#c41e3a]/50'
                : 'text-[#a06820] bg-[#3d1f17]/40 border-[#a06820]/40'
            }`} style={labelStyle}>
              Sonar: {sonarResult.shipDetected ? 'SHIP DETECTED' : 'All Clear'}
            </span>
          )}
        </>
      )}

      <div className="flex-1" />

      <button
        onClick={() => setScreen('menu')}
        className="h-8 px-4 text-xs text-[#d4c4a1]/60 hover:text-[#e8dcc8] hover:bg-[#3d1f17]/60 rounded-full transition-colors"
        style={labelStyle}
      >
        Menu
      </button>
      <button
        onClick={resetGame}
        className="h-8 px-4 text-xs bg-[#5c0000]/60 text-[#e8dcc8]/80 rounded-full border border-[#8b0000]/60 hover:bg-[#8b0000] hover:text-[#e8dcc8] transition-colors"
        style={labelStyle}
      >
        Resign
      </button>
    </div>
  );
}
