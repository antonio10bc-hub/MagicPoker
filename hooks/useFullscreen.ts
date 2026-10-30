import { useEffect, useState } from 'react';
import { desktop } from '@/lib/platform';

/** Pantalla completa de la app de escritorio: el estado (también si cambia con F11) y cómo cambiarlo */
export const useFullscreen = (): [boolean, (on: boolean) => void] => {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const d = desktop();
    if (!d) return;
    d.isFullscreen().then(setOn);
    return d.onFullscreen(setOn);
  }, []);
  return [on, v => { setOn(v); desktop()?.setFullscreen(v); }];
};
