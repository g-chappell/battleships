import { Suspense, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Text } from '@react-three/drei';
import { Ocean } from './Ocean';
import { CoastalTerrain } from './CoastalTerrain';
import { BoardGrid } from './BoardGrid';
import { ShipModel } from './ShipModel';
import { KrakenTentacle, SeaSerpent, Mermaid } from './Creatures';
import { useGameStore } from '../../store/gameStore';
import { useSocketStore } from '../../store/socketStore';
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
  const _tick = useGameStore((s) => s.tick);
  const gameMode = useGameStore((s) => s.gameMode);
  const placingShipType = useGameStore((s) => s.placingShipType);
  const isAnimating = useGameStore((s) => s.isAnimating);
  const sonarHistory = useGameStore((s) => s.sonarHistory);
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
  const mpSubmitPlacement = useSocketStore((s) => s.submitPlacement);

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

  const isPlacing = engine.phase === GamePhase.Placement;
  const isPlaying = engine.phase === GamePhase.Playing;
  const isPlayerTurn = engine.currentTurn === 'player';

  const afterShot = useCallback(() => {
    // Wait for animation, then check whose turn it is
    setTimeout(() => {
      setAnimating(false);
      if (engine.phase !== GamePhase.Playing) return;

      // If it's still the player's turn (hit), let them fire again
      if (engine.currentTurn === 'player') return;

      // It's now the opponent's turn — run AI
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

  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: cameraPos, fov: cameraFov }}
        shadows
      >
        <Suspense fallback={null}>
          <hemisphereLight args={['#5a2018', '#1a0606', 0.45]} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[15, 22, 8]} intensity={1.3} color="#d4a060" castShadow />
          <pointLight position={[-12, 10, -5]} intensity={0.6} color="#c41e3a" />
          <pointLight position={[12, 10, -5]} intensity={0.6} color="#d4a040" />
          <pointLight position={[0, 14, 8]} intensity={0.55} color="#e8a060" />
          <fog attach="fog" args={['#1a0a08', 38, 85]} />

          <Ocean />
          <CoastalTerrain />

          {/* Player board (left) */}
          <group position={isPlacing ? [0, 0, 0] : PLAYER_POS}>
            {/* Board label */}
            {isPlaying && (
              <Text
                position={[0, 0.5, -5.5]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.7}
                color={isPlayerTurn ? '#e8dcc8' : '#a06820'}
                anchorX="center"
                outlineWidth={0.02}
                outlineColor="#0d0606"
              >
                YOUR FLEET
              </Text>
            )}
            {/* Active board highlight (enemy turn — they target your board) */}
            {isPlaying && !isPlayerTurn && (
              <mesh position={[0, -0.2, 0]}>
                <boxGeometry args={[11, 0.05, 11]} />
                <meshStandardMaterial color="#8b0000" emissive="#c41e3a" emissiveIntensity={0.4} transparent opacity={0.2} />
              </mesh>
            )}
            <BoardGrid
              grid={engine.playerBoard.grid}
              showShips={true}
              interactive={isPlacing || (isPlaying && isPlayerTurn && activeAbility !== null)}
              onCellClick={handlePlayerBoardClick}
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
                color={isPlayerTurn ? '#c41e3a' : '#a06820'}
                anchorX="center"
                outlineWidth={0.02}
                outlineColor="#0d0606"
              >
                ENEMY FLEET
              </Text>
              {/* Active board highlight (player turn — you target enemy board) */}
              {isPlaying && isPlayerTurn && (
                <mesh position={[0, -0.2, 0]}>
                  <boxGeometry args={[11, 0.05, 11]} />
                  <meshStandardMaterial color="#c41e3a" emissive="#c41e3a" emissiveIntensity={0.4} transparent opacity={0.2} />
                </mesh>
              )}
              <BoardGrid
                grid={engine.opponentBoard.grid}
                showShips={false}
                interactive={isPlaying && isPlayerTurn && !isAnimating}
                onCellClick={handleOpponentBoardClick}
                sonarZones={sonarHistory}
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
