import { useSyncExternalStore } from 'react';
import { getServerSettings, getSettings, Settings, subscribeSettings } from '@/lib/settings';

export const useSettings = (): Settings => useSyncExternalStore(subscribeSettings, getSettings, getServerSettings);
