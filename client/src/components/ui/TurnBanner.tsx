import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { ShotResult, SHIP_NAMES, GamePhase } from '@shared/index';

const PLAYER_HIT_LINES = [
  'Direct Hit!',
  'Bullseye!',
  'Target struck!',
  'A solid hit!',
  'Right on target!',
];

const PLAYER_MISS_LINES = [
  'Splash! The shot goes wide...',
  'Nothing but ocean...',
  'A miss! Recalibrate!',
  'The seas swallow our cannonball.',
];

const PLAYER_SINK_LINES = [
  'sinks beneath the waves!',
  'has been destroyed!',
  'is going down!',
  'breaks apart and sinks!',
];

const AI_HIT_LINES = [
  "We've been hit!",
  'Hull breach! Damage report!',
  'Enemy fire connects!',
  'Brace for impact!',
];

const AI_MISS_LINES = [
  'They missed! Our fleet holds.',
  'A splash nearby — but we are safe!',
  'The enemy shot goes wide.',
  'Their aim falters!',
];

const AI_SINK_LINES = [
  'has been lost to the deep...',
  'is sinking! All hands abandon ship!',
  'takes a fatal blow!',
];

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function TurnBanner() {
  const engine = useGameStore((s) => s.engine);
  const lastOutcome = useGameStore((s) => s.lastShotOutcome);
  useGameStore((s) => s.tick); // subscribe for re-renders
  const isAnimating = useGameStore((s) => s.isAnimating);

  const [banner, setBanner] = useState<{
    text: string;
    subtext?: string;
    color: string;
    visible: boolean;
  }>({ text: '', color: '', visible: false });

  useEffect(() => {
    if (!lastOutcome || !isAnimating) return;
    if (engine.phase === GamePhase.Placement) return;

    const isPlayerShot = engine.currentTurn === 'opponent' || engine.phase === GamePhase.Finished;
    // After playerShoot, currentTurn switches to opponent. So if current is opponent, last shot was player's.

    let text = '';
    let subtext: string | undefined;
    let color = '#f4e4c1';

    if (isPlayerShot) {
      // Player just fired
      if (lastOutcome.result === ShotResult.Sink && lastOutcome.sunkShip) {
        text = `${SHIP_NAMES[lastOutcome.sunkShip]} ${pick(PLAYER_SINK_LINES)}`;
        subtext = 'SHIP DESTROYED';
        color = '#e74c3c';
      } else if (lastOutcome.result === ShotResult.Hit) {
        text = pick(PLAYER_HIT_LINES);
        color = '#e67e22';
      } else {
        text = pick(PLAYER_MISS_LINES);
        color = '#3498db';
      }
    } else {
      // AI just fired
      if (lastOutcome.result === ShotResult.Sink && lastOutcome.sunkShip) {
        text = `Our ${SHIP_NAMES[lastOutcome.sunkShip]} ${pick(AI_SINK_LINES)}`;
        subtext = 'SHIP LOST';
        color = '#e74c3c';
      } else if (lastOutcome.result === ShotResult.Hit) {
        text = pick(AI_HIT_LINES);
        color = '#e67e22';
      } else {
        text = pick(AI_MISS_LINES);
        color = '#2ecc71';
      }
    }

    setBanner({ text, subtext, color, visible: true });

    const timer = setTimeout(() => {
      setBanner((b) => ({ ...b, visible: false }));
    }, 2000);

    return () => clearTimeout(timer);
  }, [lastOutcome, isAnimating, engine.currentTurn, engine.phase]);

  if (!banner.visible) return null;

  return (
    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
      <div
        className="text-center animate-[fadeInScale_0.3s_ease-out]"
        style={{
          animation: 'fadeInScale 0.3s ease-out',
        }}
      >
        {banner.subtext && (
          <div
            className="text-sm font-bold uppercase tracking-[0.3em] mb-2"
            style={{ color: banner.color, textShadow: `0 0 20px ${banner.color}` }}
          >
            {banner.subtext}
          </div>
        )}
        <div
          className="text-3xl font-bold"
          style={{
            color: banner.color,
            textShadow: `0 0 30px ${banner.color}40, 0 2px 10px rgba(0,0,0,0.8)`,
          }}
        >
          {banner.text}
        </div>
      </div>
    </div>
  );
}
