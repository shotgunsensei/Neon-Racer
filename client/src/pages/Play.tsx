import { useEffect } from "react";
import { GameCanvas } from "@/components/game/GameCanvas";

export default function Play() {
  const handleGameOver = (score: number, level: number) => {
    console.log("Game Over! Final Score:", score, "Level:", level);
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, []);

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center p-2 sm:p-4 py-4 sm:py-8 relative"
      style={{ touchAction: 'none' }}
    >
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-0 w-[30vw] h-[30vw] bg-primary/10 rounded-full blur-[100px] mix-blend-screen" />
        <div className="absolute bottom-1/4 right-0 w-[40vw] h-[40vw] bg-secondary/10 rounded-full blur-[120px] mix-blend-screen" />
      </div>

      <div className="w-full max-w-4xl relative z-10 flex flex-col items-center gap-3 sm:gap-6">
        <div className="w-full flex justify-between items-end px-2">
          <div className="font-display font-bold text-sm sm:text-xl text-muted-foreground animate-pulse">
            // TERMINAL.ACTIVE
          </div>
          <div className="flex gap-2">
             <div className="w-2 h-2 rounded-full bg-primary box-glow-primary animate-ping" />
             <div className="w-2 h-2 rounded-full bg-secondary box-glow-secondary animate-ping" style={{animationDelay: '100ms'}} />
          </div>
        </div>

        <GameCanvas onGameOver={handleGameOver} />
      </div>
    </div>
  );
}
