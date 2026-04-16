import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import type { ShotOutcome } from '@shared/index';
import { ShotResult, GRID_SIZE } from '@shared/index';
import { SCENE } from '../../styles/tokens';

const CELL_SIZE = 1;
const GRID_OFFSET = -(GRID_SIZE * CELL_SIZE) / 2 + CELL_SIZE / 2;

// Timing (seconds)
const BARREL_DESCEND = 0.35;     // barrel falls from sky to water
const PLUME_START = 0.45;        // first plume fires
const PLUME_STAGGER = 0.18;      // delay between plumes
const PLUME_LIFE = 0.9;          // individual plume animation length
const FADE_OUT = 0.4;             // total fade-out at the end

interface DepthChargeBurstProps {
  /** The 6 (or fewer) retaliatory outcomes from the store. */
  shots: ShotOutcome[];
  /** Called once the animation is fully complete so the parent can clear state. */
  onComplete: () => void;
}

/**
 * Drops a barrel on the Destroyer's own board, then staggers `shots.length`
 * plumes across the attacker's cells. Hit plumes are red, misses are blue.
 *
 * Mount inside the parent `<group position={PLAYER_POS|OPPONENT_POS}>` — the
 * component uses local coords (GRID_OFFSET + col * CELL_SIZE, …).
 */
export function DepthChargeBurst({ shots, onComplete }: DepthChargeBurstProps) {
  const startRef = useRef<number | null>(null);
  const [done, setDone] = useState(false);

  // Total duration grows with number of plumes; include head + tail.
  const totalDuration =
    PLUME_START + Math.max(0, shots.length - 1) * PLUME_STAGGER + PLUME_LIFE + FADE_OUT;

  // Auto-call onComplete after animation ends.
  useEffect(() => {
    const id = setTimeout(() => {
      setDone(true);
      onComplete();
    }, totalDuration * 1000);
    return () => clearTimeout(id);
  }, [onComplete, totalDuration]);

  if (done) return null;

  return (
    <group>
      <Barrel startRef={startRef} />
      {shots.map((shot, i) => (
        <Plume
          key={`plume-${i}-${shot.coordinate.row}-${shot.coordinate.col}`}
          shot={shot}
          delay={PLUME_START + i * PLUME_STAGGER}
          startRef={startRef}
        />
      ))}
    </group>
  );
}

function Barrel({ startRef }: { startRef: React.MutableRefObject<number | null> }) {
  const groupRef = useRef<Mesh>(null);
  const spinRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (startRef.current === null) startRef.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - startRef.current;
    const g = groupRef.current;
    if (!g) return;

    if (t <= BARREL_DESCEND) {
      // Linear fall from y=4 to y=0.2
      const k = t / BARREL_DESCEND;
      g.position.y = 4 - k * 3.8;
      g.visible = true;
    } else {
      // After landing, stay for a tick then hide (replaced by plumes)
      g.visible = t < BARREL_DESCEND + 0.15;
      g.position.y = 0.2;
    }
    // Tumbling spin during descent
    if (spinRef.current) {
      spinRef.current.rotation.x = t * 6;
      spinRef.current.rotation.z = t * 4;
    }
  });

  // Barrel positioned at the board center (row 5, col 5 approx)
  const centerX = GRID_OFFSET + 4.5 * CELL_SIZE;
  const centerZ = GRID_OFFSET + 4.5 * CELL_SIZE;

  return (
    <mesh ref={groupRef} position={[centerX, 4, centerZ]}>
      <mesh ref={spinRef}>
        <cylinderGeometry args={[0.2, 0.2, 0.45, 12]} />
        <meshStandardMaterial color="#3a2a1a" roughness={0.85} metalness={0.3} />
      </mesh>
    </mesh>
  );
}

function Plume({
  shot,
  delay,
  startRef,
}: {
  shot: ShotOutcome;
  delay: number;
  startRef: React.MutableRefObject<number | null>;
}) {
  const columnRef = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);

  const isHit = shot.result === ShotResult.Hit || shot.result === ShotResult.Sink;
  const color = isHit ? SCENE.hitFlame : SCENE.missDroplet;
  const emissive = isHit ? SCENE.hitFlameEmissive : SCENE.missDroplet;

  useFrame((state) => {
    if (startRef.current === null) return;
    const t = state.clock.elapsedTime - startRef.current - delay;
    const col = columnRef.current;
    const ring = ringRef.current;

    if (!col || !ring) return;

    if (t < 0) {
      col.visible = false;
      ring.visible = false;
      return;
    }

    const localT = Math.min(t, PLUME_LIFE) / PLUME_LIFE;

    // Column: rises fast, scales down as it falls, fades
    col.visible = true;
    col.scale.y = 0.1 + Math.sin(localT * Math.PI) * 1.3;
    col.position.y = 0.4 + localT * 0.6;
    const colMat = col.material as { opacity: number; transparent: boolean };
    colMat.transparent = true;
    colMat.opacity = Math.max(0, 1 - localT) * 0.85;

    // Ring: flat expanding ripple
    ring.visible = true;
    const ringScale = 0.3 + localT * 2.2;
    ring.scale.set(ringScale, ringScale, ringScale);
    const ringMat = ring.material as { opacity: number; transparent: boolean };
    ringMat.transparent = true;
    ringMat.opacity = Math.max(0, 1 - localT) * 0.7;
  });

  const x = GRID_OFFSET + shot.coordinate.col * CELL_SIZE;
  const z = GRID_OFFSET + shot.coordinate.row * CELL_SIZE;

  return (
    <group position={[x, 0.05, z]}>
      {/* Rising column (water or fire-tinted depending on result) */}
      <mesh ref={columnRef} position={[0, 0.4, 0]}>
        <coneGeometry args={[0.18, 1.2, 10]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={isHit ? 0.9 : 0.4}
          transparent
          opacity={0}
        />
      </mesh>
      {/* Expanding ripple ring */}
      <mesh ref={ringRef} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.3, 18]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0}
          side={2}
        />
      </mesh>
    </group>
  );
}
