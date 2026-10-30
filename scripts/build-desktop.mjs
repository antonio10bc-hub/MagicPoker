// --- BUILD DE ESCRITORIO ---
// Exporta la web estática (DESKTOP=1) y la copia a desktop/web para Electron.
// Después: cd desktop && npm run dist  →  desktop/dist/win-unpacked (para Steam) y un .zip.
import { execSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';

execSync('npx next build', { stdio: 'inherit', env: { ...process.env, DESKTOP: '1' } });
rmSync('desktop/web', { recursive: true, force: true });
// sw.js sobra en escritorio (no se registra)
cpSync('out', 'desktop/web', { recursive: true, filter: src => !src.endsWith('sw.js') });
console.log('Web de escritorio lista en desktop/web');
