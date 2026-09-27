import type { GameState } from "./GameEngine";

export type RepairDirection = "left" | "right";
export type RepairPhase = "blackout" | "reveal" | "briefing" | "command" | "stepComplete" | "success" | "failure" | "depart" | "return";
export interface RepairState {
  phase: RepairPhase;
  phaseStarted: number;
  phaseEnds: number;
  round: number;
  sequences: RepairDirection[][];
  entered: number;
  failure: "wrong" | "timeout" | null;
}

export const REPAIR_STEPS = ["Seal the fuel line", "Realign the turbine", "Ignite the engine"];
export const REPAIR_WINDOWS = [2600, 3000, 3400];
export const REPAIR_IMMUNITY_MS = 3000;

function phase(repair: RepairState, next: RepairPhase, now: number, duration: number) {
  repair.phase = next;
  repair.phaseStarted = now;
  repair.phaseEnds = now + duration;
}

export function beginRepair(state: GameState, now: number, random = Math.random) {
  if (state.repair || state.isGameOver || state.immunityMs > 0 || !state.isStarted) return false;
  const sequences = REPAIR_STEPS.map((_, round) => {
    const sequence: RepairDirection[] = Array.from({ length: round + 3 }, () => random() < .5 ? "left" : "right");
    // Every command uses both directions, even on an unlucky random draw.
    if (sequence.every(key => key === sequence[0])) sequence[sequence.length - 1] = sequence[0] === "left" ? "right" : "left";
    return sequence;
  });
  state.repair = { phase: "blackout", phaseStarted: now, phaseEnds: now + 600, round: 0, sequences, entered: 0, failure: null };
  state.keys = {};
  state.flight.lastTap = -Infinity;
  return true;
}

// Only the repair clock advances here. The race snapshot is kept in place.
export function advanceRepair(state: GameState, now: number): "resumed" | "failed" | null {
  const repair = state.repair;
  if (!repair || now < repair.phaseEnds) return null;
  switch (repair.phase) {
    case "blackout": phase(repair, "reveal", now, 650); break;
    case "reveal": phase(repair, "briefing", now, 2400); break;
    case "briefing": phase(repair, "command", now, REPAIR_WINDOWS[0]); break;
    case "command":
      repair.failure = "timeout";
      phase(repair, "failure", now, 1300);
      break;
    case "stepComplete":
      repair.round += 1;
      repair.entered = 0;
      phase(repair, "command", now, REPAIR_WINDOWS[repair.round]);
      break;
    case "success": phase(repair, "depart", now, 500); break;
    case "depart": phase(repair, "return", now, 600); break;
    case "return":
      state.repair = null;
      state.immunityMs = REPAIR_IMMUNITY_MS;
      state.keys = {};
      state.flight.lastTap = -Infinity;
      state.screenShake = 0;
      return "resumed";
    case "failure":
      state.repair = null;
      state.isGameOver = true;
      state.keys = {};
      return "failed";
  }
  return null;
}

export function enterRepairCommand(state: GameState, direction: RepairDirection, now: number, repeated = false): "correct" | "complete" | "wrong" | null {
  const repair = state.repair;
  if (!repair || repair.phase !== "command" || repeated) return null;
  // Key events can arrive before the next animation frame after the deadline.
  if (now >= repair.phaseEnds) {
    advanceRepair(state, now);
    return "wrong";
  }
  if (direction !== repair.sequences[repair.round][repair.entered]) {
    repair.failure = "wrong";
    phase(repair, "failure", now, 1300);
    return "wrong";
  }
  repair.entered += 1;
  if (repair.entered === repair.sequences[repair.round].length) {
    const finished = repair.round === REPAIR_STEPS.length - 1;
    phase(repair, finished ? "success" : "stepComplete", now, finished ? 1200 : 450);
    return "complete";
  }
  return "correct";
}

export function repairFade(repair: RepairState, now: number) {
  const progress = Math.max(0, Math.min(1, (now - repair.phaseStarted) / (repair.phaseEnds - repair.phaseStarted)));
  if (repair.phase === "blackout" || repair.phase === "depart") return progress;
  if (repair.phase === "reveal" || repair.phase === "return") return 1 - progress;
  return 0;
}

export function repairUsesCockpit(repair: RepairState | null) {
  return Boolean(repair && repair.phase !== "blackout" && repair.phase !== "return");
}

export function advanceImmunity(state: GameState, elapsedMs: number) {
  if (!state.repair && state.isStarted && !state.isPaused && !state.isGameOver) {
    state.immunityMs = Math.max(0, state.immunityMs - Math.max(0, elapsedMs));
  }
}
