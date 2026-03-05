import { Link } from "wouter";
import { Leaderboard } from "@/components/game/Leaderboard";
import { AnimatedBackground } from "@/components/game/AnimatedBackground";
import { Gamepad2, ArrowRight, Keyboard } from "lucide-react";
import neonRacerTitle from "@assets/neonracertitle_1772721613870.png";
import neonRacerHero from "@assets/neonracerhero_1772721613870.png";

export default function Home() {
  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />

      <div className="relative z-10 pt-12 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary font-display text-sm uppercase tracking-widest mb-4 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-primary box-glow-primary"></span>
                System Online
              </div>

              <div className="glow-pulse max-w-xl" data-testid="img-title-logo">
                <img
                  src={neonRacerTitle}
                  alt="Neon Racer"
                  className="w-full h-auto"
                />
              </div>

              <p className="text-xl text-muted-foreground max-w-lg leading-relaxed font-body">
                Navigate the mainframe. Avoid corruption blocks. Collect power-ups to survive the escalating speeds of the grid.
              </p>
            </div>

            <Link
              href="/play"
              className="group relative inline-flex items-center justify-center px-8 py-5 text-2xl font-bold font-display tracking-widest text-primary-foreground bg-primary rounded-xl transition-all hover:scale-105 box-glow-primary"
              data-testid="link-play"
            >
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
                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-primary font-mono">
                      &#8592;
                    </kbd>
                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-primary font-mono">
                      &#8594;
                    </kbd>
                  </div>
                  <span>Steer Ship</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-4 py-1 bg-muted border border-border rounded text-secondary font-mono tracking-widest">
                    SPACE
                  </kbd>
                  <span>Fire Weapon</span>
                </div>
              </div>
              <div className="pt-4 border-t border-border/50 grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-4 h-4 mt-1 bg-primary box-glow-primary rounded-full shrink-0" />
                  <p className="text-sm">
                    <strong className="text-foreground">SHIELD:</strong> Absorbs 1 fatal impact.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-4 h-4 mt-1 bg-secondary box-glow-secondary shrink-0 rotate-45" />
                  <p className="text-sm">
                    <strong className="text-foreground">WEAPON:</strong> Auto-fires lasers for 10s.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-8">
            <Leaderboard />

            <div className="glow-pulse hidden lg:block" data-testid="img-hero">
              <img
                src={neonRacerHero}
                alt="Neon Racer Hero"
                className="w-full h-auto rounded-xl"
              />
            </div>
          </div>
        </div>

        <footer className="max-w-7xl mx-auto mt-16 pb-4 text-center">
          <p className="text-sm text-muted-foreground">
            Brought to you by{" "}
            <a
              href="https://www.shotgunninjas.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-display tracking-wide"
              data-testid="link-shotgunninjas"
            >
              Shotgun Ninjas Productions
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
