import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ShipType, Orientation } from '@shared/types';
import { ShipModel } from './ShipModel';
import { ErrorBoundary } from '../ui/ErrorBoundary';

// Carrier (length 5) at row=5, col=2 horizontal:
//   centerCol = 2 + 2 = 4  →  x = -4.5 + 4 = -0.5
//   centerRow = 5           →  z = -4.5 + 5 = 0.5
const SHIP_TARGET: [number, number, number] = [-0.5, 0.3, 0.5];
const CAMERA_POS: [number, number, number] = [4.5, 2.8, 5.0];

function ShowcaseScene() {
  return (
    <>
      <ambientLight intensity={0.5} color="#d4b896" />
      <directionalLight position={[5, 8, 4]} intensity={1.4} color="#ffd4a0" />
      <pointLight position={[-4, 3, -3]} intensity={0.5} color="#4070a0" />
      <pointLight position={[4, 2, 3]} intensity={0.4} color="#d4a040" />

      {/* Deep ocean floor */}
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0a1828" roughness={0.9} />
      </mesh>

      {/* Subtle water surface */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0d2040" transparent opacity={0.6} roughness={0.2} metalness={0.3} />
      </mesh>

      <ShipModel
        type={ShipType.Carrier}
        start={{ row: 5, col: 2 }}
        orientation={Orientation.Horizontal}
      />

      <OrbitControls
        target={SHIP_TARGET}
        autoRotate
        autoRotateSpeed={1.5}
        enablePan={false}
        enableZoom={false}
        minPolarAngle={0.4}
        maxPolarAngle={1.3}
      />
    </>
  );
}

const canvasFallback = (
  <div className="w-full h-full flex items-center justify-center bg-pitch text-parchment/40 text-sm">
    3D preview unavailable
  </div>
);

export function ShipShowcase() {
  return (
    <div className="w-full rounded-lg overflow-hidden border border-blood/30" style={{ height: 220 }}>
      <ErrorBoundary fallback={canvasFallback}>
        <Canvas
          camera={{ position: CAMERA_POS, fov: 40 }}
          style={{ background: '#0a1828' }}
        >
          <Suspense fallback={null}>
            <ShowcaseScene />
          </Suspense>
        </Canvas>
      </ErrorBoundary>
    </div>
  );
}
