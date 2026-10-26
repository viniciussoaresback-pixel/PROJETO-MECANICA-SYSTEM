// Testes no navegador (Playwright).
//   npm run e2e         → modo demonstração (computador e celular)
//   npm run e2e:nuvem   → modo nuvem com os emuladores do Firebase (precisa de Java)
import { defineConfig, devices } from '@playwright/test';

const comEmulador = !!process.env.FIREBASE_EMULATOR_HUB || process.env.EMULADOR === '1';

export default defineConfig({
  testDir: '.',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node servidor.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'computador', testMatch: 'e2e/**/*.spec.js', testIgnore: 'e2e/celular.spec.js', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } } },
    { name: 'celular', testMatch: 'e2e/celular.spec.js', use: { ...devices['Pixel 7'] } },
    ...(comEmulador ? [{ name: 'nuvem', testMatch: 'nuvem/**/*.spec.js', fullyParallel: false, use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } } }] : []),
  ],
});
