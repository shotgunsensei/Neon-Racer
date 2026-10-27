import assert from "node:assert/strict";
import test from "node:test";
import { seedDatabase } from "./routes";
import type { HighScore, InsertHighScore } from "../shared/schema";
import type { IStorage } from "./storage";

function fixture(existing: HighScore[] = []) {
  let reads = 0;
  const writes: InsertHighScore[] = [];
  const storage: IStorage = {
    async getHighScores() {
      reads++;
      return existing;
    },
    async createHighScore(input) {
      writes.push(input);
      return { ...input, id: writes.length, createdAt: null };
    },
  };
  return { storage, writes, get reads() { return reads; } };
}

for (const environment of ["production", "staging", "", "preview"]) {
  test(`startup never reads or seeds sample scores in ${environment || "an empty environment"}`, async () => {
    const state = fixture();
    await seedDatabase(state.storage, environment);
    assert.equal(state.reads, 0);
    assert.deepEqual(state.writes, []);
  });
}

test("startup is closed when NODE_ENV is absent", async () => {
  const previous = process.env.NODE_ENV;
  delete process.env.NODE_ENV;
  try {
    const state = fixture();
    await seedDatabase(state.storage);
    assert.equal(state.reads, 0);
    assert.deepEqual(state.writes, []);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

for (const environment of ["development", "test"]) {
  test(`explicit ${environment} may seed an empty synthetic leaderboard`, async () => {
    const state = fixture();
    await seedDatabase(state.storage, environment);
    assert.equal(state.reads, 1);
    assert.deepEqual(state.writes, [
      { playerName: "Maverick", score: 5000, level: 5 },
      { playerName: "Goose", score: 3500, level: 4 },
      { playerName: "Iceman", score: 2000, level: 3 },
    ]);
  });
}

test("development preserves an existing leaderboard without creating sample rows", async () => {
  const existing = [{ id: 9, playerName: "Local player", score: 42, level: 1, createdAt: null }];
  const state = fixture(existing);
  await seedDatabase(state.storage, "development");
  assert.equal(state.reads, 1);
  assert.deepEqual(state.writes, []);
  assert.deepEqual(existing, [{ id: 9, playerName: "Local player", score: 42, level: 1, createdAt: null }]);
});
