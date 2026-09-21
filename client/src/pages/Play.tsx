import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { GameCanvas } from "@/components/game/GameCanvas";
import { GameMode } from "@/components/game/GameEngine";
import { ArrowLeft, Crosshair, Radio, Zap } from "lucide-react";

type PlayMode = Extract<GameMode, "arcade" | "racer" | "chaos">;
const MODES: { value: PlayMode; label: string; detail: string; stat: string }[] = [
  { value: "arcade", label: "Arcade", detail: "Learn the signal.", stat: "Balanced" },
  { value: "racer", label: "Racer", detail: "Faster. Less mercy.", stat: "High velocity" },
  { value: "chaos", label: "Chaos", detail: "The lanes fight back.", stat: "Data Storm" },
];
const resolveMode = (): PlayMode => {
  const mode = new URLSearchParams(window.location.search).get("mode");
  return mode === "racer" || mode === "chaos" || mode === "arcade" ? mode : "arcade";
};
interface LastRunSummary { score: number; level: number; distance: number; maxCombo: number; maxMomentum: number; nearMiss: number; mode: PlayMode; }

export default function Play() {
  const [location, setLocation] = useLocation();
  const [selectedMode, setSelectedMode] = useState<PlayMode>(resolveMode);
  const [lastRun, setLastRun] = useState<LastRunSummary | null>(null);
  useEffect(() => setSelectedMode(resolveMode()), [location]);
  useEffect(() => {
    const overflow = document.body.style.overflow, touch = document.body.style.touchAction;
    document.body.style.overflow = "hidden"; document.body.style.touchAction = "none";
    return () => { document.body.style.overflow = overflow; document.body.style.touchAction = touch; };
  }, []);
  const selectMode = (mode: PlayMode) => { setSelectedMode(mode); setLocation(`/play?mode=${mode}`); };
  const handleGameOver = (score: number, level: number, meta?: LastRunSummary) => setLastRun({ score, level, distance: meta?.distance ?? 0, maxCombo: meta?.maxCombo ?? 0, maxMomentum: meta?.maxMomentum ?? 0, nearMiss: meta?.nearMiss ?? 0, mode: meta?.mode ?? selectedMode });

  return (
    <main className="relative flex h-[100dvh] flex-col items-center overflow-hidden bg-background px-3 py-4 sm:px-6 sm:py-6">
      <div className="pointer-events-none fixed inset-0 opacity-60 [background-image:linear-gradient(hsl(var(--border)/.13)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/.13)_1px,transparent_1px)] [background-size:56px_56px]" />
      <div className="relative z-10 flex w-full max-w-5xl min-h-0 flex-1 flex-col gap-2 sm:gap-3">
        <header className="flex items-center justify-between border-b border-border/70 pb-2">
          <button onClick={() => setLocation("/")} className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.15em] text-muted-foreground transition-colors hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary" aria-label="Return to main menu"><ArrowLeft className="h-4 w-4" /> Menu</button>
          <div className="flex items-center gap-3"><Radio className="h-4 w-4 text-primary" /><span className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">Live connection</span><span className="h-2 w-2 animate-pulse bg-primary" /></div>
        </header>
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div><p className="font-mono text-[10px] uppercase tracking-[.25em] text-secondary">Choose your exposure</p><h1 className="mt-1 text-xl font-bold tracking-tight sm:text-3xl">Enter the mainframe</h1></div>
          <p className="hidden sm:block max-w-xs text-left text-sm text-muted-foreground sm:text-right">F triggers Neon Surge. In Chaos, Data Storm challenge waves escalate the run.</p>
        </div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Game mode">
          {MODES.map((option) => {
            const active = option.value === selectedMode;
            return <button key={option.value} role="radio" aria-checked={active} onClick={() => selectMode(option.value)} className={`group relative overflow-hidden border p-2 sm:p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-primary ${active ? "border-primary bg-primary/10 box-glow-primary" : "border-border/70 bg-card/60 hover:border-primary/50"}`}>
              <span className={`absolute left-0 top-0 h-full w-1 transition-transform ${active ? "bg-primary" : "scale-y-0 bg-border group-hover:scale-y-100"}`} />
              <div className="flex items-center justify-between"><span className="font-display text-xs sm:text-base font-bold uppercase tracking-wider">{option.label}</span><span className={`hidden sm:inline font-mono text-[9px] uppercase tracking-wider ${active ? "text-primary" : "text-muted-foreground"}`}>{option.stat}</span></div>
              <p className="hidden sm:block mt-1 text-sm text-muted-foreground">{option.detail}</p>
            </button>;
          })}
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center py-1"><GameCanvas mode={selectedMode} onGameOver={handleGameOver} /></div>
        {lastRun && <div className="grid grid-cols-2 gap-x-6 gap-y-2 border border-border/70 bg-card/70 px-4 py-3 text-sm sm:grid-cols-5">
          <div><p className="font-mono text-[9px] uppercase text-muted-foreground">Last signal</p><p className="font-display font-bold text-primary">{lastRun.score.toLocaleString()}</p></div>
          <div><p className="font-mono text-[9px] uppercase text-muted-foreground">Level</p><p className="font-display font-bold">{lastRun.level}</p></div>
          <div><p className="font-mono text-[9px] uppercase text-muted-foreground">Distance</p><p className="font-display font-bold">{lastRun.distance.toLocaleString()}</p></div>
          <div><p className="font-mono text-[9px] uppercase text-muted-foreground">Peak combo</p><p className="font-display font-bold text-accent">{lastRun.maxCombo}</p></div>
          <div><p className="font-mono text-[9px] uppercase text-muted-foreground">Mode</p><p className="font-display font-bold capitalize text-secondary">{lastRun.mode}</p></div>
        </div>}
        <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-1 pb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><span className="inline-flex items-center gap-1"><Crosshair className="h-3 w-3 text-primary" /> A / D or ← → · double-tap to roll</span><span className="inline-flex items-center gap-1"><Zap className="h-3 w-3 text-accent" /> F surge</span></div>
      </div>
    </main>
  );
}