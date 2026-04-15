# End-to-End Tests — Ironclad Waters

Playwright-based e2e tests for the full Ironclad Waters stack (client + server + Postgres).

## Requirements

- Node 20+
- Postgres running locally (or via Docker)
- Playwright browsers installed (once per machine):
  ```bash
  cd e2e && npx playwright install --with-deps chromium
  ```

## Running locally

Start the full stack in one terminal, then run Playwright in another:

```bash
# Terminal 1 — full stack (client on :5173, server on :3001)
npm run dev

# Terminal 2 — e2e tests
npm run test --workspace=e2e
```

Or let Playwright start the dev servers automatically (it reads `webServer` from
`playwright.config.ts` and starts client + server if they are not already running):

```bash
npm run test --workspace=e2e
```

### Headed mode (watch the browser)

```bash
cd e2e && npx playwright test --headed
```

### Playwright UI mode

```bash
cd e2e && npx playwright test --ui
```

## Environment variables

| Variable       | Default                                                       | Description                        |
| -------------- | ------------------------------------------------------------- | ---------------------------------- |
| `DATABASE_URL` | `postgresql://battleships:battleships@localhost:5432/battleships` | Postgres connection string         |
| `JWT_SECRET`   | `dev-secret-change-in-production`                             | Must match the server's JWT secret |
| `API_URL`      | `http://localhost:3001/api`                                   | Base URL for fixture API calls     |

## Fixtures (`fixtures/index.ts`)

Import from `../fixtures` inside test files:

```typescript
import { test, expect } from '../fixtures';
```

### `registeredUser`

Seeds a fresh user in the database (via `POST /api/auth/register`) and returns:

```typescript
{
  username: string;
  email: string;
  password: string;
  token: string;   // JWT — pass as Authorization: Bearer <token> or via localStorage
  userId: string;
}
```

Each test gets a unique user (UUID-suffixed) to prevent conflicts. No cleanup is
performed — the test database is ephemeral in CI and can be reset locally as needed.

### `guestUser`

Returns `{ guestName: string }` — a random name for guest socket connections.
Pass `guestName` in the Socket.IO `auth` object when connecting:

```typescript
const socket = io('http://localhost:3001', { auth: { guestName } });
```

### `socketReady`

Helper that awaits a specific Socket.IO event on a `Page`. Must be called **before**
the UI action that triggers the event.

```typescript
test('game state arrives after placement', async ({ page, socketReady }) => {
  const statePromise = socketReady(page, 'gameState');
  await page.click('[data-testid="confirm-placement"]');
  const state = await statePromise;
  // assert state…
});
```

`socketReady(page, eventName, timeout?)` — `timeout` defaults to 15 000 ms.

## Adding new tests

1. Create a file under `tests/` with a `.test.ts` extension.
2. Import the extended `test` and `expect` from `../fixtures` (not directly from `@playwright/test`).
3. Use `data-testid` attributes for selectors — add them to components as needed.
4. Keep tests deterministic: seed the AI opponent to a known state wherever possible.

## CI

The GitHub Actions `e2e` job (`.github/workflows/ci.yml`) runs after the unit-test
job passes. It:

1. Spins up a Postgres service container.
2. Runs `npx prisma db push` to apply the schema.
3. Installs Playwright Chromium binaries.
4. Runs `npm run test --workspace=e2e` — Playwright starts the dev servers via `webServer`.

To make the e2e job **required before merge**, add `e2e` to the branch protection
required status checks in the repository settings.

Playwright reports are uploaded as a GitHub Actions artefact (`playwright-report`)
and retained for 7 days.
