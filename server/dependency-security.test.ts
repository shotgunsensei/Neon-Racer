import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import express from "express";
import { Receiver } from "ws";
import { match } from "path-to-regexp";
import { drizzle } from "drizzle-orm/node-postgres";
import { desc } from "drizzle-orm";
import { highScores, insertHighScoreSchema } from "../shared/schema";

const require = createRequire(import.meta.url);
const proxyaddr = require("proxy-addr");
const qs = require("qs");

test("patched proxy trust rejects short mapped IPv6 aliases while preserving correctly scoped proxies", () => {
  for (const subnet of ["::ffff:10.0.0.0/8", "::/1"]) {
    const trust = proxyaddr.compile(subnet);
    assert.equal(trust("203.0.113.7", 0), false);
    assert.equal(trust("10.1.2.3", 0), false);
  }
  for (const subnet of ["10.0.0.0/8", "::ffff:10.0.0.0/104"]) {
    const trust = proxyaddr.compile(subnet);
    assert.equal(trust("203.0.113.7", 0), false);
    assert.equal(trust("10.1.2.3", 0), true);
  }
  assert.equal(express().get("trust proxy"), false);
});

test("patched qs safely serializes hostile constructor shapes and preserves ordinary Unicode fields", () => {
  for (const input of ["x%5Bconstructor%5D%5BisBuffer%5D=y", "x%5Bconstructor%5D%5BisBuffer%5D=true"]) {
    const parsed = qs.parse(input, { plainObjects: true });
    assert.doesNotThrow(() => qs.stringify(parsed));
  }
  const fields = { playerName: "Neon π", score: "0", level: "1" };
  assert.deepEqual(qs.parse(qs.stringify(fields)), fields);
});

test("patched body parsers reject invalid limits and retain the existing 1 KiB configuration", () => {
  for (const limit of ["invalid", Number.NaN]) {
    assert.throws(() => express.json({ limit }));
    assert.throws(() => express.urlencoded({ extended: false, limit }));
  }
  assert.doesNotThrow(() => express.json({ limit: "1kb" }));
  assert.doesNotThrow(() => express.urlencoded({ extended: false, limit: "1kb" }));
});

test("patched route compiler preserves fixed API and root/nested SPA fallback paths", () => {
  const api = match("/api/scores");
  assert.ok(api("/api/scores"));
  assert.equal(api("/api/scores/extra"), false);
  const spa = match("/{*path}");
  for (const path of ["/", "/play", "/play/one/two"]) assert.ok(spa(path));
});

async function receive(frames: number[][], limits: { maxFragments?: number; maxBufferedChunks?: number }) {
  const receiver = new Receiver({ isServer: false, maxPayload: 128, ...limits });
  let message: Buffer | undefined;
  receiver.on("message", data => { message = Buffer.from(data as Buffer); });
  receiver.on("error", () => {});
  let error: (Error & { code?: string }) | null = null;
  for (const frame of frames) {
    error = await new Promise(resolve => receiver.write(Buffer.from(frame), err => resolve(err ?? null)));
    if (error) break;
  }
  receiver.destroy();
  return { error, message };
}

test("patched ws bounds tiny fragment and partial-payload wrappers without rejecting ordinary messages", async () => {
  const fragmented = await receive([[0x02, 1, 97], [0x00, 1, 98], [0x80, 1, 99]], { maxFragments: 2 });
  assert.equal(fragmented.error?.code, "WS_ERR_TOO_MANY_BUFFERED_PARTS");
  assert.match(fragmented.error?.message ?? "", /fragments/);
  const chunked = await receive([[0x82, 126, 0, 32], [97], [98], [99]], { maxBufferedChunks: 2 });
  assert.equal(chunked.error?.code, "WS_ERR_TOO_MANY_BUFFERED_PARTS");
  const ordinary = await receive([[0x02, 1, 97], [0x80, 1, 98]], { maxFragments: 2, maxBufferedChunks: 2 });
  assert.equal(ordinary.error, null);
  assert.equal(ordinary.message?.toString(), "ab");
});

test("static leaderboard identifiers keep submitted punctuation in SQL parameters", () => {
  const db = drizzle.mock();
  for (const playerName of ['x";--', "O'Neil", "π"] ) {
    const input = insertHighScoreSchema.parse({ playerName, score: 0, level: 1, sort: 'score";--' });
    const insert = db.insert(highScores).values(input).returning().toSQL();
    assert.ok(insert.sql.startsWith('insert into "high_scores"'));
    assert.ok(!insert.sql.includes(playerName));
    assert.ok(insert.params.includes(playerName));
    assert.equal(Object.hasOwn(input, "sort"), false);
  }
  const query = db.select().from(highScores).orderBy(desc(highScores.score)).limit(10).toSQL();
  assert.ok(query.sql.includes('order by "high_scores"."score" desc'));
});
