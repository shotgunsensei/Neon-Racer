import assert from "node:assert/strict";
import { test } from "node:test";
import { desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import { highScores, insertHighScoreSchema } from "../shared/schema";

const identifiers = ["ordinary_name", 'score";--', 'a""b', '雪"suffix'];
const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

test("PostgreSQL identifiers remain one quoted name with embedded delimiters and Unicode", () => {
  const dialect = new PgDialect();
  for (const identifier of identifiers) {
    const query = dialect.sqlToQuery(sql`select ${sql.identifier(identifier)}`);
    assert.equal(query.sql, `select ${quoteIdentifier(identifier)}`);
    assert.deepEqual(query.params, []);
  }
});

test("PostgreSQL selection aliases escape embedded delimiters without changing ordinary aliases", () => {
  const db = drizzle.mock();
  for (const alias of identifiers) {
    const query = db.select({ value: sql<number>`1`.as(alias) }).from(highScores).toSQL();
    assert.equal(query.sql, `select 1 as ${quoteIdentifier(alias)} from "high_scores"`);
    assert.deepEqual(query.params, []);
  }
});

test("ORM upgrade retains leaderboard defaults, integer bounds and stripped server-owned fields", () => {
  const input = insertHighScoreSchema.parse({
    playerName: "  O'Neil π  ",
    score: 0,
    level: 1,
    id: 99,
    createdAt: "2026-01-01",
    sort: 'score";--',
  });
  assert.deepEqual(input, { playerName: "O'Neil π", score: 0, level: 1 });
  const query = drizzle.mock().insert(highScores).values(input).returning().toSQL();
  assert.equal(query.sql, 'insert into "high_scores" ("id", "player_name", "score", "level", "created_at") values (default, $1, $2, $3, default) returning "id", "player_name", "score", "level", "created_at"');
  assert.deepEqual(query.params, ["O'Neil π", 0, 1]);
  for (const score of [-1, 0.5, 2_147_483_648]) {
    assert.equal(insertHighScoreSchema.safeParse({ ...input, score }).success, false);
  }
  for (const level of [0, 1.5, 2_147_483_648]) {
    assert.equal(insertHighScoreSchema.safeParse({ ...input, level }).success, false);
  }
  assert.equal(insertHighScoreSchema.safeParse({ ...input, score: 2_147_483_647, level: 2_147_483_647 }).success, true);
});

test("PostgreSQL adapter binds score values and maps returned rows without a live database", async () => {
  const calls: Array<{ text: string; rowMode?: string; parameters: unknown[] }> = [];
  const client = {
    async query(query: { text: string; rowMode?: string }, parameters: unknown[]) {
      calls.push({ text: query.text, rowMode: query.rowMode, parameters });
      return { rows: [[1, 'O\'Neil "π"', 0, 1, "2026-10-14 18:00:00"]] };
    },
  };
  const db = drizzle(client as any);
  const input = insertHighScoreSchema.parse({ playerName: 'O\'Neil "π"', score: 0, level: 1 });
  const [inserted] = await db.insert(highScores).values(input).returning();
  assert.deepEqual(calls[0].parameters, [input.playerName, 0, 1]);
  assert.equal(calls[0].rowMode, "array");
  assert.ok(!calls[0].text.includes(input.playerName));
  assert.deepEqual(inserted, { id: 1, ...input, createdAt: new Date("2026-10-14T18:00:00Z") });

  const scores = await db.select().from(highScores).orderBy(desc(highScores.score)).limit(10);
  assert.deepEqual(scores, [inserted]);
  assert.deepEqual(calls[1].parameters, [10]);
  assert.match(calls[1].text, /order by "high_scores"\."score" desc limit \$1$/);
});
