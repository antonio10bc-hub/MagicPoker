// --- BUILD PARA ITCH.IO (HTML5) ---
// Exporta la web estática (WEB_EXPORT=1: sin service worker ni analíticas) y la deja lista
// para jugar en el navegador en itch.io, que la sirve desde una subcarpeta
// (…/html/<id>/index.html): las rutas absolutas ("/_next/…", "/icon.png") pasan a ser
// relativas. Resultado: itch/web/ (para probarla) e itch/builds/MagicPoker-web.zip (para
// subirla, con index.html en la raíz del zip).
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

execSync('npx next build', { stdio: 'inherit', env: { ...process.env, WEB_EXPORT: '1' } });

const WEB = 'itch/web';
rmSync(WEB, { recursive: true, force: true });
cpSync('out', WEB, { recursive: true, filter: src => !src.endsWith('sw.js') });

const files = dir => readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : [p];
});
// En el HTML y en los datos de React: "/_next/…", "/icon.png"… → "./…" (también escapadas)
const ROOT_FILES = ['_next/', 'manifest.webmanifest', 'icon.png', 'apple-icon.png', 'favicon.ico', 'icons/'];
const relative = text => ROOT_FILES.reduce((s, f) => s
  .replaceAll(`"/${f}`, `"./${f}`)
  .replaceAll(`\\"/${f}`, `\\"./${f}`), text);
let changed = 0;
for (const f of files(WEB)) {
  if (f.endsWith('.html') || f.endsWith('.txt') || f.endsWith('.webmanifest')) {
    const before = readFileSync(f, 'utf8');
    const after = relative(before);
    if (after !== before) { writeFileSync(f, after); changed++; }
  }
  // El cargador de trozos de Turbopack: su ruta base, relativa a la página
  if (/[\\/]turbopack-[^\\/]+\.js$/.test(f)) {
    const before = readFileSync(f, 'utf8');
    const after = before.replaceAll('="/_next/"', '="./_next/"');
    if (after === before) throw new Error(`No encuentro la ruta base en ${f}`);
    writeFileSync(f, after);
    changed++;
  }
}
console.log(`Rutas relativas en ${changed} ficheros`);

mkdirSync('itch/builds', { recursive: true });
rmSync('itch/builds/MagicPoker-web.zip', { force: true });
execSync('zip -qr -9 ../builds/MagicPoker-web.zip .', { cwd: WEB, stdio: 'inherit' });
console.log('Listo: itch/builds/MagicPoker-web.zip (y itch/web para probarla)');
