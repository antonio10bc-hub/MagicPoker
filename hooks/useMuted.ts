import { useSyncExternalStore } from 'react';
import { getMuteState, subscribeMute } from '@/lib/sounds';

const getServerMuted = () => false;

export const useMuted = (): boolean => useSyncExternalStore(subscribeMute, getMuteState, getServerMuted);
