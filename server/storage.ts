import { db } from "./db";
import { highScores, type InsertHighScore, type HighScore } from "@shared/schema";
import { desc } from "drizzle-orm";

export interface IStorage {
  getHighScores(): Promise<HighScore[]>;
  createHighScore(score: InsertHighScore): Promise<HighScore>;
}

export class DatabaseStorage implements IStorage {
  async getHighScores(): Promise<HighScore[]> {
    return await db.select()
      .from(highScores)
      .orderBy(desc(highScores.score))
      .limit(10);
  }

  async createHighScore(insertHighScore: InsertHighScore): Promise<HighScore> {
    const [score] = await db.insert(highScores)
      .values(insertHighScore)
      .returning();
    return score;
  }
}

export const storage = new DatabaseStorage();
