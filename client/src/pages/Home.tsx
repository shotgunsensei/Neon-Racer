import { Link } from "wouter";
import { Leaderboard } from "@/components/game/Leaderboard";
import { AnimatedBackground } from "@/components/game/AnimatedBackground";
import { ArrowUpRight, Cpu, Gamepad2, Keyboard, Radio, Shield, Zap } from "lucide-react";

const manual = [
  { key: "←  →", title: "Steer", detail: "Thread the live lanes", tone: "text-primary" },
  { key: "SPACE", title: "Fire", detail: "Clear corruption ahead", tone: "text-secondary" },
  { key: "F", title: "Neon Surge", detail: "Turn pressure into power", tone: "text-accent" },
];

export default function Home() {
  return (
    <main className="relative min-h-[100dvh] overflow-hidden px-4 pb-16 pt-6 sm:px-8 lg:px-12">
      <AnimatedBackground />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_15%,hsl(var(--background)/.7)_90%)]" />
      <div className="relative z-10 mx-auto max-w-7xl">
        <header className="flex items-center justify-between border-b border-border/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center border border-primary/50 bg-primary/10 text-primary">
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.28em] text-primary/75">SNP // 07</p>
              <p className="font-display text-sm font-bold tracking-[.16em]">NEON RACER</p>
            </div>
          </div>
          <p className="hidden font-mono text-[10px] uppercase tracking-[.25em] text-muted-foreground sm:block">Hostile mainframe / live feed</p>
        </header>

        <section className="grid min-h-[630px] items-center gap-12 py-16 lg:grid-cols-[1.15fr_.85fr] lg:py-20">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-7 inline-flex items-center gap-2 border border-primary/35 bg-primary/5 px-3 py-2 font-mono text-[11px] uppercase tracking-[.2em] text-primary">
              <span className="h-1.5 w-1.5 animate-pulse bg-primary" /> Connection accepted
            </div>
            <h1 className="max-w-4xl font-display text-[clamp(4rem,12vw,9.5rem)] font-bold leading-[.82] tracking-[-.09em] text-foreground">
              RUN
              <span className="block text-primary text-glow-primary">THE</span>
              <span className="block text-secondary text-glow-secondary">VOID</span>
            </h1>
            <p className="mt-9 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              An arcade run inside a living mainframe. Read the signal, cut through the corruption, and leave a score the system cannot forget.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/play" className="group inline-flex items-center gap-4 bg-primary px-6 py-4 font-display text-sm font-bold uppercase tracking-[.16em] text-primary-foreground transition-transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background">
                <Gamepad2 className="h-5 w-5" /> Initialize run <ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </Link>
              <span className="font-mono text-[11px] uppercase tracking-[.18em] text-muted-foreground">No restore point</span>
            </div>
          </div>

          <aside className="relative border border-border/80 bg-card/75 p-6 backdrop-blur-sm sm:p-8">
            <div className="absolute -right-px -top-px h-16 w-16 border-r border-t border-secondary/70" />
            <div className="mb-9 flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.25em] text-secondary">Pilot manual</p>
                <h2 className="mt-2 text-2xl font-semibold">Make the machine blink.</h2>
              </div>
              <Keyboard className="h-6 w-6 text-secondary" />
            </div>
            <div className="space-y-5">
              {manual.map((item) => (
                <div key={item.key} className="flex items-center gap-4 border-b border-border/60 pb-4 last:border-0 last:pb-0">
                  <kbd className={`min-w-[74px] border border-current/40 bg-background px-2 py-2 text-center font-mono text-xs ${item.tone}`}>{item.key}</kbd>
                  <div><p className="font-display text-sm font-semibold uppercase tracking-wide">{item.title}</p><p className="text-sm text-muted-foreground">{item.detail}</p></div>
                </div>
              ))}
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3 border-t border-border/60 pt-6">
              <div><Shield className="mb-2 h-4 w-4 text-primary" /><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Shield</p><p className="text-sm">One fatal impact</p></div>
              <div><Zap className="mb-2 h-4 w-4 text-accent" /><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Data Storm</p><p className="text-sm">Challenge waves inbound</p></div>
            </div>
          </aside>
        </section>

        <section className="grid gap-10 border-t border-border/70 pt-12 lg:grid-cols-[.8fr_1.2fr]">
          <div className="flex items-start gap-4">
            <Cpu className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <div><p className="font-mono text-[10px] uppercase tracking-[.25em] text-primary">The objective</p><p className="mt-2 max-w-md text-2xl font-semibold leading-tight">Stay ahead of the pattern that is learning you.</p></div>
          </div>
          <Leaderboard />
        </section>

        <footer className="mt-16 flex flex-col gap-3 border-t border-border/60 pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono uppercase tracking-[.16em]">Signal ends when you do.</p>
          <p>Brought to you by <a href="https://www.shotgunninjas.com" target="_blank" rel="noopener noreferrer" className="text-primary underline decoration-primary/40 underline-offset-4" data-testid="link-shotgunninjas">Shotgun Ninjas Productions</a></p>
        </footer>
      </div>
    </main>
  );
}