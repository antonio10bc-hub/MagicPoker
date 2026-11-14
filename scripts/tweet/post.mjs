// Publica en X una captura distinta de Magic Poker cada día (la usa .github/workflows/daily-tweet.yml).
// Las capturas salen de los tests visuales (test-results/). DRY_RUN=true: no publica.
import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';

// Capturas poco vistosas (menús, ventanas, versión en inglés...)
const EXCLUDE = /^(en-|galeria|menu|confirmar|copia|ventana|elegir|antes|bosque-7b|bosque-8|bosque-9)|-(actual|diff|expected)\.png$/;

const TEXTS = [
  'Magic Poker es un juego de cartas estratégico con estética pixel art de DS. Cada mano cuenta. 🃏',
  'Así se ve Magic Poker hoy: cartas, combates y jefes en pixel art. 🃏',
  'Captura del día de Magic Poker, mi juego de cartas estratégico en pixel art. ¿Qué jugarías aquí?',
  'Magic Poker: póker, estrategia y monstruos en un diorama pixel art inspirado en la DS.',
  'Sigo puliendo Magic Poker, mi juego de cartas indie. Hoy toca enseñar esta escena. ✨',
  'Bosques, castillos, mapas y jefes: un poco más de Magic Poker, juego de cartas en pixel art.',
  'Un vistazo diario a Magic Poker, un juego de cartas estratégico que estoy desarrollando.',
  'Magic Poker en desarrollo: cartas, decisiones y mucho pixel art. 🎴',
  'Pixel art, cartas y estrategia. Esto es Magic Poker, mi proyecto indie.',
  'Hoy en Magic Poker: una escena más del juego de cartas estratégico que estoy creando.',
  'Magic Poker crece poco a poco. Juego de cartas estratégico con alma de DS. 🃏',
  '¿Te atreverías con esta partida? Magic Poker, juego de cartas estratégico en pixel art.',
];
const TAGS = ['#indiedev #gamedev #pixelart', '#indiedev #pixelart #cardgame', '#gamedev #indiegame #pixelart'];

function pngs(dir) {
  let out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'attachments') out = out.concat(pngs(p)); }
    else if (e.name.endsWith('.png') && !EXCLUDE.test(e.name)) out.push(p);
  }
  return out;
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const day = Math.floor((Date.now() - Date.UTC(2026, 10, 14)) / 864e5);

const byName = new Map();
for (const p of pngs('test-results')) if (!byName.has(basename(p))) byName.set(basename(p), p);
const images = [...byName.keys()].sort();
if (!images.length) throw new Error('No hay capturas en test-results/');

const stride = gcd(37, images.length) === 1 ? 37 : 1; // salta entre escenas para variar
const image = byName.get(images[(day * stride) % images.length]);
const text = `${TEXTS[day % TEXTS.length]}\n\n${TAGS[day % TAGS.length]}`;

console.log(`Día ${day} · ${images.length} capturas · elegida: ${image}\n${text}`);
if (process.env.DRY_RUN === 'true') process.exit(0);

const { TwitterApi } = await import('twitter-api-v2');
const client = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});
const mediaId = await client.v2.uploadMedia(readFileSync(image), { media_type: 'image/png' });
const { data } = await client.v2.tweet({ text, media: { media_ids: [mediaId] } });
console.log(`Publicado: https://x.com/i/web/status/${data.id}`);
