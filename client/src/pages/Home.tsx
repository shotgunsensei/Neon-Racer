import { Link } from "wouter";
import { Leaderboard } from "@/components/game/Leaderboard";
import { Gamepad2, ArrowRight, Keyboard } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen pt-12 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Dynamic Background Gradients */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-secondary/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        
        {/* Left Column: Hero & Controls */}
        <div className="lg:col-span-7 space-y-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary font-display text-sm uppercase tracking-widest mb-4 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-primary box-glow-primary"></span>
              System Online
            </div>
            <h1 className="text-6xl sm:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-primary via-white to-secondary text-glow-primary drop-shadow-2xl">
              NEON RACER
            </h1>
            <p className="text-xl text-muted-foreground max-w-lg leading-relaxed font-body">
              Navigate the mainframe. Avoid corruption blocks. Collect power-ups to survive the escalating speeds of the grid.
            </p>
          </div>

          <Link href="/play" className="group relative inline-flex items-center justify-center px-8 py-5 text-2xl font-bold font-display tracking-widest text-primary-foreground bg-primary overflow-hidden rounded-xl transition-all hover:scale-105 box-glow-primary">
            <span className="absolute inset-0 w-full h-full -mt-1 rounded-lg opacity-30 bg-gradient-to-b from-transparent via-transparent to-black" />
            <span className="relative flex items-center gap-3">
              <Gamepad2 className="w-8 h-8" />
              INITIALIZE RUN
              <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
            </span>
          </Link>

          <div className="bg-card/50 backdrop-blur border border-border/50 rounded-xl p-6 space-y-4">
            <h3 className="font-display text-lg text-foreground flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-primary" />
              PILOT MANUAL
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-muted border border-border rounded text-primary font-mono">←</kbd>
                  <kbd className="px-2 py-1 bg-muted border border-border rounded text-primary font-mono">→</kbd>
                </div>
                <span>Steer Ship</span>
              </div>
              <div className="flex items-center gap-3">
                <kbd className="px-4 py-1 bg-muted border border-border rounded text-secondary font-mono tracking-widest">SPACE</kbd>
                <span>Fire Weapon</span>
              </div>
            </div>
            <div className="pt-4 border-t border-border/50 grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-4 h-4 mt-1 bg-primary box-glow-primary rounded-full shrink-0" />
                <p className="text-sm"><strong className="text-foreground">SHIELD:</strong> Absorbs 1 fatal impact.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-4 h-4 mt-1 bg-secondary box-glow-secondary shrink-0 rotate-45" />
                <p className="text-sm"><strong className="text-foreground">WEAPON:</strong> Auto-fires lasers for 10s.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Leaderboard */}
        <div className="lg:col-span-5 h-full">
          <Leaderboard />
        </div>
      </div>
    </div>
  );
}
