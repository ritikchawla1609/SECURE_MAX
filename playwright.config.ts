import { defineConfig, devices } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const localChrome = process.env.CHROME_PATH || '/Applications/Google Chrome/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = fs.existsSync(localChrome) ? localChrome : undefined;

export default defineConfig({
  testDir: path.resolve(__dirname, 'e2e'),
  outputDir: path.resolve(__dirname, 'test-results'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          ...(executablePath ? { executablePath } : {}),
        },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    cwd: __dirname,
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
