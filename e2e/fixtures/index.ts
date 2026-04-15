/**
 * Shared Playwright fixtures for Ironclad Waters e2e tests.
 *
 * Usage in test files:
 *   import { test, expect } from '../fixtures';
 *
 * Available fixtures:
 *   - registeredUser  — seeds a fresh user in the DB and returns credentials + auth token
 *   - guestUser       — returns a random guest name (no DB interaction)
 *   - socketReady     — helper to await a specific Socket.IO event on a page
 */

import { test as base, expect, type Page } from '@playwright/test';
import { randomUUID } from 'crypto';

export type { Page } from '@playwright/test';

const API_URL = process.env.API_URL ?? 'http://localhost:3001/api';

// ---------------------------------------------------------------------------
// Test bridge type
// ---------------------------------------------------------------------------

/**
 * The window.__ironclad bridge exposed by main.tsx in DEV builds.
 * Declared here once so all test files import the same type and avoid
 * TS2717 "Subsequent property declarations must have the same type" errors.
 *
 * Add new bridge methods here rather than per-file.
 */
export type IroncladBridge = {
  isReady: () => boolean;
  getPhase: () => string;
  getTurnCount: () => number;
  getOpponentShipsRemaining: () => number;
  getPlayerShipsRemaining: () => number;
  getWinner: () => string | null;
  getAccuracy: () => number;
  getOpponentShipsSunk: () => number;
  isAnimating: () => boolean;
  isPlayerTurn: () => boolean;
  fireAndAdvance: (row: number, col: number) => { result: string; sunkShip: string | null } | null;
  injectAllAbilities: () => void;
  resetAbilityCooldowns: () => void;
  disableOpponentTraits: () => void;
  completeGameFast: () => string | null;
  useAbilityAndAdvance: (type: string, row: number, col: number) => { applied: boolean };
  getEngineStats: () => { hits: number; actions: number; sunk: number };
  getOpponentShipCells: () => Array<{ row: number; col: number; shipType: string; isHit: boolean }>;
  damagePlayerShip: () => { row: number; col: number } | null;
  // Multiplayer helpers (TASK-050)
  getOwnShipCells: () => Array<{ row: number; col: number }>;
  injectAuth: (token: string, userJson: string) => void;
  fireViaSocket: (row: number, col: number) => void;
  resignViaSocket: () => void;
  requestRematchViaSocket: () => void;
  getMultiplayerState: () => {
    socketStatus: string;
    matchmakingState: string;
    gameState: {
      phase: string;
      currentTurn: string;
      ownBoard: { cells: string[][] };
      opponentBoard: { cells: string[][] };
    } | null;
    matchSummary: unknown | null;
    selfRequestedRematch: boolean;
    opponentRequestedRematch: boolean;
  };
};

declare global {
  interface Window {
    __ironclad?: IroncladBridge;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RegisteredUser = {
  username: string;
  email: string;
  password: string;
  token: string;
  userId: string;
};

export type GuestUser = {
  guestName: string;
};

/** Returns the payload of the first Socket.IO event with the given name, or throws on timeout. */
export type SocketReadyHelper = (
  page: Page,
  eventName: string,
  timeout?: number,
) => Promise<unknown>;

export type TestFixtures = {
  registeredUser: RegisteredUser;
  guestUser: GuestUser;
  socketReady: SocketReadyHelper;
};

// ---------------------------------------------------------------------------
// Socket.IO frame parser
// Socket.IO encodes WebSocket messages as:
//   42["event_name", payload]
//   ^^ EIO type 4 (message) + SIO type 2 (event)
// ---------------------------------------------------------------------------

function parseSocketIOFrame(payload: string | Buffer): [string, unknown] | null {
  const str = typeof payload === 'string' ? payload : payload.toString('utf8');
  const match = str.match(/^42(\[[\s\S]*\])$/);
  if (!match) return null;
  try {
    const arr = JSON.parse(match[1]) as unknown[];
    if (Array.isArray(arr) && arr.length >= 1 && typeof arr[0] === 'string') {
      return [arr[0], arr[1]];
    }
  } catch {
    // unparseable — skip
  }
  return null;
}

// ---------------------------------------------------------------------------
// Extended test object
// ---------------------------------------------------------------------------

export const test = base.extend<TestFixtures>({
  /**
   * Seeds a new registered user via the REST API.
   * The user is unique per test (UUID suffix) to prevent conflicts.
   */
  registeredUser: async ({ request }, use) => {
    const suffix = randomUUID().slice(0, 8);
    const username = `e2e_${suffix}`;
    const email = `e2e_${suffix}@test.invalid`;
    const password = 'TestPass1!';

    const res = await request.post(`${API_URL}/auth/register`, {
      data: { email, username, password },
    });

    if (!res.ok()) {
      const body = await res.text();
      throw new Error(`registeredUser fixture: register failed (${res.status()}): ${body}`);
    }

    const body = (await res.json()) as {
      token: string;
      user: { id: string; email: string; username: string };
    };

    await use({
      username,
      email,
      password,
      token: body.token,
      userId: body.user.id,
    });

    // No explicit teardown — test DB is ephemeral in CI and local dev resets as needed.
  },

  /**
   * Returns a random guest name. Guest connections are authenticated via socket
   * by passing { guestName } in the Socket.IO handshake auth object.
   */
  guestUser: async ({}, use) => {
    const suffix = randomUUID().slice(0, 8);
    await use({ guestName: `GuestE2E_${suffix}` });
  },

  /**
   * Returns a helper function that resolves when the specified Socket.IO event
   * is received on the given page, or rejects after `timeout` ms.
   *
   * Must be called BEFORE the action that triggers the event, because Playwright's
   * WebSocket listener must be registered before the frame arrives.
   *
   * Example:
   *   const waitForEvent = socketReady;
   *   const gameStatePromise = waitForEvent(page, 'gameState');
   *   await page.click('[data-testid="start-game"]');
   *   const state = await gameStatePromise;
   */
  socketReady: async ({}, use) => {
    const helper: SocketReadyHelper = (page, eventName, timeout = 15_000) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`socketReady: timed out waiting for "${eventName}" (${timeout}ms)`)),
          timeout,
        );

        page.on('websocket', ws => {
          ws.on('framereceived', ({ payload }) => {
            const parsed = parseSocketIOFrame(payload as string | Buffer);
            if (parsed && parsed[0] === eventName) {
              clearTimeout(timer);
              resolve(parsed[1]);
            }
          });
        });
      });

    await use(helper);
  },
});

export { expect } from '@playwright/test';
