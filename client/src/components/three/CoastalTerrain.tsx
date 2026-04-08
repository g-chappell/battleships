import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * Coastal landmass surrounding the play area: cliffs behind the boards,
 * gentle beaches on the outer edges, narrow open channel between boards.
 *
 * Built procedurally from a heightmap function so no external assets needed.
 */

const SIZE = 90;            // total side length (units)
const SEGMENTS = 96;        // grid resolution

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return (
    a * (1 - ux) * (1 - uy) +
    b * ux * (1 - uy) +
    c * (1 - ux) * uy +
    d * ux * uy
  );
}

function fbm(x: number, y: number, octaves = 3): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    sum += smoothNoise(x * freq, y * freq) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / total;
}

/**
 * heightAt: returns the y elevation at a given world (x,z).
 * Negative ocean (below sea level), positive land.
 *
 * Plan:
 * - The two boards sit centered around (-5.75, 0) and (5.75, 0) with size ~10.
 * - The play area must remain water (height < 0).
 * - Outside a "play box" of |x| < 14, |z| < 8, terrain rises into beaches/cliffs.
 * - Behind both boards (z < -7), terrain rises into a tall cliff.
 * - In front (z > 7), gentle beach.
 */
function heightAt(x: number, z: number): number {
  // Distance to play area edges
  const playHalfX = 14;
  const playHalfZ = 7.5;

  // Smooth distance from play box (negative inside, positive outside)
  const dx = Math.max(0, Math.abs(x) - playHalfX);
  const dz = Math.max(0, Math.abs(z) - playHalfZ);
  const distOutside = Math.sqrt(dx * dx + dz * dz);

  if (distOutside <= 0.1) {
    // Inside play area — keep underwater
    return -0.6;
  }

  // Base terrain rises with distance from play area
  let h = -0.6 + Math.min(distOutside * 0.6, 4.5);

  // Cliffs behind the boards (north side)
  if (z < -playHalfZ) {
    const behindAmount = (-(z + playHalfZ)) * 0.4;
    h += behindAmount * 1.2;
  }

  // Add procedural variation so it doesn't look uniform
  h += fbm(x * 0.08, z * 0.08, 3) * 1.5;
  h += fbm(x * 0.25, z * 0.25, 2) * 0.4;

  // Carve a small inlet between the boards (around x=0)
  const channelDist = Math.abs(x);
  if (channelDist < 2 && z > -3 && z < 3) {
    h -= (2 - channelDist) * 1.2;
  }

  return h;
}

function vertexColor(h: number): [number, number, number] {
  // Multi-zone palette matching Ocean shader
  if (h < -0.3) return [0.04, 0.01, 0.02];        // deep water
  if (h < 0.0) return [0.18, 0.05, 0.07];         // mid water
  if (h < 0.3) return [0.42, 0.10, 0.14];         // shallow / shore wash
  if (h < 0.5) return [0.55, 0.40, 0.25];         // wet sand
  if (h < 1.5) return [0.62, 0.48, 0.30];         // dry sand
  if (h < 3.0) return [0.32, 0.22, 0.14];         // earth / soil
  return [0.22, 0.16, 0.12];                       // rocky highlands
}

export function CoastalTerrain() {
  const { geometry, palms, rocks } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(positions.count * 3);

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const h = heightAt(x, z);
      positions.setY(i, h);
      const c = vertexColor(h);
      colors[i * 3] = c[0];
      colors[i * 3 + 1] = c[1];
      colors[i * 3 + 2] = c[2];
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    // Decorative palm + rock positions on the highest land
    const palmPositions: [number, number, number][] = [];
    const rockPositions: [number, number, number][] = [];
    const candidates: { x: number; z: number; h: number }[] = [];
    for (let xi = -40; xi <= 40; xi += 4) {
      for (let zi = -40; zi <= 40; zi += 4) {
        const h = heightAt(xi, zi);
        if (h > 0.6 && h < 2.2) candidates.push({ x: xi, z: zi, h });
      }
    }
    candidates.sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(10, candidates.length); i++) {
      const c = candidates[i];
      palmPositions.push([c.x + (Math.random() - 0.5) * 0.5, c.h, c.z + (Math.random() - 0.5) * 0.5]);
    }
    for (let i = 10; i < Math.min(20, candidates.length); i++) {
      const c = candidates[i];
      rockPositions.push([c.x + (Math.random() - 0.5) * 1, c.h, c.z + (Math.random() - 0.5) * 1]);
    }

    return { geometry: geo, palms: palmPositions, rocks: rockPositions };
  }, []);

  return (
    <group position={[0, -0.5, 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          vertexColors
          roughness={0.95}
          metalness={0.0}
          flatShading
        />
      </mesh>

      {/* Palm trees */}
      {palms.map((pos, i) => (
        <Palm key={`palm-${i}`} position={pos} />
      ))}

      {/* Rocks */}
      {rocks.map((pos, i) => (
        <mesh key={`rock-${i}`} position={pos}>
          <icosahedronGeometry args={[0.4 + Math.random() * 0.3, 0]} />
          <meshStandardMaterial color="#3a2a1a" roughness={0.95} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Palm({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 1.6, 6]} />
        <meshStandardMaterial color="#3d2818" roughness={0.9} />
      </mesh>
      {/* Fronds */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const ang = (i / 6) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(ang) * 0.4, 1.7, Math.sin(ang) * 0.4]}
            rotation={[Math.PI / 4, ang, 0]}
          >
            <boxGeometry args={[0.7, 0.04, 0.18]} />
            <meshStandardMaterial color="#3a6028" roughness={0.85} />
          </mesh>
        );
      })}
    </group>
  );
}
