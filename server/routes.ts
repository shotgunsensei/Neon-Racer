import express, { type Express, type ErrorRequestHandler, type Request, type Response } from "express";
import type { Server } from "http";
import type { IStorage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { createScoreSubmissionLimiter, type ScoreSubmissionLimitOptions } from "./score-submission-limit";

const scoreBodyError: ErrorRequestHandler = (err, _req, res, next) => {
  if (err.type === "entity.too.large") {
    res.status(413).json({ message: "Score submission body is too large" });
  } else if (err.type === "entity.parse.failed") {
    res.status(400).json({ message: "Invalid JSON body" });
  } else {
    next(err);
  }
};

export async function registerRoutes(
  httpServer: Server,
  app: Express,
  storage: IStorage,
  limitOptions: ScoreSubmissionLimitOptions = {},
): Promise<Server> {
  
  app.get(api.scores.list.path, async (req, res) => {
    try {
      const scores = await storage.getHighScores();
      res.json(scores);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch high scores" });
    }
  });

  app.post(api.scores.create.path,
    createScoreSubmissionLimiter(limitOptions),
    express.json({ limit: "1kb" }),
    express.urlencoded({ extended: false, limit: "1kb" }),
    async (req: Request, res: Response) => {
      try {
        const input = api.scores.create.input.parse(req.body);
        const score = await storage.createHighScore(input);
        res.status(201).json(score);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({
            message: err.errors[0].message,
            field: err.errors[0].path.join('.'),
          });
        }
        res.status(500).json({ message: "Failed to save high score" });
      }
    }, scoreBodyError);

  return httpServer;
}

export async function seedDatabase(storage: IStorage) {
  try {
    const existingScores = await storage.getHighScores();
    if (existingScores.length === 0) {
      await storage.createHighScore({ playerName: "Maverick", score: 5000, level: 5 });
      await storage.createHighScore({ playerName: "Goose", score: 3500, level: 4 });
      await storage.createHighScore({ playerName: "Iceman", score: 2000, level: 3 });
    }
  } catch (err) {
    console.error("Failed to seed database:", err);
  }
}
