import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { GameCanvas } from "@/components/game/GameCanvas";
import { GameMode } from "@/components/game/GameEngine";

type PlayMode = Extract<GameMode, "arcade" | "racer" | "chaos">;

const MODES: { value: PlayMode; label: string; detail: string }[] = [
  { value: "arcade", label: "Arcade", detail: "Balanced race mode with smooth learning curve." },
  { value: "racer", label: "Racer", detail: "Higher speed and tighter obstacle timing." },
  { value: "chaos", label: "Chaos", detail: "Compressed lanes with max challenge." },
];

const resolveMode = (location: string): PlayMode => {
  const raw = location.split("?")[1];
  const params = new URLSearchParams(raw ?? "");
  const fromQuery = params.get("mode");
  if (fromQuery === "arcade" || fromQuery === "racer" || fromQuery === "chaos") return fromQuery;
  return "arcade";
};

interface LastRunSummary {
  score: number;
  level: number;
  distance: number;
  maxCombo: number;
  maxMomentum: number;
  nearMiss: number;
  mode: PlayMode;
}

export default function Play() {
  const [location, setLocation] = useLocation();
  const [selectedMode, setSelectedMode] = useState<PlayMode>(resolveMode(location));
  const [lastRun, setLastRun] = useState<LastRunSummary | null>(null);

  useEffect(() => {
    const nextMode = resolveMode(location);
    if (nextMode !== selectedMode) {
      setSelectedMode(nextMode);
    }
  }, [location, selectedMode]);

  const handleGameOver = (
    score: number,
    level: number,
    meta?: { score: number; level: number; distance: number; maxCombo: number; maxMomentum: number; nearMiss: number; mode: PlayMode },
  ) => {
    setLastRun({
      score,
      level,
      distance: meta?.distance ?? 0,
      maxCombo: meta?.maxCombo ?? 0,
      maxMomentum: meta?.maxMomentum ?? 0,
      nearMiss: meta?.nearMiss ?? 0,
      mode: meta?.mode ?? selectedMode,
    });
  };

  const selectMode = (mode: PlayMode) => {
    if (mode === selectedMode) return;
    setSelectedMode(mode);
    setLocation(`/play?mode=${mode}`);
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-2 py-4 sm:p-4 sm:py-8 relative touch-none">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-0 w-[30vw] h-[30vw] bg-primary/10 rounded-full blur-[100px] mix-blend-screen" />
        <div className="absolute bottom-1/4 right-0 w-[40vw] h-[40vw] bg-secondary/10 rounded-full blur-[120px] mix-blend-screen" />
      </div>

      <div className="w-full max-w-4xl relative z-10 flex flex-col items-center gap-6">
        <div className="w-full flex justify-between items-center px-2">
          <div className="font-display font-bold text-xl text-muted-foreground animate-pulse">
            // TERMINAL.ACTIVE
          </div>
          <div className="flex gap-2">
            <div className="w-2 h-2 rounded-full bg-primary box-glow-primary animate-ping" />
            <div className="w-2 h-2 rounded-full bg-secondary box-glow-secondary animate-ping" style={{ animationDelay: "100ms" }} />
          </div>
        </div>

        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
          {MODES.map((option) => {
            const active = option.value === selectedMode;
            return (
              <button
                key={option.value}
                onClick={() => selectMode(option.value)}
                className={`rounded-lg border px-4 py-3 text-left transition-all ${
                  active
                    ? "bg-primary/20 border-primary text-primary box-glow-primary"
                    : "bg-card/80 border-border/40 hover:border-primary/60"
                }`}
              >
                <p className="font-display font-bold text-lg uppercase">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.detail}</p>
              </button>
            );
          })}
        </div>

        <GameCanvas mode={selectedMode} onGameOver={handleGameOver} />

        {lastRun && (
          <div className="w-full bg-card/70 border border-secondary/40 rounded-lg p-4">
            <p className="text-sm text-muted-foreground uppercase tracking-widest">Last Run</p>
            <p className="font-display text-lg text-primary">
              {lastRun.score.toLocaleString()} pts · Lv {lastRun.level}
            </p>
            <p className="text-sm text-muted-foreground">
              Mode: {lastRun.mode} | Distance: {lastRun.distance} | Peak Combo: {lastRun.maxCombo} | Peak Near-Miss:{" "}
              {lastRun.nearMiss} | Peak Overdrive: {lastRun.maxMomentum.toFixed(1)}x
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
