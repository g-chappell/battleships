import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, Group } from 'three';
import type { Coordinate } from '@shared/index';
import { GRID_SIZE } from '@shared/index';

const CELL_SIZE = 1;
const GRID_OFFSET = -(GRID_SIZE * CELL_SIZE) / 2 + CELL_SIZE / 2;

// Phases (seconds, cumulative)
const BUBBLES_UNTIL = 0.6;      // bubbles rise from every target cell
const EMERGE_UNTIL = 1.8;       // main tentacle rises
const GRAB_UNTIL = 2.8;         // tentacle coils, ship shakes
const SINK_UNTIL = 3.8;          // everything descends, fades
const TOTAL_DURATION = SINK_UNTIL;

interface KrakenStrikeProps {
  /** Cells of the sunk ship to target. */
  cells: Coordinate[];
  /** Called once the animation completes so the parent can clear store state. */
  onComplete: () => void;
}

/**
 * Kraken rises from the target cells, grabs the ship, drags it down.
 *
 * Mount inside the `<group position={OPPONENT_POS}>` (for player-cast) or
 * `<group position={PLAYER_POS}>` (for opponent-cast). Uses local board
 * coords (GRID_OFFSET + col, GRID_OFFSET + row).
 *
 * When `cells` is empty, renders a recoil/warded animation (small tentacle
 * flinches back into the water) to show Kraken Ward blocked the ritual.
 */
export function KrakenStrike({ cells, onComplete }: KrakenStrikeProps) {
  const startRef = useRef<number | null>(null);
  const [done, setDone] = useState(false);
  const isWarded = cells.length === 0;

  // Auto-cleanup after animation.
  useEffect(() => {
    const duration = isWarded ? 1.8 : TOTAL_DURATION;
    const id = setTimeout(() => {
      setDone(true);
      onComplete();
    }, duration * 1000 + 200);
    return () => clearTimeout(id);
  }, [onComplete, isWarded]);

  if (done) return null;

  // Compute center of the target ship (for the big tentacle position).
  // For warded: use board center so the recoil happens on-stage.
  const center = centerOfCells(cells) ?? { row: 4.5, col: 4.5 };

  return (
    <group>
      {/* Main tentacle — single rising/grabbing entity */}
      <MainTentacle startRef={startRef} center={center} warded={isWarded} />
      {/* Bubbles at each target cell (phase 1) */}
      {!isWarded && cells.map((c, i) => (
        <BubbleColumn
          key={`bubble-${i}-${c.row}-${c.col}`}
          cell={c}
          delay={i * 0.04}
          startRef={startRef}
        />
      ))}
      {/* Ink cloud — surrounds the target after grab */}
      {!isWarded && <InkCloud startRef={startRef} center={center} />}
    </group>
  );
}

function centerOfCells(cells: Coordinate[]): { row: number; col: number } | null {
  if (cells.length === 0) return null;
  let sumR = 0;
  let sumC = 0;
  for (const c of cells) {
    sumR += c.row;
    sumC += c.col;
  }
  return { row: sumR / cells.length, col: sumC / cells.length };
}

function MainTentacle({
  startRef,
  center,
  warded,
}: {
  startRef: React.MutableRefObject<number | null>;
  center: { row: number; col: number };
  warded: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<Mesh>(null);
  const tipRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (startRef.current === null) startRef.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - startRef.current;
    const g = groupRef.current;
    const body = bodyRef.current;
    const tip = tipRef.current;
    if (!g || !body || !tip) return;

    if (warded) {
      // Brief rise then recoil back beneath the waves
      if (t < 0.3) {
        const k = t / 0.3;
        g.position.y = -1.5 + k * 1.0; // to y ≈ -0.5
        body.scale.y = 0.4 + k * 0.4;
      } else if (t < 1.2) {
        // Shake/flinch
        g.position.y = -0.5;
        g.rotation.z = Math.sin(t * 14) * 0.15;
      } else {
        // Sink back
        const k = Math.min(1, (t - 1.2) / 0.6);
        g.position.y = -0.5 - k * 1.5;
        const mat = body.material as { opacity: number; transparent: boolean };
        mat.transparent = true;
        mat.opacity = Math.max(0, 1 - k);
      }
      return;
    }

    // Full strike animation
    if (t < BUBBLES_UNTIL) {
      // Hidden underwater; small shake on the surface from bubbles
      g.visible = false;
    } else if (t < EMERGE_UNTIL) {
      // Rising tentacle — scales from 0 to full height, lifts out of water
      const k = (t - BUBBLES_UNTIL) / (EMERGE_UNTIL - BUBBLES_UNTIL);
      const eased = easeOutBack(k);
      g.visible = true;
      g.position.y = -2.5 + eased * 3.2; // rises to y ≈ 0.7
      body.scale.y = 0.5 + eased * 2.5;
      g.rotation.z = Math.sin(t * 3) * 0.08;
      tip.position.y = 1 + eased * 1.2;
    } else if (t < GRAB_UNTIL) {
      // Tentacle grips — shake the ship (handled externally), coil animation
      g.visible = true;
      g.position.y = 0.7;
      const coil = (t - EMERGE_UNTIL) / (GRAB_UNTIL - EMERGE_UNTIL);
      body.scale.y = 3.0 - coil * 0.8;
      g.rotation.z = Math.sin(t * 8) * 0.18;
      tip.position.y = 2.2 - coil * 0.6;
      tip.rotation.z = Math.sin(t * 10) * 0.4;
    } else {
      // Sink: tentacle + ship descend and fade
      const k = Math.min(1, (t - GRAB_UNTIL) / (SINK_UNTIL - GRAB_UNTIL));
      g.position.y = 0.7 - k * 3;
      const mat = body.material as { opacity: number; transparent: boolean };
      mat.transparent = true;
      mat.opacity = Math.max(0, 1 - k);
      const tipMat = tip.material as { opacity: number; transparent: boolean };
      tipMat.transparent = true;
      tipMat.opacity = Math.max(0, 1 - k);
    }
  });

  const x = GRID_OFFSET + center.col * CELL_SIZE;
  const z = GRID_OFFSET + center.row * CELL_SIZE;

  return (
    <group ref={groupRef} position={[x, -2, z]}>
      {/* Tentacle body — tall cone stretched on scale.y */}
      <mesh ref={bodyRef} position={[0, 1, 0]} scale={[1, 0.5, 1]}>
        <coneGeometry args={[0.35, 2.2, 12]} />
        <meshStandardMaterial
          color="#2a1838"
          emissive="#4a2858"
          emissiveIntensity={0.3}
          roughness={0.9}
        />
      </mesh>
      {/* Tip — smaller cone that lunges forward */}
      <mesh ref={tipRef} position={[0, 2.2, 0]}>
        <coneGeometry args={[0.22, 0.9, 10]} />
        <meshStandardMaterial
          color="#1a0e24"
          emissive="#602080"
          emissiveIntensity={0.5}
          roughness={0.85}
        />
      </mesh>
      {/* Suckers along the body (just three small discs) */}
      {[0.4, 0.9, 1.4].map((y) => (
        <mesh key={y} position={[0.3, y, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.06, 0.03, 8]} />
          <meshStandardMaterial color="#c8b4d0" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function BubbleColumn({
  cell,
  delay,
  startRef,
}: {
  cell: Coordinate;
  delay: number;
  startRef: React.MutableRefObject<number | null>;
}) {
  const groupRef = useRef<Group>(null);

  useFrame((state) => {
    if (startRef.current === null) return;
    const t = state.clock.elapsedTime - startRef.current - delay;
    const g = groupRef.current;
    if (!g) return;

    if (t < 0 || t > BUBBLES_UNTIL + 0.3) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const k = Math.min(1, t / BUBBLES_UNTIL);
    // Bob the whole column slightly
    g.position.y = 0.05 + Math.sin(t * 6) * 0.02;
    // Bubbles fade out at the end
    const fade = 1 - Math.max(0, (t - BUBBLES_UNTIL) / 0.3);
    g.children.forEach((child, i) => {
      const mesh = child as Mesh;
      mesh.position.y = 0.1 + ((k + i * 0.2) % 1) * 0.5;
      const mat = mesh.material as { opacity: number; transparent: boolean };
      mat.transparent = true;
      mat.opacity = 0.5 * fade;
    });
  });

  const x = GRID_OFFSET + cell.col * CELL_SIZE;
  const z = GRID_OFFSET + cell.row * CELL_SIZE;

  return (
    <group ref={groupRef} position={[x, 0, z]}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[(i % 2) * 0.1 - 0.05, 0.1 + i * 0.12, (i % 2) * 0.1 - 0.05]}>
          <sphereGeometry args={[0.05 + i * 0.01, 6, 6]} />
          <meshStandardMaterial color="#6a88a8" transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function InkCloud({
  startRef,
  center,
}: {
  startRef: React.MutableRefObject<number | null>;
  center: { row: number; col: number };
}) {
  const ref = useRef<Mesh>(null);

  useFrame((state) => {
    if (startRef.current === null) return;
    const t = state.clock.elapsedTime - startRef.current;
    const m = ref.current;
    if (!m) return;

    // Appears during grab, lingers through sink
    if (t < EMERGE_UNTIL) {
      m.visible = false;
      return;
    }
    m.visible = true;
    const k = Math.min(1, (t - EMERGE_UNTIL) / (SINK_UNTIL - EMERGE_UNTIL));
    const scale = 0.5 + k * 1.8;
    m.scale.set(scale, scale * 0.3, scale);
    const mat = m.material as { opacity: number; transparent: boolean };
    mat.transparent = true;
    mat.opacity = Math.max(0, 0.6 - k * 0.5);
  });

  const x = GRID_OFFSET + center.col * CELL_SIZE;
  const z = GRID_OFFSET + center.row * CELL_SIZE;

  return (
    <mesh ref={ref} position={[x, 0.1, z]}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshStandardMaterial color="#140820" transparent opacity={0} />
    </mesh>
  );
}

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
