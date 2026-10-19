import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { readMutedPreference, writeMutedPreference } from "./useGameAudio";

function restoreStorage(t: TestContext) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  });
}

test("blocked storage access cannot prevent boot or changing the session mute setting", t => {
  restoreStorage(t);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() { throw new DOMException("Storage blocked", "SecurityError"); },
  });
  assert.equal(readMutedPreference(), false);
  assert.doesNotThrow(() => writeMutedPreference(true));
  assert.doesNotThrow(() => writeMutedPreference(false));
});

test("read and write failures from an available storage object are contained", t => {
  restoreStorage(t);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem() { throw new Error("Read denied"); }, setItem() { throw new Error("Quota exceeded"); } },
  });
  assert.equal(readMutedPreference(), false);
  assert.doesNotThrow(() => writeMutedPreference(true));
});

test("available storage retains the existing key and true/false preference format", t => {
  restoreStorage(t);
  const stored = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) },
  });
  assert.equal(readMutedPreference(), false);
  writeMutedPreference(true);
  assert.equal(stored.get("neon-racer-muted"), "true");
  assert.equal(readMutedPreference(), true);
  writeMutedPreference(false);
  assert.equal(stored.get("neon-racer-muted"), "false");
  assert.equal(readMutedPreference(), false);
});
