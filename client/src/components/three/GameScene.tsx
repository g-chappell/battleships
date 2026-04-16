import { Suspense, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Text } from '@react-three/drei';
import { CoastalTerrain } from './CoastalTerrain';
import { SCENE, COLORS } from '../../styles/tokens';
import { BoardGrid } from './BoardGrid';
import { ShipModel } from './ShipModel';
import { KrakenTentacle, SeaSerpent, Mermaid } from './Creatures';
import { useGameStore } from '../../store/gameStore';
import { useSocketStore } from '../../store/socketStore';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import {
  GamePhase,
  Orientation,
  type Coordinate,
  type Ship,
} from '@shared/index';

const BOARD_SPACING = 11.5;
const PLAYER_POS: [number, number, number] = [-BOARD_SPACING / 2, 0, 0];
const OPPONENT_POS: [number, number, number] = [BOARD_SPACING / 2, 0, 0];

export function GameScene() {
  const engine = useGameStore((s) => s.engine);
  useGameStore((s) => s.tick); // subscribe for re-renders
  const gameMode = useGameStore((s) => s.gameMode);
  const placingShipType = useGameStore((s) => s.placingShipType);
  const isAnimating = useGameStore((s) => s.isAnimating);
  const sonarHistory = useGameStore((s) => s.sonarHistory);
  const playerDeflectedCoord = useGameStore((s) => s.playerDeflectedCoord);
  const opponentDeflectedCoord = useGameStore((s) => s.opponentDeflectedCoord);
  const playerDeflectedSource = useGameStore((s) => s.playerDeflectedSource);
  const opponentDeflectedSource = useGameStore((s) => s.opponentDeflectedSource);
  const placeShip = useGameStore((s) => s.placeShip);
  const playerFire = useGameStore((s) => s.playerFire);
  const useAbility = useGameStore((s) => s.useAbility);
  const activeAbility = useGameStore((s) => s.activeAbility);
  const setActiveAbility = useGameStore((s) => s.setActiveAbility);
  const processAITurn = useGameStore((s) => s.processAITurn);
  const setAnimating = useGameStore((s) => s.setAnimating);
  const syncFromMpState = useGameStore((s) => s.syncFromMpState);
  const ambientCreatures = useGameStore((s) => s.ambientCreatures);
  const spawnCreature = useGameStore((s) => s.spawnAmbientCreature);
  const pruneCreatures = useGameStore((s) => s.pruneCreatures);

  // Multiplayer socket actions
  const mpGameState = useSocketStore((s) => s.gameState);
  const mpFire = useSocketStore((s) => s.fire);
  const mpUseAbility = useSocketStore((s) => s.useAbility);

  const mpPlacementSubmitted = useGameStore((s) => s.mpPlacementSubmitted);

  // Sync local engine from server state in multiplayer mode.
  // CRITICAL: during placement phase, before the player has submitted their
  // placements, we must NOT sync from server state — the local engine is the
  // source of truth for the player's in-progress placements. Once the player
  // has submitted, or once the game has moved past placement, server state
  // takes over.
  useEffect(() => {
    if (gameMode !== 'multiplayer' || !mpGameState) return;
    const isStillPlacingLocally =
      mpGameState.phase === 'placement' && !mpPlacementSubmitted;
    if (isStillPlacingLocally) return;
    syncFromMpState(mpGameState);
  }, [gameMode, mpGameState, mpPlacementSubmitted, syncFromMpState]);

  // Ambient creature spawn loop
  useEffect(() => {
    if (engine.phase !== GamePhase.Playing) return;
    const spawnId = setInterval(() => spawnCreature(), 9000 + Math.random() * 6000);
    const pruneId = setInterval(() => pruneCreatures(), 1000);
    return () => {
      clearInterval(spawnId);
      clearInterval(pruneId);
    };
  }, [engine.phase, spawnCreature, pruneCreatures]);

  // Kraken ritual driver. The summonKraken action swaps the turn to the
  // opponent but doesn't feed through the board-click afterShot callback, and
  // each ritual turn afterwards must auto-forfeit because the caster cannot
  // fire. This effect watches the (turn, ritualTurns) state and schedules
  // each step of the flow.
  //
  // State machine (single-player vs AI):
  //   A) ritualTurns>0 & turn=opponent → run AI turn (opponent may fire hits/misses)
  //   B) ritualTurns>0 & turn=player → auto-forfeit via advancePlayerRitual
  //   C) ritualTurns=null & krakenStrikeResult just appeared & turn=opponent → run AI turn
  //   D) ritualTurns=null & turn=player → normal gameplay (effect does nothing)
  const ritualTurns = useGameStore((s) => s.playerRitualTurnsRemaining);
  const krakenStrikeResult = useGameStore((s) => s.krakenStrikeResult);
  useEffect(() => {
    if (gameMode !== 'ai') return;
    if (engine.phase !== GamePhase.Playing) return;
    if (isAnimating) return; // don't interrupt an AI animation loop

    const hasRitual = !!(ritualTurns && ritualTurns > 0);

    // Case B: forfeit player turn, advance ritual. advancePlayerRitual will
    // switch turn→opponent, which re-triggers this effect (Case A).
    if (engine.currentTurn === 'player' && hasRitual) {
      const id = setTimeout(() => {
        useGameStore.getState().advancePlayerRitual();
      }, 1200);
      return () => clearTimeout(id);
    }

    // Case A / Case C: opponent turn while ritual active OR we just resolved
    // a strike (turn=opponent, ritualTurns=null, krakenStrikeResult set).
    // The strike case needs to kick AI just once; lastShotOutcome distinguishes
    // "came here via a shot's afterShot" from "came here via a ritual step".
    const justResolvedStrike = !hasRitual && krakenStrikeResult !== null;
    if (engine.currentTurn === 'opponent' && (hasRitual || justResolvedStrike)) {
      // Schedule the AI turn. Set isAnimating INSIDE the setTimeout so the
      // effect's own dependency on isAnimating doesn't cancel this via the
      // cleanup function when the state flips to true.
      const id = setTimeout(() => {
        setAnimating(true);
        processAITurn().then(() => {
          setTimeout(() => {
            setAnimating(false);
            // Consume the strike indicator so this effect doesn't re-fire.
            if (justResolvedStrike) {
              useGameStore.setState({ krakenStrikeResult: null });
            }
          }, 800);
        });
      }, 600);
      return () => clearTimeout(id);
    }
  }, [ritualTurns, krakenStrikeResult, gameMode, engine.phase, engine.currentTurn, isAnimating, processAITurn, setAnimating]);

  const isPlacing = engine.phase === GamePhase.Placement;
  const isPlaying = engine.phase === GamePhase.Playing;
  const isPlayerTurn = engine.currentTurn === 'player';

  const afterShot = useCallback(() => {
    // Wait for animation, then check whose turn it is
    setTimeout(() => {
      setAnimating(false);
      if (engine.phase !== GamePhase.Playing) return;

      // If it's still the player's turn (hit), let them fire again.
      if (engine.currentTurn === 'player') return;

      // It's now the opponent's turn — run AI. The ritual driver useEffect
      // takes over ritual auto-forfeit + AI chaining if a ritual is active.
      processAITurn().then(() => {
        setTimeout(() => {
          setAnimating(false);
        }, 800);
      });
    }, 1200);
  }, [engine.phase, engine.currentTurn, setAnimating, processAITurn]);

  const handlePlayerBoardClick = useCallback(
    (coord: Coordinate) => {
      if (isPlacing && placingShipType) {
        // In MP mode placement is local until "Ready" is pressed; same UX
        placeShip(coord);
      } else if (isPlaying && isPlayerTurn && !isAnimating && activeAbility) {
        if (gameMode === 'multiplayer') {
          mpUseAbility(activeAbility, coord);
          setActiveAbility(null);
        } else {
          useAbility(activeAbility, coord);
          setActiveAbility(null);
          afterShot();
        }
      }
    },
    [gameMode, isPlacing, isPlaying, isPlayerTurn, isAnimating, placingShipType, activeAbility, placeShip, useAbility, mpUseAbility, setActiveAbility, afterShot]
  );

  const handleOpponentBoardClick = useCallback(
    (coord: Coordinate) => {
      if (!isPlaying || !isPlayerTurn || isAnimating) return;

      if (gameMode === 'multiplayer') {
        if (activeAbility) {
          mpUseAbility(activeAbility, coord);
          setActiveAbility(null);
        } else {
          mpFire(coord);
        }
        return;
      }

      if (activeAbility) {
        useAbility(activeAbility, coord);
        setActiveAbility(null);
        afterShot();
        return;
      }

      const outcome = playerFire(coord);
      if (outcome) {
        afterShot();
      }
    },
    [gameMode, isPlaying, isPlayerTurn, isAnimating, activeAbility, playerFire, useAbility, mpFire, mpUseAbility, setActiveAbility, afterShot]
  );

  const playerShips = engine.playerBoard.ships;
  const opponentSunkShips = engine.opponentBoard.ships.filter(
    (s) => s.hits.size === s.cells.length
  );

  // Camera: tilted back ~60° for 3D perspective while keeping boards readable
  const cameraPos: [number, number, number] = isPlacing
    ? [0, 14, 10]
    : [0, 18, 12];
  const cameraFov = isPlacing ? 45 : 60;

  const canvasFallback = (
    <div className="w-full h-full flex items-center justify-center bg-[#0d0d0d]">
      <p className="text-[#d4c4a1]/60 text-sm" style={{ fontFamily: "'IM Fell English', serif" }}>
        3D scene unavailable
      </p>
    </div>
  );

  return (
    <div className="w-full h-full">
      <ErrorBoundary fallback={canvasFallback}>
      <Canvas
        camera={{ position: cameraPos, fov: cameraFov }}
        shadows
      >
        <Suspense fallback={null}>
          <hemisphereLight args={[SCENE.hemisphereSkySide, SCENE.hemisphereGround, 0.45]} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[15, 22, 8]} intensity={1.3} color={SCENE.directionalColor} castShadow />
          <pointLight position={[-12, 10, -5]} intensity={0.6} color={SCENE.pointRed} />
          <pointLight position={[12, 10, -5]} intensity={0.6} color={SCENE.pointGold} />
          <pointLight position={[0, 14, 8]} intensity={0.55} color={SCENE.pointWarm} />
          <fog attach="fog" args={[SCENE.fogColor, 45, 100]} />

          {/* Ocean floor — fills void beyond terrain with blue */}
          <mesh position={[0, -1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[300, 300]} />
            <meshStandardMaterial color={SCENE.cellEmpty} roughness={0.9} />
          </mesh>

          <CoastalTerrain />

          {/* Player board (left) */}
          <group position={isPlacing ? [0, 0, 0] : PLAYER_POS}>
            {/* Board label */}
            {isPlaying && (
              <Text
                position={[0, 0.5, -5.5]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.7}
                color={isPlayerTurn ? COLORS.bone : COLORS.agedGold}
                anchorX="center"
                outlineWidth={0.02}
                outlineColor={COLORS.pitch}
              >
                YOUR FLEET
              </Text>
            )}
            {/* Active board highlight (enemy turn — they target your board) */}
            {isPlaying && !isPlayerTurn && (
              <mesh position={[0, -0.2, 0]}>
                <boxGeometry args={[11, 0.05, 11]} />
                <meshStandardMaterial color={COLORS.blood} emissive={COLORS.bloodBright} emissiveIntensity={0.4} transparent opacity={0.2} />
              </mesh>
            )}
            <BoardGrid
              grid={engine.playerBoard.grid}
              showShips={true}
              interactive={isPlacing || (isPlaying && isPlayerTurn && activeAbility !== null)}
              onCellClick={handlePlayerBoardClick}
              deflectedCoord={playerDeflectedCoord}
              deflectedSource={playerDeflectedSource}
            />
            {playerShips.map((ship) => (
              <ShipModelFromShip key={ship.type} ship={ship} />
            ))}
            {/* Ambient creatures on player board */}
            {ambientCreatures.filter((c) => c.board === 'player').map((c) => {
              if (c.type === 'kraken') return <KrakenTentacle key={c.id} cell={c.cell} spawnedAt={c.spawnedAt} />;
              if (c.type === 'serpent') return <SeaSerpent key={c.id} cell={c.cell} spawnedAt={c.spawnedAt} />;
              return <Mermaid key={c.id} cell={c.cell} spawnedAt={c.spawnedAt} />;
            })}
          </group>

          {/* Opponent board (right) — only show during play */}
          {!isPlacing && (
            <group position={OPPONENT_POS}>
              {/* Board label */}
              <Text
                position={[0, 0.5, -5.5]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.7}
                color={isPlayerTurn ? COLORS.bloodBright : COLORS.agedGold}
                anchorX="center"
                outlineWidth={0.02}
                outlineColor={COLORS.pitch}
              >
                ENEMY FLEET
              </Text>
              {/* Active board highlight (player turn — you target enemy board) */}
              {isPlaying && isPlayerTurn && (
                <mesh position={[0, -0.2, 0]}>
                  <boxGeometry args={[11, 0.05, 11]} />
                  <meshStandardMaterial color={COLORS.bloodBright} emissive={COLORS.bloodBright} emissiveIntensity={0.4} transparent opacity={0.2} />
                </mesh>
              )}
              <BoardGrid
                grid={engine.opponentBoard.grid}
                showShips={false}
                interactive={isPlaying && isPlayerTurn && !isAnimating}
                onCellClick={handleOpponentBoardClick}
                sonarZones={sonarHistory}
                deflectedCoord={opponentDeflectedCoord}
                deflectedSource={opponentDeflectedSource}
              />
              {opponentSunkShips.map((ship) => (
                <ShipModelFromShip key={ship.type} ship={ship} isSunk />
              ))}
              {/* Ambient creatures on opponent board */}
              {ambientCreatures.filter((c) => c.board === 'opponent').map((c) => {
                if (c.type === 'kraken') return <KrakenTentacle key={c.id} cell={c.cell} spawnedAt={c.spawnedAt} />;
                if (c.type === 'serpent') return <SeaSerpent key={c.id} cell={c.cell} spawnedAt={c.spawnedAt} />;
                return <Mermaid key={c.id} cell={c.cell} spawnedAt={c.spawnedAt} />;
              })}
            </group>
          )}

          <OrbitControls
            maxPolarAngle={Math.PI / 3}
            minPolarAngle={0.1}
            maxDistance={32}
            minDistance={12}
            enablePan={false}
            target={[0, 0, 0]}
          />

          <Environment preset="night" />
        </Suspense>
      </Canvas>
      </ErrorBoundary>
    </div>
  );
}

function ShipModelFromShip({ ship, isSunk = false }: { ship: Ship; isSunk?: boolean }) {
  const cells = ship.cells;
  const start = cells[0];
  const orientation =
    cells.length > 1 && cells[1].row !== cells[0].row
      ? Orientation.Vertical
      : Orientation.Horizontal;

  return (
    <ShipModel
      type={ship.type}
      start={start}
      orientation={orientation}
      isSunk={isSunk}
    />
  );
}
