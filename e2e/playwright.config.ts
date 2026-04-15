import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const rootDir = path.resolve(__dirname, '..');

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'npm run dev:server',
      cwd: rootDir,
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        DATABASE_URL:
          process.env.DATABASE_URL ??
          'postgresql://battleships:battleships@localhost:5432/battleships',
        JWT_SECRET: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
        PORT: '3001',
        CLIENT_URL: 'http://localhost:5173',
      },
    },
    {
      command: 'npm run dev:client',
      cwd: rootDir,
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
