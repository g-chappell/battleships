import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import type { Coordinate } from '@shared/index';

const CELL_SIZE = 1;
const GRID_OFFSET = -10 * CELL_SIZE / 2 + CELL_SIZE / 2;

function cellToWorld(c: Coordinate): [number, number, number] {
  return [GRID_OFFSET + c.col * CELL_SIZE, 0, GRID_OFFSET + c.row * CELL_SIZE];
}

/**
 * Kraken Tentacle: a curved segmented tentacle that emerges from a cell
 * and waves around. Used for ambient and attack modes.
 */
export function KrakenTentacle({
  cell,
  spawnedAt,
  attack = false,
}: {
  cell: Coordinate;
  spawnedAt: number;
  attack?: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const segments = 6;
  const [x, , z] = cellToWorld(cell);

  useFrame((state) => {
    if (!groupRef.current) return;
    const elapsed = (state.clock.elapsedTime * 1000 - spawnedAt) / 1000;
    // Emerge: rises in first 0.6s, sustains, sinks in last 0.6s
    const lifetime = attack ? 1.6 : 6;
    const t = elapsed / lifetime;
    let height = 0;
    if (elapsed < 0.6) height = elapsed / 0.6;
    else if (elapsed > lifetime - 0.6) height = Math.max(0, (lifetime - elapsed) / 0.6);
    else height = 1;
    groupRef.current.scale.y = height;
    groupRef.current.position.y = -1 + height * 1;
    // Sway
    groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.5) * 0.15;
    groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 1.2) * 0.1;
  });

  const baseColor = attack ? '#3a0a0a' : '#2a3a28';
  const accent = attack ? '#c41e3a' : '#5a4a2a';
  const radius = attack ? 0.18 : 0.12;
  const totalHeight = attack ? 2.2 : 1.6;
  const segHeight = totalHeight / segments;

  return (
    <group ref={groupRef} position={[x, -1, z]}>
      {/* Tentacle segments — taper toward tip */}
      {Array.from({ length: segments }).map((_, i) => {
        const r1 = radius * (1 - i / segments * 0.7);
        const r2 = radius * (1 - (i + 1) / segments * 0.7);
        const y = i * segHeight + segHeight / 2;
        // Curve segments outward with sin
        const xOff = Math.sin(i * 0.5) * 0.15;
        return (
          <mesh key={i} position={[xOff, y, 0]} rotation={[0, 0, Math.sin(i * 0.4) * 0.15]}>
            <cylinderGeometry args={[r2, r1, segHeight, 8]} />
            <meshStandardMaterial
              color={baseColor}
              emissive={attack ? accent : '#000000'}
              emissiveIntensity={attack ? 0.4 : 0}
              roughness={0.85}
            />
          </mesh>
        );
      })}
      {/* Suckers — small spheres on the tentacle */}
      {Array.from({ length: 4 }).map((_, i) => (
        <mesh key={`sucker-${i}`} position={[radius * 0.7, segHeight * (i + 1), 0]}>
          <sphereGeometry args={[radius * 0.3, 6, 6]} />
          <meshStandardMaterial color={accent} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Sea Serpent: a row of small spheres slithering in a sine wave through cells.
 */
export function SeaSerpent({ cell, spawnedAt }: { cell: Coordinate; spawnedAt: number }) {
  const groupRef = useRef<Group>(null);
  const [x, , z] = cellToWorld(cell);

  useFrame((state) => {
    if (!groupRef.current) return;
    const elapsed = (state.clock.elapsedTime * 1000 - spawnedAt) / 1000;
    const lifetime = 8;
    let visible = 1;
    if (elapsed < 0.5) visible = elapsed / 0.5;
    else if (elapsed > lifetime - 0.5) visible = Math.max(0, (lifetime - elapsed) / 0.5);
    groupRef.current.scale.setScalar(visible);
    groupRef.current.position.y = -0.4 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
  });

  return (
    <group ref={groupRef} position={[x, -0.4, z]}>
      {Array.from({ length: 8 }).map((_, i) => {
        const localX = (i - 4) * 0.18;
        const localZ = Math.sin(i * 0.7) * 0.12;
        const r = 0.12 - i * 0.008;
        return (
          <mesh key={i} position={[localX, 0.18, localZ]}>
            <sphereGeometry args={[r, 6, 6]} />
            <meshStandardMaterial color="#1a3a28" roughness={0.6} metalness={0.1} />
          </mesh>
        );
      })}
      {/* Head with red eyes */}
      <mesh position={[-4 * 0.18, 0.22, 0]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#2a4a30" roughness={0.6} />
      </mesh>
      <mesh position={[-4 * 0.18 - 0.08, 0.26, 0.08]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#c41e3a" emissive="#c41e3a" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[-4 * 0.18 - 0.08, 0.26, -0.08]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#c41e3a" emissive="#c41e3a" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

/**
 * Mermaid: simple humanoid that surfaces, waves, and dives.
 */
export function Mermaid({ cell, spawnedAt }: { cell: Coordinate; spawnedAt: number }) {
  const groupRef = useRef<Group>(null);
  const armRef = useRef<Mesh>(null);
  const [x, , z] = cellToWorld(cell);

  useFrame((state) => {
    if (!groupRef.current) return;
    const elapsed = (state.clock.elapsedTime * 1000 - spawnedAt) / 1000;
    const lifetime = 5;
    let visible = 1;
    if (elapsed < 0.5) visible = elapsed / 0.5;
    else if (elapsed > lifetime - 0.5) visible = Math.max(0, (lifetime - elapsed) / 0.5);
    groupRef.current.scale.setScalar(visible);
    groupRef.current.position.y = -0.3 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
    if (armRef.current) {
      armRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 4) * 0.6 - 0.5;
    }
  });

  return (
    <group ref={groupRef} position={[x, -0.3, z]}>
      {/* Tail */}
      <mesh position={[0, 0.12, 0]} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.12, 0.32, 6]} />
        <meshStandardMaterial color="#1a4040" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.18, 8]} />
        <meshStandardMaterial color="#d4a080" roughness={0.6} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.46, 0]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshStandardMaterial color="#e8c0a0" roughness={0.5} />
      </mesh>
      {/* Hair */}
      <mesh position={[0, 0.48, -0.04]}>
        <sphereGeometry args={[0.1, 6, 6]} />
        <meshStandardMaterial color="#3a1a08" roughness={0.85} />
      </mesh>
      {/* Waving arm */}
      <mesh ref={armRef} position={[0.08, 0.36, 0]}>
        <cylinderGeometry args={[0.02, 0.025, 0.18, 6]} />
        <meshStandardMaterial color="#e8c0a0" roughness={0.6} />
      </mesh>
    </group>
  );
}
