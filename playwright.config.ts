import { defineConfig, devices } from '@playwright/test';

// --- TESTS VISUALES ---
// `npm run test:visual` arranca el servidor de desarrollo y juega peleas preparadas
// para cada sello: comprueba el resultado, que no haya errores y guarda capturas de
// cada momento en test-results/visual (para revisarlas a ojo). Las ventanas fijas
// (colección, catálogo, editor) se comparan con capturas de referencia.
const PORT = 3100;

export default defineConfig({
  testDir: 'tests/visual',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.03, animations: 'disabled' } },
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-ES',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : undefined,
  },
  projects: [
    { name: 'movil', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 760 }, deviceScaleFactor: 1 } },
    { name: 'horizontal', use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
