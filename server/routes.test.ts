import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import test, { type TestContext } from "node:test";
import express from "express";
import { api } from "../shared/routes";
import { insertHighScoreSchema, type HighScore, type InsertHighScore } from "../shared/schema";
import { registerRoutes } from "./routes";
import type { IStorage } from "./storage";
import type { ScoreSubmissionLimitOptions } from "./score-submission-limit";

const valid = { playerName: "Pilot", score: 0, level: 1 };

async function fixture(t: TestContext, options: ScoreSubmissionLimitOptions = {}) {
  const writes: InsertHighScore[] = [];
  let failRead = false;
  let failWrite = false;
  const storage: IStorage = {
    async createHighScore(input) {
      if (failWrite) throw new Error("private database failure");
      writes.push(input);
      return { ...input, id: writes.length, createdAt: null };
    },
    async getHighScores() {
      if (failRead) throw new Error("private database failure");
      return writes.map((input, index): HighScore => ({ ...input, id: index + 1, createdAt: null }));
    },
  };
  const app = express();
  const server = createServer(app);
  await registerRoutes(server, app, storage, options);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => {
    server.closeAllConnections();
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const send = (body?: unknown, {
    method = "POST", raw, headers = {}, peer,
  }: { method?: string; raw?: string; headers?: Record<string, string>; peer?: string } = {}) =>
    new Promise<{ status: number; body: any; headers: import("node:http").IncomingHttpHeaders }>((resolve, reject) => {
      const req = request({
        hostname: "127.0.0.1", port: address.port, path: api.scores.create.path,
        method, localAddress: peer,
        headers: { "Content-Type": "application/json", ...headers },
      }, (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { text += chunk; });
        res.on("error", reject);
        res.on("end", () => resolve({ status: res.statusCode!, body: JSON.parse(text), headers: res.headers }));
      });
      req.on("error", reject);
      req.end(raw ?? (body === undefined ? undefined : JSON.stringify(body)));
    });
  return {
    writes, send,
    failRead: () => { failRead = true; },
    failWrite: () => { failWrite = true; },
  };
}

test("anonymous create trims a name, preserves score/level, and lists stored scores", async (t) => {
  const { writes, send } = await fixture(t);
  const response = await send({ ...valid, playerName: " \tNeon Pilot\n ", id: 123, createdAt: "ignored" });
  assert.equal(response.status, 201);
  assert.deepEqual(writes, [{ ...valid, playerName: "Neon Pilot" }]);
  assert.deepEqual(response.body, { ...writes[0], id: 1, createdAt: null });
  const listed = await send(undefined, { method: "GET" });
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body, [response.body]);
});

test("names allow 1-15 UTF-16 units after trimming, including Unicode and punctuation", async (t) => {
  const { writes, send } = await fixture(t);
  for (const playerName of ["X", "x".repeat(15), "é-飛行士🚀", "  " + "x".repeat(15) + "  "]) {
    assert.equal((await send({ ...valid, playerName })).status, 201);
    assert.equal(writes.at(-1)?.playerName, playerName.trim());
  }
});

const invalidCases: [string, unknown, string?][] = [
  ["empty name", { ...valid, playerName: "" }, "playerName"],
  ["whitespace name", { ...valid, playerName: " \t\r\n " }, "playerName"],
  ["overlong name", { ...valid, playerName: "x".repeat(16) }, "playerName"],
  ["padded overlong name", { ...valid, playerName: "  " + "x".repeat(16) + "  " }, "playerName"],
  ["nonstring name", { ...valid, playerName: 42 }, "playerName"],
  ["missing name", { score: 0, level: 1 }, "playerName"],
  ["negative score", { ...valid, score: -1 }, "score"],
  ["fractional score", { ...valid, score: 1.5 }, "score"],
  ["string score", { ...valid, score: "100" }, "score"],
  ["null score", { ...valid, score: null }, "score"],
  ["missing score", { playerName: "Pilot", level: 1 }, "score"],
  ["score overflow", { ...valid, score: 2_147_483_648 }, "score"],
  ["zero level", { ...valid, level: 0 }, "level"],
  ["negative level", { ...valid, level: -1 }, "level"],
  ["fractional level", { ...valid, level: 1.5 }, "level"],
  ["string level", { ...valid, level: "1" }, "level"],
  ["missing level", { playerName: "Pilot", score: 0 }, "level"],
  ["level overflow", { ...valid, level: 2_147_483_648 }, "level"],
  ["null body", null],
  ["array body", []],
];
for (const [label, body, field] of invalidCases) {
  test(`${label} is rejected before storage`, async (t) => {
    const { writes, send } = await fixture(t);
    const response = await send(body);
    assert.equal(response.status, 400);
    assert.equal(typeof response.body.message, "string");
    if (field) assert.equal(response.body.field, field);
    assert.deepEqual(writes, []);
  });
}

test("existing INT32 upper bounds remain valid without invented gameplay ceilings", async (t) => {
  const { writes, send } = await fixture(t);
  const body = { ...valid, score: 2_147_483_647, level: 2_147_483_647 };
  assert.equal((await send(body)).status, 201);
  assert.deepEqual(writes, [body]);
  for (const number of [NaN, Infinity, -Infinity]) {
    assert.equal(insertHighScoreSchema.safeParse({ ...valid, score: number }).success, false);
    assert.equal(insertHighScoreSchema.safeParse({ ...valid, level: number }).success, false);
  }
});

test("malformed, missing, and oversized bodies have bounded errors and never reach storage", async (t) => {
  const { writes, send } = await fixture(t);
  const malformed = await send(undefined, { raw: "{" });
  assert.equal(malformed.status, 400);
  assert.deepEqual(malformed.body, { message: "Invalid JSON body" });
  assert.equal((await send()).status, 400);
  const oversized = await send({ ...valid, unused: "x".repeat(1024) });
  assert.equal(oversized.status, 413);
  assert.deepEqual(oversized.body, { message: "Score submission body is too large" });
  assert.deepEqual(writes, []);
});

test("storage failures return generic errors", async (t) => {
  const { writes, send, failRead, failWrite } = await fixture(t);
  failWrite();
  const failedWrite = await send(valid);
  assert.equal(failedWrite.status, 500);
  assert.deepEqual(failedWrite.body, { message: "Failed to save high score" });
  assert.deepEqual(writes, []);
  failRead();
  const failedRead = await send(undefined, { method: "GET" });
  assert.equal(failedRead.status, 500);
  assert.deepEqual(failedRead.body, { message: "Failed to fetch high scores" });
});

test("default limit allows ten attempts then returns 429 with a usable retry countdown", async (t) => {
  let now = 1_000;
  const { writes, send } = await fixture(t, { now: () => now });
  for (let i = 0; i < 10; i++) assert.equal((await send(valid)).status, 201);
  const limited = await send(valid);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers["retry-after"], "60");
  assert.equal(limited.headers["cache-control"], "no-store");
  assert.deepEqual(api.scores.create.responses[429].parse(limited.body), {
    message: "Too many score submissions. Try again in 60 seconds.", retryAfter: 60,
  });
  assert.equal(writes.length, 10);
  now += 59_001;
  const beforeReset = await send(valid);
  assert.equal(beforeReset.status, 429);
  assert.equal(beforeReset.headers["retry-after"], "1");
  now += 999;
  assert.equal((await send(valid)).status, 201);
  assert.equal(writes.length, 11);
});

test("invalid attempts count, forwarded headers cannot bypass quotas, GET remains available", async (t) => {
  const { writes, send } = await fixture(t, { maxPerPeer: 2, now: () => 1_000 });
  assert.equal((await send(undefined, { raw: "{" })).status, 400);
  assert.equal((await send({ ...valid, playerName: " " })).status, 400);
  const response = await send(undefined, {
    raw: "x".repeat(2048),
    headers: { "X-Forwarded-For": "203.0.113.99", "X-Real-IP": "203.0.113.99" },
  });
  assert.equal(response.status, 429); // limiter runs before the body parser
  assert.deepEqual(writes, []);
  assert.equal((await send(undefined, { method: "GET" })).status, 200);
});

test("global attempt cap protects storage across peers and resets without retaining old quotas", async (t) => {
  let now = 1_000;
  const { writes, send } = await fixture(t, { maxPerPeer: 1, maxTotal: 3, now: () => now });
  assert.equal((await send(valid, { peer: "127.0.0.1" })).status, 201);
  assert.equal((await send(valid, { peer: "127.0.0.1" })).status, 429); // counts globally
  assert.equal((await send(valid, { peer: "127.0.0.2" })).status, 201);
  const limited = await send(valid, { peer: "127.0.0.3" });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers["retry-after"], "60");
  assert.equal(writes.length, 2);
  now += 60_000;
  assert.equal((await send(valid, { peer: "127.0.0.3" })).status, 201);
  assert.equal((await send(valid, { peer: "127.0.0.1" })).status, 201);
});

test("default global limit admits 100 attempts across peers and rejects the next", async (t) => {
  const { writes, send } = await fixture(t, { now: () => 1_000 });
  for (let peer = 1; peer <= 10; peer++) {
    for (let attempt = 0; attempt < 10; attempt++) {
      assert.equal((await send(valid, { peer: `127.0.0.${peer}` })).status, 201);
    }
  }
  assert.equal((await send(valid, { peer: "127.0.0.11" })).status, 429);
  assert.equal(writes.length, 100);
});
