import { useState, useEffect } from "react";
import { useCreateScore } from "@/hooks/use-scores";
import { Loader2, Zap, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";
import { useLocation } from "wouter";

interface GameOverModalProps {
  score: number;
  level: number;
  onRestart: () => void;
}

export function GameOverModal({ score, level, onRestart }: GameOverModalProps) {
  const [playerName, setPlayerName] = useState("");
  const { mutate: createScore, isPending, isSuccess } = useCreateScore();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Small explosion of confetti when game over screen appears
    if (score > 1000) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00FFFF', '#FF00FF', '#FFFF00']
      });
    }
  }, [score]);

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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4 animate-in fade-in duration-500">
        <div className="bg-card border-2 border-primary box-glow-primary rounded-2xl p-8 max-w-md w-full text-center space-y-6">
          <h2 className="text-4xl font-display font-bold text-glow-primary text-primary">Score Uploaded!</h2>
          <p className="text-xl">Your legacy is secured in the mainframe.</p>
          
          <div className="flex flex-col gap-4 pt-4">
            <button
              onClick={onRestart}
              className="px-6 py-4 rounded-xl font-display font-bold tracking-widest bg-primary/20 text-primary border-2 border-primary hover:bg-primary hover:text-primary-foreground hover:box-glow-primary transition-all duration-300 flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5" />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-card border-2 border-destructive box-glow-destructive rounded-2xl p-8 max-w-md w-full text-center space-y-6 relative overflow-hidden">
        
        {/* Striped overlay for style */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" 
             style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #fff 10px, #fff 20px)' }}>
        </div>

        <h2 className="text-5xl font-display font-black text-glow-destructive text-destructive">CRASHED</h2>
        
        <div className="grid grid-cols-2 gap-4 my-6">
          <div className="bg-background/50 p-4 rounded-lg border border-border/50">
            <div className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Final Score</div>
            <div className="text-3xl font-display font-bold text-accent">{score.toLocaleString()}</div>
          </div>
          <div className="bg-background/50 p-4 rounded-lg border border-border/50">
            <div className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Level Reached</div>
            <div className="text-3xl font-display font-bold text-primary">{level}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 text-left">
            <label htmlFor="playerName" className="text-sm font-display tracking-widest text-primary">ENTER PILOT IDENTIFICATION</label>
            <div className="relative">
              <input
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
          Skip and Restart
        </button>
      </div>
    </div>
  );
}
