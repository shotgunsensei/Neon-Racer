import type { RequestHandler } from "express";

export interface ScoreSubmissionLimitOptions {
  windowMs?: number;
  maxPerPeer?: number;
  maxTotal?: number;
  now?: () => number;
}

// Limits attempts, including invalid bodies, before parsing or touching storage.
// Global admission also bounds the peer map to at most maxTotal entries/window.
export function createScoreSubmissionLimiter({
  windowMs = 60_000,
  maxPerPeer = 10,
  maxTotal = 100,
  now = Date.now,
}: ScoreSubmissionLimitOptions = {}): RequestHandler {
  for (const value of [windowMs, maxPerPeer, maxTotal]) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new Error("Score submission limits must be positive safe integers");
    }
  }
  let resetAt = 0;
  let total = 0;
  const peers = new Map<string, number>();

  return (req, res, next) => {
    const time = now();
    if (time >= resetAt) {
      resetAt = time + windowMs;
      total = 0;
      peers.clear();
    }

    // Use the actual network peer. Unverified forwarding headers cannot mint
    // new quotas, even if someone later enables Express's trust proxy setting.
    const peer = req.socket.remoteAddress ?? "unknown";
    const peerAttempts = peers.get(peer) ?? 0;
    const retryAfter = Math.max(1, Math.ceil((resetAt - time) / 1000));
    const reject = () => {
      res.set("Retry-After", String(retryAfter));
      res.set("Cache-Control", "no-store");
      res.status(429).json({
        message: `Too many score submissions. Try again in ${retryAfter} seconds.`,
        retryAfter,
      });
    };

    if (total >= maxTotal) {
      reject();
      return;
    }
    total += 1;
    if (peerAttempts >= maxPerPeer) {
      reject();
      return;
    }
    peers.set(peer, peerAttempts + 1);
    next();
  };
}
