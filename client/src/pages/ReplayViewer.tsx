import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useReplayStore, type ReplayBoardSnapshot } from '../store/replayStore';
import { CellState } from '@shared/index';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { FONT_STYLES } from '../styles/fonts';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';
import { BackButton } from '../components/ui/BackButton';
import { Card } from '../components/ui/Card';

function cellClass(state: CellState): string {
  switch (state) {
    case CellState.Hit:
      return 'bg-[#bb1a1a] border-blood-bright';
    case CellState.Miss:
      return 'bg-[#3a607a] border-[#5a80a0]';
    case CellState.Ship:
      return 'bg-[#8a5e44] border-gold';
    case CellState.Land:
      return 'bg-[#7a5838] border-aged-gold';
    default:
      return 'bg-[#2d1a2d] border-mahogany-light';
  }
}

function Mini2DBoard({ board, label }: { board: ReplayBoardSnapshot; label: string }) {
  return (
    <div>
      <div className="text-center text-gold mb-2 text-sm" style={FONT_STYLES.pirate}>
        {label}
      </div>
      <div
        className="grid gap-0.5 p-2 bg-pitch border border-blood/60 rounded-lg"
        style={{
          gridTemplateColumns: `repeat(${board.width}, 1fr)`,
          width: 'fit-content',
          margin: '0 auto',
        }}
      >
        {board.cells.flatMap((row, r) =>
          row.map((cell, c) => (
            <div
              key={`${r}-${c}`}
              className={`w-6 h-6 rounded border ${cellClass(cell)}`}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function ReplayViewer() {
  const setScreen = useGameStore((s) => s.setScreen);
  const replay = useReplayStore((s) => s.replay);
  const cursor = useReplayStore((s) => s.cursor);
  const playing = useReplayStore((s) => s.playing);
  const speed = useReplayStore((s) => s.speed);
  const p1Board = useReplayStore((s) => s.p1Board);
  const p2Board = useReplayStore((s) => s.p2Board);
  const loading = useReplayStore((s) => s.loading);
  const error = useReplayStore((s) => s.error);
  const play = useReplayStore((s) => s.play);
  const pause = useReplayStore((s) => s.pause);
  const seek = useReplayStore((s) => s.seek);
  const setSpeed = useReplayStore((s) => s.setSpeed);
  const reset = useReplayStore((s) => s.reset);

  useEffect(() => {
    return () => {
      // Don't reset on unmount so state persists if user goes back
    };
  }, []);

  const currentEvent = replay && cursor > 0 ? replay.events[cursor - 1] : null;

  return (
    <PageShell maxWidth="5xl">
      <PageHeader
        title="Replay"
        subtitle={replay ? `${replay.p1.username} vs ${replay.p2.username} · ${replay.mode}` : undefined}
        actions={
          <BackButton
            onClick={() => {
              reset();
              setScreen('dashboard');
            }}
          />
        }
      />

      {loading && <p className="text-parchment/60 italic" style={FONT_STYLES.body}>Loading replay...</p>}
      {error && (
        <Card variant="default" padding="md" className="!bg-blood-dark/30 !border-blood/60">
          <p className="italic text-blood-bright" style={FONT_STYLES.body}>{error}</p>
        </Card>
      )}

      {replay && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Mini2DBoard board={p1Board} label={`${replay.p1.username} (Player 1)`} />
            <Mini2DBoard board={p2Board} label={`${replay.p2.username} (Player 2)`} />
          </div>

          {/* Timeline + controls */}
          <Card variant="glow" padding="md">
            <div className="flex items-center gap-3 mb-3">
              <IconButton label={playing ? 'Pause' : 'Play'} onClick={() => (playing ? pause() : play())}>
                {playing ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </IconButton>
              <IconButton label="Restart" onClick={() => seek(0)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
              </IconButton>
              <div className="flex gap-1">
                {[1, 2, 4].map((s) => (
                  <Button
                    key={s}
                    variant={speed === s ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setSpeed(s as 1 | 2 | 4)}
                  >
                    {s}x
                  </Button>
                ))}
              </div>
              <div className="flex-1 text-right text-xs text-aged-gold" style={FONT_STYLES.labelSC}>
                Event {cursor} / {replay.events.length}
              </div>
            </div>

            <input
              type="range"
              min="0"
              max={replay.events.length}
              value={cursor}
              onChange={(e) => seek(parseInt(e.target.value))}
              className="w-full accent-blood-bright"
            />

            {currentEvent && (
              <div className="mt-3 text-sm text-gold italic text-center" style={FONT_STYLES.body}>
                {describeEvent(currentEvent)}
              </div>
            )}
          </Card>
        </>
      )}
    </PageShell>
  );
}

function describeEvent(ev: import('@shared/index').ReplayEvent): string {
  if (ev.kind === 'placement') {
    return `${ev.side === 'p1' ? 'Player 1' : 'Player 2'} deployed ${ev.placements.length} ships`;
  }
  if (ev.kind === 'fire') {
    const result = ev.outcome.result;
    return `${ev.side === 'p1' ? 'P1' : 'P2'} fires at (${ev.coord.row},${ev.coord.col}) — ${result.toUpperCase()}`;
  }
  if (ev.kind === 'ability') {
    return `${ev.side === 'p1' ? 'P1' : 'P2'} uses ${ev.ability}`;
  }
  if (ev.kind === 'turn') {
    return `Turn ${ev.turn}`;
  }
  if (ev.kind === 'end') {
    return `${ev.winnerSide === 'p1' ? 'Player 1' : 'Player 2'} wins!`;
  }
  return '';
}
