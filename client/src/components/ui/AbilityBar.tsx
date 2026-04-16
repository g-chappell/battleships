import { useGameStore } from '../../store/gameStore';
import { ABILITY_DEFS, AbilityType, canUseAbility, GamePhase } from '@shared/index';
import { Tooltip, TooltipContent, TooltipTrigger } from '../shadcn/tooltip';

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
  const summonKraken = useGameStore((s) => s.summonKraken);
  const playerRitualTurnsRemaining = useGameStore((s) => s.playerRitualTurnsRemaining);

  const isPlaying = engine.phase === GamePhase.Playing || engine.phase === GamePhase.Placement;
  const isPlayerTurn = engine.currentTurn === 'player';
  const inRitual = !!(playerRitualTurnsRemaining && playerRitualTurnsRemaining > 0);

  if (!isPlaying && engine.phase !== GamePhase.Finished) return null;

  const labelStyle = { fontFamily: "'IM Fell English SC', serif" };

  return (
    <div className="mx-2 sm:mx-4 mb-4 lg:mb-2 h-16 bg-[#221210]/95 backdrop-blur-lg border border-[#c41e3a]/70 rounded-full flex flex-nowrap items-center px-3 sm:px-6 gap-2 sm:gap-3 shrink-0 panel-glow overflow-x-auto shadow-[0_0_14px_rgba(196,30,58,0.3)]">
      {playerAbilities && engine.phase === GamePhase.Playing && (
        <>
          {playerAbilities.abilityStates.map((ability) => {
            const def = ABILITY_DEFS[ability.type];
            const usable =
              canUseAbility(playerAbilities, ability.type) &&
              isPlayerTurn &&
              !isAnimating &&
              !inRitual;
            const isActive = activeAbility === ability.type;
            const onCooldown = ability.cooldownRemaining > 0;
            const exhausted = ability.usesRemaining === 0;
            const isKraken = ability.type === AbilityType.SummonKraken;

            const handleClick = () => {
              if (!usable) return;
              if (isKraken) {
                summonKraken();
                setActiveAbility(null);
              } else {
                setActiveAbility(isActive ? null : ability.type);
              }
            };

            return (
              <Tooltip key={ability.type}>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleClick}
                    disabled={!usable}
                    className={`relative h-11 px-3 sm:px-4 rounded-full border transition-all flex items-center gap-2 text-sm whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-[#8b0000]/70 border-[#c41e3a] text-[#e8dcc8]'
                        : usable
                        ? 'bg-[#4d2e22]/80 border-[#8b0000]/60 text-[#e8dcc8] hover:bg-[#5c0000]/60 hover:border-[#c41e3a]/80'
                        : 'bg-[#221210]/60 border-[#4d2e22]/40 text-[#d4c4a1]/50 cursor-not-allowed'
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
                </TooltipTrigger>
                <TooltipContent>
                  <p>{def.description}</p>
                  {onCooldown && <p className="text-parchment">Cooldown: {ability.cooldownRemaining} turn{ability.cooldownRemaining !== 1 ? 's' : ''}</p>}
                  {exhausted && <p className="text-[#c41e3a]">No uses remaining</p>}
                </TooltipContent>
              </Tooltip>
            );
          })}

          {activeAbility && (
            <span className="text-xs text-[#c41e3a] italic" style={{ fontFamily: "'IM Fell English', serif" }}>
              Click target on board
            </span>
          )}

          {sonarResult && (
            <span
              className={`text-xs font-bold px-2 py-1 rounded border ${
                sonarResult.shipDetected
                  ? 'text-[#c41e3a] bg-[#5c0000]/40 border-[#c41e3a]/50'
                  : 'text-[#a06820] bg-[#3d1f17]/40 border-[#a06820]/40'
              }`}
              style={labelStyle}
              // Surface the Silent Running asymmetry: area tint alone (without
              // a precise-reveal marker) suggests a Submarine is nearby.
              title={
                sonarResult.shipDetected && sonarResult.revealedShipCells.length === 0
                  ? 'Ship detected but not pinpointed — likely a Submarine (Silent Running).'
                  : undefined
              }
            >
              Sonar: {sonarResult.shipDetected
                ? sonarResult.revealedShipCells.length > 0
                  ? `${sonarResult.revealedShipCells.length} CELL${sonarResult.revealedShipCells.length === 1 ? '' : 'S'} REVEALED`
                  : 'SHIP DETECTED (no lock — possible Submarine)'
                : 'All Clear'}
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
