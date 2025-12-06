// lib/fakeStorage.ts
const storage: Record<string, string> = {};

export const fakeStorage = {
  getItem: async (key: string) => storage[key] || null,
  setItem: async (key: string, value: string) => { storage[key] = value; },
  removeItem: async (key: string) => { delete storage[key]; },
};

