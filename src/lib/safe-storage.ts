type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Keep the current tab usable when storage is disabled or its quota is full. */
export function createSafeStorage(resolve: () => BrowserStorage) {
  const memory = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      if (memory.has(key)) return memory.get(key)!;
      try {
        return resolve().getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string) {
      memory.set(key, value);
      try {
        resolve().setItem(key, value);
      } catch {
        /* Memory remains authoritative. */
      }
    },
  };
}

export const shopStorage = createSafeStorage(() => window.localStorage);
