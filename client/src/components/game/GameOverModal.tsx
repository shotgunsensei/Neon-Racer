import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, Trophy, RotateCcw } from "lucide-react";
import confetti from "canvas-confetti";
import { useLocation } from "wouter";
import { useCreateScore } from "@/hooks/use-scores";

interface GameOverModalProps {
  score: number;
  level: number;
  distance?: number;
  maxCombo?: number;
  maxMomentum?: number;
  nearMiss?: number;
  mode?: "arcade" | "racer" | "chaos";
  onRestart: () => void;
}

export function GameOverModal({
  score,
  level,
  distance = 0,
  maxCombo = 0,
  maxMomentum = 0,
  nearMiss = 0,
  mode = "arcade",
  onRestart,
}: GameOverModalProps) {
  const [playerName, setPlayerName] = useState("");
  const { mutate: createScore, isPending, isSuccess, isError } = useCreateScore();
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const successRestartRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => previousFocusRef.current?.focus();
  }, []);

  useEffect(() => {
    if (score >= 1000 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#00ffff", "#ff00ff", "#ffff00"],
      });
    }
  }, [score]);

  useEffect(() => {
    if (isSuccess) successRestartRef.current?.focus();
  }, [isSuccess]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    createScore({
      playerName: playerName.trim().substring(0, 15).toUpperCase(),
      score,
      level,
    });
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4 animate-in fade-in duration-500" role="dialog" aria-modal="true" aria-labelledby="score-accepted-title">
        <div className="bg-card border border-primary/70 box-glow-primary rounded-none p-6 sm:p-8 max-w-lg w-full text-center space-y-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center border border-primary bg-primary/10 text-primary"><Trophy className="h-7 w-7" /></div>
          <div><p className="font-mono text-[10px] uppercase tracking-[.25em] text-primary">Signature accepted</p><h2 id="score-accepted-title" className="mt-2 text-3xl font-display font-bold text-glow-primary text-primary sm:text-4xl">You left a mark.</h2></div>
          <p className="text-muted-foreground">Your run signature is now part of the mainframe.</p>

          <div className="grid grid-cols-1 gap-3 text-left">
            <div className="bg-background/50 p-4 rounded-lg border border-border/50">
              <p className="text-sm text-muted-foreground">Mode</p>
              <p className="text-2xl font-display text-primary capitalize">{mode}</p>
            </div>
            <div className="bg-background/50 p-4 rounded-lg border border-border/50">
              <p className="text-sm text-muted-foreground">Distance / Combo Peak</p>
              <p className="text-2xl font-display text-accent">
                {distance.toLocaleString()} / {maxCombo}
              </p>
            </div>
            <div className="bg-background/50 p-4 rounded-lg border border-border/50">
              <p className="text-sm text-muted-foreground">Near-Miss Peak</p>
              <p className="text-2xl font-display text-primary">{nearMiss}</p>
            </div>
            <div className="bg-background/50 p-4 rounded-lg border border-border/50">
              <p className="text-sm text-muted-foreground">Overdrive Peak</p>
              <p className="text-2xl font-display text-secondary">{maxMomentum.toFixed(1)}x</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-4">
            <button
              onClick={onRestart}
              ref={successRestartRef}
              className="px-6 py-4 rounded-xl font-display font-bold tracking-widest bg-primary/20 text-primary border-2 border-primary hover:bg-primary hover:text-primary-foreground hover:box-glow-primary transition-all duration-300 flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              RACE AGAIN
            </button>
            <button
              onClick={() => setLocation("/")}
              className="px-6 py-4 rounded-xl font-display font-bold tracking-widest bg-transparent text-muted-foreground border-2 border-muted hover:border-foreground hover:text-foreground transition-all duration-300"
            >
              MAIN MENU
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4 backdrop-blur-md animate-in fade-in duration-300" role="dialog" aria-modal="true" aria-labelledby="run-complete-title">
      <div className="bg-card border border-destructive/70 box-glow-destructive rounded-none p-6 sm:p-8 max-w-lg w-full text-center space-y-6 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent, transparent 10px, #fff 10px, #fff 20px)",
          }}
        />

        <p className="font-mono text-[10px] uppercase tracking-[.25em] text-destructive">Connection terminated</p>
        <h2 id="run-complete-title" className="text-4xl font-display font-black text-glow-destructive text-destructive sm:text-5xl">RUN COMPLETE</h2>

          <div className="grid grid-cols-2 gap-4 my-6">
          <div className="bg-background/50 p-4 rounded-lg border border-border/50">
            <div className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Final Score</div>
            <div className="text-3xl font-display font-bold text-accent">{score.toLocaleString()}</div>
          </div>
          <div className="bg-background/50 p-4 rounded-lg border border-border/50">
            <div className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Mode</div>
            <div className="text-3xl font-display font-bold text-primary capitalize">{mode}</div>
          </div>
          <div className="bg-background/50 p-4 rounded-lg border border-border/50">
            <div className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Level</div>
            <div className="text-3xl font-display font-bold text-primary">{level}</div>
          </div>
            <div className="bg-background/50 p-4 rounded-lg border border-border/50">
              <div className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Distance / Combo</div>
              <div className="text-3xl font-display font-bold text-secondary">
                {distance.toLocaleString()} / {maxCombo}
              </div>
            </div>
            <div className="bg-background/50 p-4 rounded-lg border border-border/50">
              <div className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Near-Miss Peak</div>
              <div className="text-3xl font-display font-bold text-primary">{nearMiss}</div>
            </div>
            <div className="bg-background/50 p-4 rounded-lg border border-border/50">
              <div className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Overdrive Peak</div>
              <div className="text-3xl font-display font-bold text-secondary">{maxMomentum.toFixed(1)}x</div>
            </div>
          </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 text-left">
            <label htmlFor="playerName" className="text-sm font-display tracking-widest text-primary">
              ENTER PILOT IDENTIFICATION
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                id="playerName"
                type="text"
                maxLength={15}
                required
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="YOUR NAME"
                className="w-full px-4 py-3 bg-background border-2 border-primary/50 rounded-xl font-display text-xl text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 uppercase transition-all"
                disabled={isPending}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                <span className="animate-pulse text-primary font-display">_</span>
              </div>
            </div>
          </div>

          {isError && <p className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">The mainframe refused the upload. Try again, or restart without submitting.</p>}
          <button
            type="submit"
            disabled={isPending || !playerName.trim()}
            className="w-full mt-4 px-6 py-4 rounded-xl font-display font-bold tracking-widest bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-lg hover:shadow-[0_0_20px_rgba(0,255,255,0.6)] hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 group"
          >
            {isPending ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                UPLOAD METRICS
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <button
          onClick={onRestart}
          disabled={isPending}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 pt-2 transition-colors disabled:opacity-50"
        >
          Skip and restart
        </button>
      </div>
    </div>
  );
}
