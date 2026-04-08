import { create } from 'zustand';
import type { ReplayData, ReplayEvent, Coordinate } from '@shared/index';
import { CellState } from '@shared/index';
import { apiFetchSafe } from '../services/apiClient';

interface ReplayResponse { replay: ReplayData }

export interface ReplayBoardSnapshot {
  width: number;
  height: number;
  cells: CellState[][];
}

interface ReplayStore {
  replay: ReplayData | null;
  cursor: number;
  playing: boolean;
  speed: 1 | 2 | 4;
  p1Board: ReplayBoardSnapshot;
  p2Board: ReplayBoardSnapshot;
  loading: boolean;
  error: string | null;

  load: (matchId: string) => Promise<void>;
  play: () => void;
  pause: () => void;
  seek: (index: number) => void;
  setSpeed: (n: 1 | 2 | 4) => void;
  reset: () => void;
}

const GRID = 10;

function emptyBoard(): ReplayBoardSnapshot {
  return {
    width: GRID,
    height: GRID,
    cells: Array.from({ length: GRID }, () => Array(GRID).fill(CellState.Empty)),
  };
}

function cloneBoard(b: ReplayBoardSnapshot): ReplayBoardSnapshot {
  return {
    width: b.width,
    height: b.height,
    cells: b.cells.map((row) => [...row]),
  };
}

function applyEvent(
  p1: ReplayBoardSnapshot,
  p2: ReplayBoardSnapshot,
  ev: ReplayEvent
): { p1: ReplayBoardSnapshot; p2: ReplayBoardSnapshot } {
  const np1 = cloneBoard(p1);
  const np2 = cloneBoard(p2);

  if (ev.kind === 'placement') {
    const target = ev.side === 'p1' ? np1 : np2;
    for (const p of ev.placements) {
      const dr = p.orientation === 'horizontal' ? 0 : 1;
      const dc = p.orientation === 'horizontal' ? 1 : 0;
      // Use SHIP_LENGTHS map from shared? simpler: inline
      const lengths: Record<string, number> = {
        carrier: 5,
        battleship: 4,
        cruiser: 3,
        submarine: 3,
        destroyer: 2,
      };
      const len = lengths[p.type] ?? 1;
      for (let i = 0; i < len; i++) {
        const r = p.start.row + dr * i;
        const c = p.start.col + dc * i;
        if (r >= 0 && r < GRID && c >= 0 && c < GRID) {
          target.cells[r][c] = CellState.Ship;
        }
      }
    }
  } else if (ev.kind === 'fire' || ev.kind === 'ability') {
    // Shot lands on the OPPOSITE side's board
    const target = ev.side === 'p1' ? np2 : np1;
    const coord: Coordinate = ev.kind === 'fire' ? ev.coord : ev.coord;
    if (coord.row >= 0 && coord.row < GRID && coord.col >= 0 && coord.col < GRID) {
      if (ev.kind === 'fire') {
        const isHit = ev.outcome.result === 'hit' || ev.outcome.result === 'sink';
        target.cells[coord.row][coord.col] = isHit ? CellState.Hit : CellState.Miss;
      }
    }
  }
  return { p1: np1, p2: np2 };
}

let playInterval: ReturnType<typeof setInterval> | null = null;

export const useReplayStore = create<ReplayStore>((set, get) => ({
  replay: null,
  cursor: 0,
  playing: false,
  speed: 1,
  p1Board: emptyBoard(),
  p2Board: emptyBoard(),
  loading: false,
  error: null,

  load: async (matchId) => {
    set({ loading: true, error: null });
    if (playInterval) {
      clearInterval(playInterval);
      playInterval = null;
    }

    // Try localStorage first (AI mode)
    try {
      const raw = localStorage.getItem(`battleships_replay_${matchId}`);
      if (raw) {
        const replay = JSON.parse(raw) as ReplayData;
        set({
          replay,
          cursor: 0,
          p1Board: emptyBoard(),
          p2Board: emptyBoard(),
          loading: false,
        });
        return;
      }
    } catch {}

    // Server fallback
    const data = await apiFetchSafe<ReplayResponse>(`/matches/${matchId}/replay`);
    if (data) {
      set({
        replay: data.replay,
        cursor: 0,
        p1Board: emptyBoard(),
        p2Board: emptyBoard(),
        loading: false,
      });
    } else {
      set({ error: 'Replay not found', loading: false });
    }
  },

  play: () => {
    const { replay, speed } = get();
    if (!replay) return;
    if (playInterval) clearInterval(playInterval);
    set({ playing: true });
    playInterval = setInterval(() => {
      const s = get();
      if (!s.replay || s.cursor >= s.replay.events.length) {
        if (playInterval) clearInterval(playInterval);
        playInterval = null;
        set({ playing: false });
        return;
      }
      s.seek(s.cursor + 1);
    }, 800 / speed);
  },

  pause: () => {
    if (playInterval) {
      clearInterval(playInterval);
      playInterval = null;
    }
    set({ playing: false });
  },

  seek: (index) => {
    const { replay } = get();
    if (!replay) return;
    const target = Math.max(0, Math.min(index, replay.events.length));
    // Rebuild boards from scratch up to target
    let p1 = emptyBoard();
    let p2 = emptyBoard();
    for (let i = 0; i < target; i++) {
      const result = applyEvent(p1, p2, replay.events[i]);
      p1 = result.p1;
      p2 = result.p2;
    }
    set({ cursor: target, p1Board: p1, p2Board: p2 });
  },

  setSpeed: (n) => {
    set({ speed: n });
    const { playing, play } = get();
    if (playing) play();
  },

  reset: () => {
    if (playInterval) {
      clearInterval(playInterval);
      playInterval = null;
    }
    set({
      replay: null,
      cursor: 0,
      playing: false,
      p1Board: emptyBoard(),
      p2Board: emptyBoard(),
      error: null,
    });
  },
}));
