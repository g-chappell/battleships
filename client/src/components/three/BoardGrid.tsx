import { useRef, useState, useCallback } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import { GRID_SIZE, CellState, type CellGrid, type Coordinate } from '@shared/types';

const CELL_SIZE = 1;
const GRID_OFFSET = -(GRID_SIZE * CELL_SIZE) / 2 + CELL_SIZE / 2;

function cellColor(state: CellState, isHovered: boolean, isPlacementPreview: boolean, isValidPlacement: boolean): string {
  if (isPlacementPreview) {
    return isValidPlacement ? '#d4a040' : '#c41e3a';
  }
  switch (state) {
    case CellState.Hit:
      return '#bb1a1a';
    case CellState.Miss:
      return '#3a607a';
    case CellState.Ship:
      return '#8a5e44';
    case CellState.Land:
      return '#7a5838';
    default:
      return isHovered ? '#5a2828' : '#2d1a2d';
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
        <meshStandardMaterial color="#3a1f1a" roughness={0.85} />
      </mesh>
      {/* Board frame trim */}
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[GRID_SIZE * CELL_SIZE + 0.6, 0.08, GRID_SIZE * CELL_SIZE + 0.6]} />
        <meshStandardMaterial color="#5a3328" roughness={0.7} metalness={0.25} />
      </mesh>
      {/* Glowing copper outline ring — makes board pop from sea */}
      <mesh position={[0, 0.0, 0]}>
        <boxGeometry args={[GRID_SIZE * CELL_SIZE + 0.85, 0.04, GRID_SIZE * CELL_SIZE + 0.85]} />
        <meshStandardMaterial
          color="#d4a040"
          emissive="#c41e3a"
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
          const displayState = showShip ? cell : cell === CellState.Ship ? CellState.Empty : cell;
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
                opacity={displayState === CellState.Empty && !isPreview ? 0.78 : 0.95}
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
            <meshStandardMaterial color="#d4a040" opacity={0.7} transparent />
          </mesh>
          <mesh position={[0, 0.02, GRID_OFFSET + i * CELL_SIZE - CELL_SIZE / 2]}>
            <boxGeometry args={[GRID_SIZE * CELL_SIZE, 0.02, 0.02]} />
            <meshStandardMaterial color="#d4a040" opacity={0.7} transparent />
          </mesh>
        </group>
      ))}

      {/* Sonar zone overlays */}
      {sonarZones.map((zone, idx) => {
        const color = zone.shipDetected ? '#e74c3c' : '#2ecc71';
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
            <mesh position={[GRID_OFFSET + zone.center.col * CELL_SIZE, 0.12, GRID_OFFSET + zone.center.row * CELL_SIZE]}>
              <ringGeometry args={[0.15, 0.25, 16]} rotation={[-Math.PI / 2, 0, 0]} />
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
          if (cell === CellState.Land) {
            return (
              <IslandCell
                key={`land-${rowIdx}-${colIdx}`}
                row={rowIdx}
                col={colIdx}
              />
            );
          }
          return null;
        })
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
        <meshStandardMaterial color="#8a6a44" roughness={0.95} />
      </mesh>
      {/* Rocky core (lower, darker) */}
      <mesh position={[0, 0.12 + heightVariation * 0.5, 0]} scale={[1, heightVariation * 4, 1]}>
        <icosahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color="#5a4030" roughness={0.85} />
      </mesh>
      {/* Optional palm tree */}
      {hasPalm && (
        <group position={[0.1, 0.2, -0.05]}>
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.025, 0.035, 0.36, 6]} />
            <meshStandardMaterial color="#3d2818" roughness={0.9} />
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
                <meshStandardMaterial color="#3a6028" roughness={0.8} />
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
            <meshStandardMaterial color="#4a3a2a" roughness={0.95} />
          </mesh>
          <mesh position={[0.18, 0.12, -0.12]}>
            <icosahedronGeometry args={[0.06, 0]} />
            <meshStandardMaterial color="#3a2a1a" roughness={0.95} />
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
        <meshStandardMaterial color="#e74c3c" emissive="#ff4444" emissiveIntensity={0.8} transparent opacity={0.6} />
      </mesh>
      {/* Fire column */}
      <mesh ref={flameRef} position={[0, 0.3, 0]}>
        <coneGeometry args={[0.2, 0.6, 8]} />
        <meshStandardMaterial color="#ff6600" emissive="#ff4400" emissiveIntensity={1} transparent opacity={0.8} />
      </mesh>
      {/* Inner flame */}
      <mesh position={[0, 0.35, 0]}>
        <coneGeometry args={[0.1, 0.4, 6]} />
        <meshStandardMaterial color="#ffcc00" emissive="#ffaa00" emissiveIntensity={1.2} transparent opacity={0.7} />
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
      <meshStandardMaterial color="#8b4513" emissive="#ff6600" emissiveIntensity={0.5} />
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
      <meshStandardMaterial color="#555555" transparent opacity={0.3} />
    </mesh>
  );
}

function MissMarker({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Splash ring */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.35, 16]} />
        <meshStandardMaterial color="#5dade2" transparent opacity={0.5} />
      </mesh>
      {/* Water droplets */}
      <mesh position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#3498db" transparent opacity={0.5} />
      </mesh>
      <mesh position={[0.15, 0.05, 0.1]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#5dade2" transparent opacity={0.4} />
      </mesh>
      <mesh position={[-0.12, 0.05, -0.08]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshStandardMaterial color="#5dade2" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}
