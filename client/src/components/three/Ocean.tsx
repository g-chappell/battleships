import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, ShaderMaterial } from 'three';
import { useCosmeticsStore } from '../../store/cosmeticsStore';
import { getCosmetic } from '@shared/index';

/**
 * Stylized realism ocean: layered noise + caustics + fresnel rim.
 * The fragment shader blends through deep/mid/shore/foam zones based on
 * elevation, giving the appearance of a coastal sea.
 */

const vertexShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vElevation;
  varying vec3 vWorldPos;

  // Simple hash + noise (cheap, no texture sampling)
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Layered waves: long swells + medium chop + small ripples
    float swell = sin(pos.x * 0.18 + uTime * 0.5) * 0.35
                + sin(pos.z * 0.14 - uTime * 0.4) * 0.28;
    float chop = noise(pos.xz * 0.4 + vec2(uTime * 0.15, uTime * 0.1)) * 0.18;
    float ripple = noise(pos.xz * 1.6 + vec2(uTime * 0.6, -uTime * 0.5)) * 0.06;

    pos.y += swell + chop + ripple;
    vElevation = pos.y;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uCameraPos;
  uniform vec3 uBaseTint;
  varying vec2 vUv;
  varying float vElevation;
  varying vec3 vWorldPos;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    // Multi-zone palette — deep blue sea, then tinted by uBaseTint
    vec3 deepColor    = vec3(0.02, 0.05, 0.12) + uBaseTint * 0.3;
    vec3 midColor     = vec3(0.06, 0.14, 0.25) + uBaseTint * 0.5;
    vec3 shallowColor = vec3(0.12, 0.25, 0.38) + uBaseTint * 0.7;
    vec3 foamColor    = vec3(0.45, 0.58, 0.68) + uBaseTint * 0.4;
    vec3 sparkColor   = vec3(1.0, 0.55, 0.35);

    // Blend zones by elevation
    float t1 = smoothstep(-0.4, 0.0, vElevation);
    vec3 color = mix(deepColor, midColor, t1);
    float t2 = smoothstep(-0.05, 0.25, vElevation);
    color = mix(color, shallowColor, t2 * 0.7);

    // Foam on wave peaks
    float foamMix = smoothstep(0.30, 0.55, vElevation);
    color = mix(color, foamColor, foamMix * 0.7);

    // Caustics — moving light patches on shallow areas
    float caustic = noise(vWorldPos.xz * 0.5 + uTime * 0.2)
                  * noise(vWorldPos.xz * 0.7 - uTime * 0.15);
    caustic = pow(caustic, 2.0) * 0.4;
    color += sparkColor * caustic * (0.3 + t2 * 0.5);

    // Fresnel rim (slightly brighter at glancing angles)
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    float fresnel = pow(1.0 - max(0.0, viewDir.y), 3.0);
    color += vec3(0.06, 0.12, 0.20) * fresnel;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function Ocean() {
  const meshRef = useRef<Mesh>(null);
  const boardThemeId = useCosmeticsStore((s) => s.equipped.boardTheme);

  // Base tint = additive offset from default. Default theme = no offset.
  const tint = useMemo(() => {
    const def = getCosmetic(boardThemeId);
    if (def?.boardTint) return def.boardTint.ocean;
    return [0, 0, 0] as [number, number, number];
  }, [boardThemeId]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCameraPos: { value: [0, 20, 20] as [number, number, number] },
      uBaseTint: { value: tint },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Update tint uniform whenever cosmetic changes
  useEffect(() => {
    if (meshRef.current) {
      const material = meshRef.current.material as ShaderMaterial;
      material.uniforms.uBaseTint.value = tint;
    }
  }, [tint]);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as ShaderMaterial;
      material.uniforms.uTime.value = state.clock.elapsedTime;
      const cam = state.camera.position;
      material.uniforms.uCameraPos.value = [cam.x, cam.y, cam.z];
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
      <planeGeometry args={[120, 120, 192, 192]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}
