import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import { ShipType, SHIP_LENGTHS, Orientation, type Coordinate } from '@shared/types';
import { useCosmeticsStore } from '../../store/cosmeticsStore';
import { getCosmetic } from '@shared/index';

const CELL_SIZE = 1;
const GRID_OFFSET = -10 * CELL_SIZE / 2 + CELL_SIZE / 2;

const SHIP_COLORS: Record<ShipType, { hull: string; accent: string }> = {
  [ShipType.Carrier]: { hull: '#9a6d40', accent: '#d4a952' },
  [ShipType.Battleship]: { hull: '#6e7d92', accent: '#c0d0e0' },
  [ShipType.Cruiser]: { hull: '#bb7a52', accent: '#f5a845' },
  [ShipType.Submarine]: { hull: '#4a5a68', accent: '#6a7a90' },
  [ShipType.Destroyer]: { hull: '#8a6a42', accent: '#ffc844' },
};

interface ShipModelProps {
  type: ShipType;
  start: Coordinate;
  orientation: Orientation;
  isSunk?: boolean;
}

export function ShipModel({ type, start, orientation, isSunk = false }: ShipModelProps) {
  const groupRef = useRef<Group>(null);
  const length = SHIP_LENGTHS[type];
  const shipSkinId = useCosmeticsStore((s) => s.equipped.shipSkin);
  const skinDef = getCosmetic(shipSkinId);
  // Skin overrides default SHIP_COLORS if it has a shipMaterial; otherwise use default per-type colors
  const colors = skinDef?.shipMaterial
    ? { hull: skinDef.shipMaterial.hull, accent: skinDef.shipMaterial.accent }
    : SHIP_COLORS[type];

  const centerRow = start.row + (orientation === Orientation.Vertical ? (length - 1) / 2 : 0);
  const centerCol = start.col + (orientation === Orientation.Horizontal ? (length - 1) / 2 : 0);

  const x = GRID_OFFSET + centerCol * CELL_SIZE;
  const z = GRID_OFFSET + centerRow * CELL_SIZE;
  const rotY = orientation === Orientation.Horizontal ? 0 : Math.PI / 2;
  const hullLen = length * CELL_SIZE * 0.88;

  useFrame((state) => {
    if (groupRef.current) {
      if (isSunk) {
        groupRef.current.rotation.z = Math.min(groupRef.current.rotation.z + 0.004, 0.35);
        groupRef.current.position.y = Math.max(groupRef.current.position.y - 0.002, -0.5);
      } else {
        const bob = Math.sin(state.clock.elapsedTime * 1.2 + start.row * 0.7 + start.col * 0.3);
        groupRef.current.position.y = 0.12 + bob * 0.04;
        groupRef.current.rotation.x = bob * 0.01;
      }
    }
  });

  const sunkColor = '#3a3a3a';

  return (
    <group ref={groupRef} position={[x, 0.12, z]} rotation={[0, rotY, 0]}>
      {/* === HULL === */}
      {/* Main hull body */}
      <mesh>
        <boxGeometry args={[hullLen, 0.22, CELL_SIZE * 0.55]} />
        <meshStandardMaterial color={isSunk ? sunkColor : colors.hull} roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Hull keel (bottom) */}
      <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[hullLen * 0.85, 0.06, CELL_SIZE * 0.35]} />
        <meshStandardMaterial color={isSunk ? '#2a2a2a' : '#3d2b1f'} roughness={0.9} />
      </mesh>

      {/* Bow (pointed front) */}
      <mesh position={[hullLen / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[CELL_SIZE * 0.28, 0.5, 4]} />
        <meshStandardMaterial color={isSunk ? sunkColor : colors.hull} roughness={0.7} metalness={0.2} />
      </mesh>

      {/* === DECK === */}
      <mesh position={[0, 0.13, 0]}>
        <boxGeometry args={[hullLen * 0.82, 0.04, CELL_SIZE * 0.45]} />
        <meshStandardMaterial color={isSunk ? '#333' : '#5d4037'} roughness={0.95} />
      </mesh>

      {/* Deck planking lines */}
      {Array.from({ length: Math.floor(hullLen * 2) }).map((_, i) => (
        <mesh key={`plank-${i}`} position={[-hullLen * 0.38 + i * 0.5, 0.16, 0]}>
          <boxGeometry args={[0.02, 0.005, CELL_SIZE * 0.42]} />
          <meshStandardMaterial color={isSunk ? '#2a2a2a' : '#4a3728'} />
        </mesh>
      ))}

      {/* === RAILINGS === */}
      {[-1, 1].map((side) => (
        <group key={`rail-${side}`}>
          <mesh position={[0, 0.2, side * CELL_SIZE * 0.25]}>
            <boxGeometry args={[hullLen * 0.75, 0.02, 0.02]} />
            <meshStandardMaterial
              color={isSunk ? '#333' : colors.accent}
              emissive={isSunk ? '#000' : colors.accent}
              emissiveIntensity={isSunk ? 0 : 0.18}
              metalness={0.6}
              roughness={0.3}
            />
          </mesh>
          {/* Rail posts */}
          {Array.from({ length: Math.max(2, length) }).map((_, i) => (
            <mesh key={`post-${side}-${i}`} position={[-hullLen * 0.35 + i * (hullLen * 0.7 / Math.max(1, length - 1)), 0.18, side * CELL_SIZE * 0.25]}>
              <boxGeometry args={[0.02, 0.08, 0.02]} />
              <meshStandardMaterial color={isSunk ? '#333' : colors.accent} metalness={0.5} />
            </mesh>
          ))}
        </group>
      ))}

      {/* === SHIP-SPECIFIC DETAILS === */}
      {type !== ShipType.Submarine && <Sails length={hullLen} isSunk={isSunk} type={type} />}
      {type === ShipType.Submarine && <SubmarineDetails length={hullLen} isSunk={isSunk} />}
      <SteamComponents length={hullLen} isSunk={isSunk} colors={colors} type={type} />
      <Cannons length={hullLen} isSunk={isSunk} colors={colors} count={type === ShipType.Battleship ? 6 : type === ShipType.Carrier ? 4 : type === ShipType.Destroyer ? 2 : 3} />
    </group>
  );
}

function Sails({ length, isSunk, type }: { length: number; isSunk: boolean; type: ShipType }) {
  const mastCount = type === ShipType.Carrier ? 3 : type === ShipType.Battleship ? 2 : 1;
  const sailHeight = type === ShipType.Carrier ? 1.2 : 0.9;

  return (
    <>
      {Array.from({ length: mastCount }).map((_, i) => {
        const xPos = mastCount === 1 ? 0 : -length * 0.25 + i * (length * 0.5 / Math.max(1, mastCount - 1));
        return (
          <group key={`mast-${i}`} position={[xPos, 0.15, 0]}>
            {/* Mast pole */}
            <mesh position={[0, sailHeight / 2 + 0.1, 0]}>
              <cylinderGeometry args={[0.025, 0.035, sailHeight + 0.2, 6]} />
              <meshStandardMaterial color={isSunk ? '#333' : '#4a3728'} roughness={0.9} />
            </mesh>
            {/* Sail */}
            <mesh position={[0, sailHeight * 0.55, 0.02]}>
              <planeGeometry args={[0.6, sailHeight * 0.6]} />
              <meshStandardMaterial
                color={isSunk ? '#444' : '#e8dcc8'}
                transparent
                opacity={isSunk ? 0.4 : 0.85}
                side={2}
              />
            </mesh>
            {/* Cross beam */}
            <mesh position={[0, sailHeight * 0.85, 0]}>
              <boxGeometry args={[0.7, 0.025, 0.025]} />
              <meshStandardMaterial color={isSunk ? '#333' : '#4a3728'} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function SubmarineDetails({ length, isSunk }: { length: number; isSunk: boolean }) {
  return (
    <>
      {/* Conning tower */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.5, 0.25, 0.3]} />
        <meshStandardMaterial color={isSunk ? '#333' : '#2d3748'} metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Periscope */}
      <mesh position={[0.1, 0.55, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.35, 6]} />
        <meshStandardMaterial color={isSunk ? '#333' : '#a0aec0'} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Propeller housing */}
      <mesh position={[-length / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.08, 0.15, 8]} />
        <meshStandardMaterial color={isSunk ? '#333' : '#b5882c'} metalness={0.7} roughness={0.3} />
      </mesh>
    </>
  );
}

function SteamComponents({ length, isSunk, type }: { length: number; isSunk: boolean; colors: { hull: string; accent: string }; type: ShipType }) {
  const stackCount = type === ShipType.Destroyer ? 2 : type === ShipType.Submarine ? 0 : 1;
  if (stackCount === 0) return null;

  return (
    <>
      {Array.from({ length: stackCount }).map((_, i) => {
        const xPos = stackCount === 1 ? -length * 0.15 : -length * 0.2 + i * 0.5;
        return (
          <group key={`stack-${i}`} position={[xPos, 0.15, 0]}>
            {/* Smokestack */}
            <mesh position={[0, 0.25, 0]}>
              <cylinderGeometry args={[0.06, 0.08, 0.4, 8]} />
              <meshStandardMaterial color={isSunk ? '#333' : '#333'} metalness={0.5} roughness={0.4} />
            </mesh>
            {/* Brass ring */}
            <mesh position={[0, 0.42, 0]}>
              <torusGeometry args={[0.07, 0.015, 8, 16]} />
              <meshStandardMaterial
                color={isSunk ? '#444' : '#d4a040'}
                metalness={0.85}
                roughness={0.2}
                emissive={isSunk ? '#000' : '#f5a845'}
                emissiveIntensity={isSunk ? 0 : 0.35}
              />
            </mesh>
            {/* Gear decoration */}
            <GearCog position={[0.12, 0.2, 0.15]} isSunk={isSunk} />
          </group>
        );
      })}
    </>
  );
}

function GearCog({ position, isSunk }: { position: [number, number, number]; isSunk: boolean }) {
  const meshRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (meshRef.current && !isSunk) {
      meshRef.current.rotation.z = state.clock.elapsedTime * 0.5;
    }
  });

  return (
    <mesh ref={meshRef} position={position} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.06, 0.015, 6, 8]} />
      <meshStandardMaterial
        color={isSunk ? '#444' : '#d4a040'}
        metalness={0.8}
        roughness={0.3}
        emissive={isSunk ? '#000' : '#f5a845'}
        emissiveIntensity={isSunk ? 0 : 0.3}
      />
    </mesh>
  );
}

function Cannons({ length, isSunk, colors, count }: { length: number; isSunk: boolean; colors: { hull: string; accent: string }; count: number }) {
  const perSide = Math.ceil(count / 2);

  return (
    <>
      {Array.from({ length: perSide }).map((_, i) => {
        const xPos = -length * 0.3 + i * (length * 0.6 / Math.max(1, perSide - 1));
        return [1, -1].map((side) => (
          <group key={`cannon-${side}-${i}`} position={[xPos, 0.12, side * 0.3]}>
            {/* Cannon barrel */}
            <mesh rotation={[Math.PI / 2, 0, Math.PI / 2 * side * -0.1]}>
              <cylinderGeometry args={[0.025, 0.03, 0.2, 6]} />
              <meshStandardMaterial color={isSunk ? '#333' : '#2c2c2c'} metalness={0.6} roughness={0.4} />
            </mesh>
            {/* Cannon base */}
            <mesh position={[0, -0.02, -side * 0.05]}>
              <boxGeometry args={[0.06, 0.04, 0.06]} />
              <meshStandardMaterial color={isSunk ? '#333' : colors.accent} metalness={0.5} />
            </mesh>
          </group>
        ));
      })}
    </>
  );
}
