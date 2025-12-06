"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fakeStorage = void 0;
// lib/fakeStorage.ts
const storage = {};
exports.fakeStorage = {
    getItem: async (key) => storage[key] || null,
    setItem: async (key, value) => { storage[key] = value; },
    removeItem: async (key) => { delete storage[key]; },
};
