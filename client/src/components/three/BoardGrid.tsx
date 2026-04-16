import { useRef, useState, useCallback } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import { GRID_SIZE, CellState, type CellGrid, type Coordinate } from '@shared/types';
import { SCENE } from '../../styles/tokens';

const CELL_SIZE = 1;
const GRID_OFFSET = -(GRID_SIZE * CELL_SIZE) / 2 + CELL_SIZE / 2;

function cellColor(state: CellState, isHovered: boolean, isPlacementPreview: boolean, isValidPlacement: boolean): string {
  if (isPlacementPreview) {
    return isValidPlacement ? SCENE.cellPlacementValid : SCENE.cellPlacementInvalid;
  }
  switch (state) {
    case CellState.Hit:
      return SCENE.cellHit;
    case CellState.Miss:
      return SCENE.cellMiss;
    case CellState.Ship:
      return SCENE.cellShip;
    case CellState.Land:
      return SCENE.cellLand;
    case CellState.LandRevealed:
      return SCENE.cellLandRevealed;
    default:
      return isHovered ? SCENE.cellEmptyHover : SCENE.cellEmpty;
  }
}

interface SonarZone {
  center: Coordinate;
  shipDetected: boolean;
}

interface BoardGridProps {
  grid: CellGrid;
  showShips: boolean;
  interactive: boolean;
  onCellClick?: (coord: Coordinate) => void;
  onCellHover?: (coord: Coordinate | null) => void;
  placementPreview?: Coordinate[];
  isValidPlacement?: boolean;
  position?: [number, number, number];
  sonarZones?: SonarZone[];
  // Coordinate of the most recently deflected shot on this board. Rendered
  // as a ricochet / coastal marker depending on `deflectedSource` so the
  // player gets visual feedback even though the cell is still Ship.
  deflectedCoord?: Coordinate | null;
  deflectedSource?: 'ironclad' | 'coastal' | null;
}

export function BoardGrid({
  grid,
  showShips,
  interactive,
  onCellClick,
  onCellHover,
  placementPreview = [],
  isValidPlacement = true,
  position = [0, 0, 0],
  sonarZones = [],
  deflectedCoord = null,
  deflectedSource = null,
}: BoardGridProps) {
  const groupRef = useRef<Group>(null);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const previewSet = new Set(placementPreview.map((c) => `${c.row},${c.col}`));

  const handlePointerMove = useCallback(
    (row: number, col: number) => {
      if (!interactive) return;
      const key = `${row},${col}`;
      setHoveredCell(key);
      onCellHover?.({ row, col });
    },
    [interactive, onCellHover]
  );

  const handlePointerLeave = useCallback(() => {
    setHoveredCell(null);
    onCellHover?.(null);
  }, [onCellHover]);

  const handleClick = useCallback(
    (row: number, col: number) => {
      if (!interactive) return;
      onCellClick?.({ row, col });
    },
    [interactive, onCellClick]
  );

  return (
    <group ref={groupRef} position={position}>
      {/* Board base — dark mahogany */}
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[GRID_SIZE * CELL_SIZE + 0.4, 0.3, GRID_SIZE * CELL_SIZE + 0.4]} />
        <meshStandardMaterial color={SCENE.boardBase} roughness={0.85} />
      </mesh>
      {/* Board frame trim */}
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[GRID_SIZE * CELL_SIZE + 0.6, 0.08, GRID_SIZE * CELL_SIZE + 0.6]} />
        <meshStandardMaterial color={SCENE.boardTrim} roughness={0.7} metalness={0.25} />
      </mesh>
      {/* Glowing copper outline ring — makes board pop from sea */}
      <mesh position={[0, 0.0, 0]}>
        <boxGeometry args={[GRID_SIZE * CELL_SIZE + 0.85, 0.04, GRID_SIZE * CELL_SIZE + 0.85]} />
        <meshStandardMaterial
          color={SCENE.boardOutline}
          emissive={SCENE.boardOutlineEmissive}
          emissiveIntensity={0.45}
          transparent
          opacity={0.55}
        />
      </mesh>

      {/* Grid cells */}
      {grid.map((row, rowIdx) =>
        row.map((cell, colIdx) => {
          const key = `${rowIdx},${colIdx}`;
          const isHovered = hoveredCell === key;
          const isPreview = previewSet.has(key);
          const showShip = showShips && cell === CellState.Ship;
          // On opponent board (showShips=false): hide Ship and unrevealed Land as Empty
          const displayState = showShip ? cell
            : cell === CellState.Ship ? CellState.Empty
            : (!showShips && cell === CellState.Land) ? CellState.Empty
            : cell;
          const color = cellColor(displayState, isHovered, isPreview, isValidPlacement);

          return (
            <mesh
              key={key}
              position={[
                GRID_OFFSET + colIdx * CELL_SIZE,
                0.01,
                GRID_OFFSET + rowIdx * CELL_SIZE,
              ]}
              onPointerMove={(e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                handlePointerMove(rowIdx, colIdx);
              }}
              onPointerLeave={handlePointerLeave}
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                handleClick(rowIdx, colIdx);
              }}
            >
              <boxGeometry args={[CELL_SIZE * 0.95, 0.08, CELL_SIZE * 0.95]} />
              <meshStandardMaterial
                color={color}
                transparent
                opacity={displayState === CellState.Empty && !isPreview ? 0.92 : 0.95}
              />
            </mesh>
          );
        })
      )}

      {/* Grid lines */}
      {Array.from({ length: GRID_SIZE + 1 }).map((_, i) => (
        <group key={`line-${i}`}>
          <mesh position={[GRID_OFFSET + i * CELL_SIZE - CELL_SIZE / 2, 0.02, 0]}>
            <boxGeometry args={[0.02, 0.02, GRID_SIZE * CELL_SIZE]} />
            <meshStandardMaterial color={SCENE.gridLine} opacity={0.7} transparent />
          </mesh>
          <mesh position={[0, 0.02, GRID_OFFSET + i * CELL_SIZE - CELL_SIZE / 2]}>
            <boxGeometry args={[GRID_SIZE * CELL_SIZE, 0.02, 0.02]} />
            <meshStandardMaterial color={SCENE.gridLine} opacity={0.7} transparent />
          </mesh>
        </group>
      ))}

      {/* Sonar zone overlays */}
      {sonarZones.map((zone, idx) => {
        const color = zone.shipDetected ? SCENE.sonarShipDetected : SCENE.sonarClear;
        return (
          <group key={`sonar-${idx}`}>
            {/* 3x3 area highlight */}
            {[-1, 0, 1].flatMap((dr) =>
              [-1, 0, 1].map((dc) => {
                const r = zone.center.row + dr;
                const c = zone.center.col + dc;
                if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return null;
                return (
                  <mesh
                    key={`sonar-${idx}-${r}-${c}`}
                    position={[GRID_OFFSET + c * CELL_SIZE, 0.06, GRID_OFFSET + r * CELL_SIZE]}
                  >
                    <boxGeometry args={[CELL_SIZE * 0.92, 0.02, CELL_SIZE * 0.92]} />
                    <meshStandardMaterial
                      color={color}
                      emissive={color}
                      emissiveIntensity={0.4}
                      transparent
                      opacity={0.2}
                    />
                  </mesh>
                );
              })
            )}
            {/* Center marker */}
            <mesh position={[GRID_OFFSET + zone.center.col * CELL_SIZE, 0.12, GRID_OFFSET + zone.center.row * CELL_SIZE]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.15, 0.25, 16]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.6}
                transparent
                opacity={0.5}
                side={2}
              />
            </mesh>
          </group>
        );
      })}

      {/* Hit markers - fire pillars */}
      {grid.flatMap((row, rowIdx) =>
        row.map((cell, colIdx) => {
          if (cell === CellState.Hit) {
            return (
              <HitMarker
                key={`hit-${rowIdx}-${colIdx}`}
                position={[
                  GRID_OFFSET + colIdx * CELL_SIZE,
                  0.2,
                  GRID_OFFSET + rowIdx * CELL_SIZE,
                ]}
              />
            );
          }
          if (cell === CellState.Miss) {
            return (
              <MissMarker
                key={`miss-${rowIdx}-${colIdx}`}
                position={[
                  GRID_OFFSET + colIdx * CELL_SIZE,
                  0.1,
                  GRID_OFFSET + rowIdx * CELL_SIZE,
                ]}
              />
            );
          }
          if (cell === CellState.Land && showShips) {
            // Only show land islands on player's own board (fog-of-war)
            return (
              <IslandCell
                key={`land-${rowIdx}-${colIdx}`}
                row={rowIdx}
                col={colIdx}
              />
            );
          }
          if (cell === CellState.LandRevealed) {
            // Land that was fired upon — show island + miss overlay
            return (
              <group key={`landrev-${rowIdx}-${colIdx}`}>
                <IslandCell row={rowIdx} col={colIdx} />
                <MissMarker
                  position={[
                    GRID_OFFSET + colIdx * CELL_SIZE,
                    0.1,
                    GRID_OFFSET + rowIdx * CELL_SIZE,
                  ]}
                />
              </group>
            );
          }
          return null;
        })
      )}

      {/* Deflection marker — Ironclad armor ring OR Coastal rocky splash */}
      {deflectedCoord && (
        deflectedSource === 'coastal' ? (
          <CoastalDeflectMarker
            key={`coastal-${deflectedCoord.row}-${deflectedCoord.col}`}
            position={[
              GRID_OFFSET + deflectedCoord.col * CELL_SIZE,
              0.1,
              GRID_OFFSET + deflectedCoord.row * CELL_SIZE,
            ]}
          />
        ) : (
          <DeflectMarker
            key={`deflect-${deflectedCoord.row}-${deflectedCoord.col}`}
            position={[
              GRID_OFFSET + deflectedCoord.col * CELL_SIZE,
              0.1,
              GRID_OFFSET + deflectedCoord.row * CELL_SIZE,
            ]}
          />
        )
      )}
    </group>
  );
}

function IslandCell({ row, col }: { row: number; col: number }) {
  // Deterministic per-cell variation
  const seed = (row * 31 + col * 17) % 100;
  const heightVariation = 0.15 + (seed % 10) * 0.02;
  const rotation = (seed * 0.1) % (Math.PI * 2);
  const hasPalm = seed % 3 === 0;
  const hasRock = seed % 4 === 1;

  const x = GRID_OFFSET + col * CELL_SIZE;
  const z = GRID_OFFSET + row * CELL_SIZE;

  return (
    <group position={[x, 0.05, z]} rotation={[0, rotation, 0]}>
      {/* Sandy base — flattened sphere */}
      <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.42, 8, 6]} />
        <meshStandardMaterial color={SCENE.terrainSand} roughness={0.95} />
      </mesh>
      {/* Rocky core (lower, darker) */}
      <mesh position={[0, 0.12 + heightVariation * 0.5, 0]} scale={[1, heightVariation * 4, 1]}>
        <icosahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color={SCENE.terrainDirt} roughness={0.85} />
      </mesh>
      {/* Optional palm tree */}
      {hasPalm && (
        <group position={[0.1, 0.2, -0.05]}>
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.025, 0.035, 0.36, 6]} />
            <meshStandardMaterial color={SCENE.terrainRock} roughness={0.9} />
          </mesh>
          {/* Palm fronds */}
          {[0, 1, 2, 3, 4].map((i) => {
            const ang = (i / 5) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[Math.cos(ang) * 0.1, 0.38, Math.sin(ang) * 0.1]}
                rotation={[Math.PI / 5, ang, 0]}
              >
                <boxGeometry args={[0.18, 0.01, 0.05]} />
                <meshStandardMaterial color={SCENE.terrainGrass} roughness={0.8} />
              </mesh>
            );
          })}
        </group>
      )}
      {/* Optional rocks */}
      {hasRock && (
        <>
          <mesh position={[-0.15, 0.15, 0.1]}>
            <icosahedronGeometry args={[0.08, 0]} />
            <meshStandardMaterial color={SCENE.terrainPlanks} roughness={0.95} />
          </mesh>
          <mesh position={[0.18, 0.12, -0.12]}>
            <icosahedronGeometry args={[0.06, 0]} />
            <meshStandardMaterial color={SCENE.terrainPlanksDark} roughness={0.95} />
          </mesh>
        </>
      )}
    </group>
  );
}

function HitMarker({ position }: { position: [number, number, number] }) {
  const groupRef = useRef<Group>(null);
  const flameRef = useRef<Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (flameRef.current) {
      flameRef.current.scale.y = 0.8 + Math.sin(t * 4) * 0.3;
      flameRef.current.scale.x = 0.9 + Math.sin(t * 3.5 + 1) * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Base glow */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.35, 0.1, 12]} />
        <meshStandardMaterial color={SCENE.hitFlame} emissive={SCENE.hitFlameEmissive} emissiveIntensity={0.8} transparent opacity={0.6} />
      </mesh>
      {/* Fire column */}
      <mesh ref={flameRef} position={[0, 0.3, 0]}>
        <coneGeometry args={[0.2, 0.6, 8]} />
        <meshStandardMaterial color={SCENE.hitCore} emissive={SCENE.hitCoreEmissive} emissiveIntensity={1} transparent opacity={0.8} />
      </mesh>
      {/* Inner flame */}
      <mesh position={[0, 0.35, 0]}>
        <coneGeometry args={[0.1, 0.4, 6]} />
        <meshStandardMaterial color={SCENE.hitCenter} emissive={SCENE.hitCenterEmissive} emissiveIntensity={1.2} transparent opacity={0.7} />
      </mesh>
      {/* Smoke wisps */}
      <SmokePuff position={[0, 0.6, 0]} />
      <SmokePuff position={[0.1, 0.5, 0.1]} delay={0.5} />
      {/* Debris particles */}
      <DebrisParticle origin={position} angle={0} delay={0} />
      <DebrisParticle origin={position} angle={Math.PI * 0.4} delay={0.1} />
      <DebrisParticle origin={position} angle={Math.PI * 0.8} delay={0.2} />
      <DebrisParticle origin={position} angle={Math.PI * 1.2} delay={0.05} />
      <DebrisParticle origin={position} angle={Math.PI * 1.6} delay={0.15} />
    </group>
  );
}

function DebrisParticle({ origin, angle, delay }: { origin: [number, number, number]; angle: number; delay: number }) {
  const meshRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = (state.clock.elapsedTime + delay) % 2.5;
    if (t < 0.1) {
      meshRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;
    // Simple ballistic
    const speed = 0.6;
    const xVel = Math.cos(angle) * speed;
    const zVel = Math.sin(angle) * speed;
    const localT = t - 0.1;
    meshRef.current.position.x = xVel * localT;
    meshRef.current.position.z = zVel * localT;
    meshRef.current.position.y = 0.3 + 0.5 * localT - 0.5 * 1.5 * localT * localT;
    if (meshRef.current.position.y < -origin[1]) meshRef.current.visible = false;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.04, 4, 4]} />
      <meshStandardMaterial color={SCENE.hitDebris} emissive={SCENE.hitDebrisEmissive} emissiveIntensity={0.5} />
    </mesh>
  );
}

function SmokePuff({ position, delay = 0 }: { position: [number, number, number]; delay?: number }) {
  const meshRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      const t = (state.clock.elapsedTime + delay) % 3;
      meshRef.current.position.y = position[1] + t * 0.3;
      meshRef.current.scale.setScalar(0.1 + t * 0.15);
      (meshRef.current.material as any).opacity = Math.max(0, 0.3 - t * 0.1);
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.15, 6, 6]} />
      <meshStandardMaterial color={SCENE.missSplashRing} transparent opacity={0.3} />
    </mesh>
  );
}

function MissMarker({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Splash ring */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.35, 16]} />
        <meshStandardMaterial color={SCENE.missDroplet} transparent opacity={0.5} />
      </mesh>
      {/* Water droplets */}
      <mesh position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color={SCENE.missDropletAlt} transparent opacity={0.5} />
      </mesh>
      <mesh position={[0.15, 0.05, 0.1]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color={SCENE.missDroplet} transparent opacity={0.4} />
      </mesh>
      <mesh position={[-0.12, 0.05, -0.08]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshStandardMaterial color={SCENE.missDroplet} transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

function DeflectMarker({ position }: { position: [number, number, number] }) {
  const ringRef = useRef<Mesh>(null);
  const sparkRef = useRef<Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 2.5;
      const pulse = 0.85 + Math.sin(t * 4) * 0.15;
      ringRef.current.scale.setScalar(pulse);
    }
    if (sparkRef.current) {
      sparkRef.current.scale.setScalar(0.7 + Math.sin(t * 8) * 0.3);
    }
  });

  return (
    <group position={position}>
      {/* Armor plate ring — rotates slowly */}
      <mesh ref={ringRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.38, 20]} />
        <meshStandardMaterial
          color={SCENE.deflectRing}
          emissive={SCENE.deflectRingEmissive}
          emissiveIntensity={0.8}
          transparent
          opacity={0.85}
          side={2}
        />
      </mesh>
      {/* Central spark — pulses */}
      <mesh ref={sparkRef} position={[0, 0.15, 0]}>
        <octahedronGeometry args={[0.12, 0]} />
        <meshStandardMaterial
          color={SCENE.deflectCore}
          emissive={SCENE.deflectCoreEmissive}
          emissiveIntensity={1.2}
          transparent
          opacity={0.95}
        />
      </mesh>
      {/* Streaks: four small triangles radiating outward */}
      {[0, 1, 2, 3].map((i) => {
        const ang = (i / 4) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(ang) * 0.28, 0.1, Math.sin(ang) * 0.28]}
            rotation={[0, ang, 0]}
          >
            <coneGeometry args={[0.04, 0.18, 3]} />
            <meshStandardMaterial
              color={SCENE.deflectCore}
              emissive={SCENE.deflectCoreEmissive}
              emissiveIntensity={1}
              transparent
              opacity={0.8}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * Coastal Cover deflect marker — rocky-shore splash with reef shards + water
 * spray. Visually distinct from the Ironclad copper ring so players can tell
 * which trait absorbed the shot at a glance.
 */
function CoastalDeflectMarker({ position }: { position: [number, number, number] }) {
  const rockRef = useRef<Mesh>(null);
  const sprayRef = useRef<Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (rockRef.current) {
      // Gentle bob to suggest wet rock re-emerging from spray
      rockRef.current.position.y = 0.06 + Math.sin(t * 2) * 0.02;
    }
    if (sprayRef.current) {
      const pulse = 0.8 + Math.sin(t * 3) * 0.2;
      sprayRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={position}>
      {/* Sandy base ring */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.38, 16]} />
        <meshStandardMaterial
          color={SCENE.coastalSand}
          transparent
          opacity={0.55}
          side={2}
        />
      </mesh>
      {/* Central rock outcrop — jagged */}
      <mesh ref={rockRef} position={[0, 0.06, 0]}>
        <icosahedronGeometry args={[0.14, 0]} />
        <meshStandardMaterial
          color={SCENE.coastalRock}
          roughness={0.95}
        />
      </mesh>
      {/* Secondary smaller shards around the outcrop */}
      {[0, 1, 2].map((i) => {
        const ang = (i / 3) * Math.PI * 2 + 0.3;
        return (
          <mesh
            key={i}
            position={[Math.cos(ang) * 0.22, 0.05, Math.sin(ang) * 0.22]}
            rotation={[0.3, ang, 0]}
          >
            <icosahedronGeometry args={[0.06, 0]} />
            <meshStandardMaterial
              color={SCENE.coastalRock}
              roughness={0.9}
            />
          </mesh>
        );
      })}
      {/* Water spray halo — expanding sphere */}
      <mesh ref={sprayRef} position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.25, 10, 8]} />
        <meshStandardMaterial
          color={SCENE.coastalSpray}
          transparent
          opacity={0.35}
        />
      </mesh>
    </group>
  );
}
