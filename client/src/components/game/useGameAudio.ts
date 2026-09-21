import { useCallback, useEffect, useRef, useState } from "react";

export type GameSound =
  | "launch"
  | "shot"
  | "impact"
  | "pickup"
  | "nearMiss"
  | "level"
  | "surge"
  | "storm"
  | "stormClear"
  | "shieldBreak"
  | "crash";

const SOUND_SHAPES: Record<GameSound, [number, number, number, OscillatorType, number]> = {
  launch: [180, 520, 0.22, "sawtooth", 0.09],
  shot: [820, 360, 0.055, "square", 0.025],
  impact: [150, 70, 0.12, "sawtooth", 0.06],
  pickup: [420, 960, 0.18, "sine", 0.08],
  nearMiss: [260, 700, 0.1, "triangle", 0.045],
  level: [330, 880, 0.3, "square", 0.065],
  surge: [110, 1320, 0.42, "sawtooth", 0.11],
  storm: [95, 52, 0.55, "sawtooth", 0.09],
  stormClear: [300, 1100, 0.5, "triangle", 0.1],
  shieldBreak: [900, 120, 0.26, "square", 0.1],
  crash: [140, 38, 0.65, "sawtooth", 0.13],
};

export function useGameAudio() {
  const contextRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const ambienceRef = useRef<GainNode | null>(null);
  const lastPlayedRef = useRef<Record<string, number>>({});
  const [muted, setMutedState] = useState(() => localStorage.getItem("neon-racer-muted") === "true");
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const ensureAudio = useCallback(() => {
    if (contextRef.current) {
      if (contextRef.current.state === "suspended") void contextRef.current.resume();
      return contextRef.current;
    }

    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const master = context.createGain();
    const ambience = context.createGain();
    master.gain.value = mutedRef.current ? 0 : 0.7;
    ambience.gain.value = 0.018;
    ambience.connect(master);
    master.connect(context.destination);

    const hum = context.createOscillator();
    const overtone = context.createOscillator();
    hum.type = "sine";
    overtone.type = "triangle";
    hum.frequency.value = 55;
    overtone.frequency.value = 82.5;
    hum.connect(ambience);
    overtone.connect(ambience);
    hum.start();
    overtone.start();

    contextRef.current = context;
    masterRef.current = master;
    ambienceRef.current = ambience;
    return context;
  }, []);

  const play = useCallback(
    (sound: GameSound) => {
      if (mutedRef.current) return;
      const nowMs = performance.now();
      const minGap = sound === "shot" ? 75 : sound === "nearMiss" ? 140 : 40;
      if (nowMs - (lastPlayedRef.current[sound] ?? 0) < minGap) return;
      lastPlayedRef.current[sound] = nowMs;

      const context = ensureAudio();
      const master = masterRef.current;
      if (!master) return;
      const [startFrequency, endFrequency, duration, type, volume] = SOUND_SHAPES[sound];
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(startFrequency, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), context.currentTime + duration);
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    },
    [ensureAudio],
  );

  const setIntensity = useCallback((intensity: number) => {
    const context = contextRef.current;
    const ambience = ambienceRef.current;
    if (!context || !ambience) return;
    ambience.gain.setTargetAtTime(0.014 + Math.min(1, intensity) * 0.026, context.currentTime, 0.2);
  }, []);

  const toggleMuted = useCallback(() => {
    setMutedState((current) => {
      const next = !current;
      mutedRef.current = next;
      localStorage.setItem("neon-racer-muted", String(next));
      const context = contextRef.current;
      const master = masterRef.current;
      if (context && master) {
        master.gain.setTargetAtTime(next ? 0 : 0.7, context.currentTime, 0.04);
      }
      if (!next) ensureAudio();
      return next;
    });
  }, [ensureAudio]);

  useEffect(
    () => () => {
      const context = contextRef.current;
      contextRef.current = null;
      masterRef.current = null;
      ambienceRef.current = null;
      if (context && context.state !== "closed") void context.close();
    },
    [],
  );

  return { muted, ensureAudio, play, setIntensity, toggleMuted };
}
