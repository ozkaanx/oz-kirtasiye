'use client';

import { useSyncExternalStore } from 'react';

let timestamp = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function tick() {
  timestamp = Date.now();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    tick();
    timer = setInterval(tick, 60_000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) clearInterval(timer);
  };
}

const getSnapshot = () => timestamp;
const getServerSnapshot = () => 0;

/** Shared display clock; database checks remain authoritative for validity. */
export function useClock() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
