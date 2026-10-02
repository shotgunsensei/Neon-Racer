import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const highScores = pgTable("high_scores", {
  id: serial("id").primaryKey(),
  playerName: text("player_name").notNull(),
  score: integer("score").notNull(),
  level: integer("level").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// GameCanvas submits a floored, nonnegative score and starts levels at 1.
// Keep drizzle-zod's integer/INT32 bounds; gameplay has no score or level cap.
export const insertHighScoreSchema = createInsertSchema(highScores, {
  playerName: z.string().trim().min(1, "Enter a player name").max(15, "Player name must be 15 characters or fewer"),
  score: (schema) => schema.min(0),
  level: (schema) => schema.min(1),
}).omit({
  id: true,
  createdAt: true,
});

export type HighScore = typeof highScores.$inferSelect;
export type InsertHighScore = z.infer<typeof insertHighScoreSchema>;
export type CreateHighScoreRequest = InsertHighScore;
export type HighScoreResponse = HighScore;
