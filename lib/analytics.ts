// --- ANALÍTICAS (PostHog) ---
// Eventos de juego anónimos para entender cómo se juega: el funnel (tutorial → jefes →
// Castillo → pisos), qué se elige en el mercader y en los cofres, qué cartas se juegan.
// Solo en la web publicada (nunca en local ni en los tests). Sin datos personales: un
// identificador anónimo por navegador. La librería se carga aparte para no frenar el
// arranque; los eventos de antes de que esté lista esperan en una cola.
import type { PostHog } from 'posthog-js';

/** Clave pública del proyecto (va en la web por diseño) */
const KEY = 'phc_xnbbVrZbqhjzk6GfeLxopJHkhtxFFXAxM96symjc2snN';
/** Se envía a través de la propia web (/ingest → PostHog EU, ver next.config.ts) para que
 *  los bloqueadores no se coman los eventos */
const HOST = '/ingest';
const UI_HOST = 'https://eu.posthog.com';

type Props = Record<string, string | number | boolean | null | undefined | string[]>;

let ph: PostHog | null = null;
let starting = false;
const queue: [string, Props | undefined][] = [];

const enabled = () => typeof window !== 'undefined' && process.env.NODE_ENV === 'production'
  && !['localhost', '127.0.0.1'].includes(window.location.hostname);

/** Arranca PostHog (una vez). `base`: propiedades que van en todos los eventos */
export const initAnalytics = (base: Props = {}) => {
  if (!enabled() || ph || starting) return;
  starting = true;
  import('posthog-js').then(({ default: posthog }) => {
    posthog.init(KEY, {
      api_host: HOST,
      ui_host: UI_HOST,
      // Solo lo que mandamos a mano: los clics automáticos no dicen nada en un canvas de juego
      autocapture: false,
      capture_pageview: true,
      capture_pageleave: true,
      disable_session_recording: true,
      person_profiles: 'identified_only',
    });
    posthog.register(base);
    ph = posthog;
    queue.splice(0).forEach(([e, p]) => posthog.capture(e, p));
  }).catch(() => { starting = false; });
};

/** Un evento de juego (si las analíticas no están activas, no hace nada) */
export const track = (event: string, props?: Props) => {
  if (!enabled()) return;
  if (ph) ph.capture(event, props);
  else if (queue.length < 200) queue.push([event, props]);
};
