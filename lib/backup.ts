// --- COPIA DE SEGURIDAD (Ajustes) ---
// Todo lo que el juego guarda en este navegador (progreso, Castillo, Bosque, mazos,
// dorsos, estadísticas, logros, ajustes y la partida a medias) cabe en un código de
// texto. Pegado en otro navegador o dispositivo, lo deja exactamente igual.
//   MPSAVE1.z<base64url>  → JSON comprimido (deflate)
//   MPSAVE1.p<base64url>  → JSON sin comprimir (navegadores sin CompressionStream)
// Se quedan fuera solo cosas del dispositivo, no del jugador: el modo depuración y la
// detección de equipo poco potente.

const PREFIX = 'MPSAVE1.';
const VERSION = 1;
const DEVICE_ONLY = new Set(['magic_poker_debug', 'magic_poker_low_power']);

const isGameKey = (key: string) => (key.startsWith('magic_poker_') || key === 'has_played_before') && !DEVICE_ONLY.has(key);

export interface Backup {
  /** Cuándo se hizo la copia */
  at: number;
  /** Clave → valor tal cual estaba en localStorage */
  data: Record<string, string>;
}

// --- base64url (sin +, / ni =: se copia y pega sin sorpresas) ---
const toBase64Url = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromBase64Url = (text: string) => {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, ch => ch.charCodeAt(0));
};

const pipe = async (bytes: Uint8Array, stream: CompressionStream | DecompressionStream) =>
  new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).arrayBuffer());
const canCompress = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

/** Lo que hay guardado ahora mismo, como objeto */
export const snapshot = (): Backup => {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && isGameKey(key)) data[key] = localStorage.getItem(key) ?? '';
  }
  return { at: Date.now(), data };
};

/** El código de la copia de seguridad de este navegador */
export const exportBackup = async (): Promise<string> => {
  const { at, data } = snapshot();
  const bytes = new TextEncoder().encode(JSON.stringify({ v: VERSION, at, data }));
  if (canCompress()) return `${PREFIX}z${toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')))}`;
  return `${PREFIX}p${toBase64Url(bytes)}`;
};

/** Lee un código (null si no es una copia de seguridad válida). Ignora espacios y saltos de línea */
export const readBackup = async (text: string): Promise<Backup | null> => {
  const code = text.replace(/\s+/g, '');
  if (!code.startsWith(PREFIX)) return null;
  const kind = code.charAt(PREFIX.length);
  try {
    let bytes = fromBase64Url(code.slice(PREFIX.length + 1));
    if (kind === 'z') {
      if (!canCompress()) return null;
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    } else if (kind !== 'p') return null;
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { v?: number; at?: number; data?: unknown };
    if (parsed.v !== VERSION || !parsed.data || typeof parsed.data !== 'object') return null;
    const entries = Object.entries(parsed.data as Record<string, unknown>);
    if (entries.some(([k, v]) => !isGameKey(k) || typeof v !== 'string')) return null;
    return { at: typeof parsed.at === 'number' ? parsed.at : 0, data: Object.fromEntries(entries) as Record<string, string> };
  } catch {
    return null;
  }
};

/**
 * Deja este navegador exactamente como la copia: borra lo del juego que hubiera y
 * escribe lo de la copia. Luego hay que recargar (cada parte del juego lo tiene en memoria).
 */
export const applyBackup = (backup: Backup) => {
  const old: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && isGameKey(key)) old.push(key);
  }
  old.forEach(k => localStorage.removeItem(k));
  Object.entries(backup.data).forEach(([k, v]) => localStorage.setItem(k, v));
};
