import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get(api.scores.list.path, async (req, res) => {
    try {
      const scores = await storage.getHighScores();
      res.json(scores);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch high scores" });
    }
  });

  app.post(api.scores.create.path, async (req, res) => {
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
  });

  return httpServer;
}

export async function seedDatabase() {
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
