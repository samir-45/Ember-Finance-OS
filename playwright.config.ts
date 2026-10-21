import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-playwright-'));
export default defineConfig({
  testDir: './tests/browser',
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:3100',
    browserName: 'chromium',
    timezoneId: 'Asia/Dhaka',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined },
  },
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next ${process.env.EMBER_E2E_DEV === 'true' ? 'dev' : 'start'} -H localhost -p 3100`,
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      DATABASE_URL: 'placeholder_browser_test',
      EMBER_STORAGE_DRIVER: 'file',
      EMBER_VAULT_PATH: path.join(directory, 'vault.json'),
      EMBER_OWNER_PASSWORD: 'ember-e2e-only-owner-password',
      EMBER_SESSION_SECRET: 'ember-e2e-only-session-secret-at-least-32-characters',
      EMBER_PUBLIC_URL: 'http://localhost:3100',
      EMBER_ENABLE_EXTERNAL_AI: 'false',
      EMBER_WORKSPACE_RESET_GENERATION: '',
      GEMINI_API_KEY: 'disabled-browser-test',
    },
  },
});
