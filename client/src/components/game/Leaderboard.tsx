import { useMemo } from "react";
import { useScores } from "@/hooks/use-scores";
import { Trophy, Medal, Orbit, Loader2, AlertCircle } from "lucide-react";

export function Leaderboard() {
  const { data: scores, isLoading, isError } = useScores();
  const top10 = useMemo(() => {
    if (!scores) return [];
    const sortedScores = [...scores].sort((a, b) => b.score - a.score);
    return sortedScores.slice(0, 10);
  }, [scores]);

  return (
    <div className="bg-card/80 backdrop-blur-md border border-secondary/50 rounded-xl p-6 box-glow-secondary relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 opacity-10">
        <Orbit className="w-64 h-64 text-secondary animate-spin-slow" style={{ animationDuration: '20s' }} />
      </div>

      <div className="flex items-center gap-3 mb-6 relative z-10">
        <Trophy className="w-8 h-8 text-secondary" />
        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-secondary to-accent">
          Hall of Fame
        </h2>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-secondary">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p className="font-display tracking-widest animate-pulse">Accessing Mainframe...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-12 text-destructive">
          <AlertCircle className="w-8 h-8 mb-4" />
          <p className="font-display">Connection Lost</p>
        </div>
      ) : top10.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="font-display">No racers registered yet.</p>
          <p className="text-sm mt-2">Be the first to leave your mark.</p>
        </div>
      ) : (
        <div className="space-y-3 relative z-10">
          {top10.map((score, index) => (
            <div 
              key={score.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-300 hover:scale-[1.02] ${
                index === 0 
                  ? "bg-accent/10 border-accent/50 text-accent" 
                  : index === 1
                  ? "bg-primary/10 border-primary/50 text-primary"
                  : index === 2
                  ? "bg-secondary/10 border-secondary/50 text-secondary"
                  : "bg-muted/30 border-border/20 text-foreground"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`font-display font-bold text-xl w-8 text-center ${
                  index < 3 ? "text-shadow-glow" : "opacity-50"
                }`}>
                  #{index + 1}
                </div>
                <div>
                  <div className="font-display font-bold tracking-wide text-lg">
                    {score.playerName}
                  </div>
                  <div className="text-xs opacity-70 flex items-center gap-2">
                    <span>Level {score.level}</span>
                    <span>•</span>
                    <span>{new Date(score.createdAt || Date.now()).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="font-display text-2xl font-black">
                  {score.score.toLocaleString()}
                </div>
                {index === 0 && <Medal className="w-5 h-5 text-accent animate-bounce" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
