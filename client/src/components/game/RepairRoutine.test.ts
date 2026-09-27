import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState, createObstacle, createProjectile } from "./GameEngine";
import { advanceImmunity, advanceRepair, beginRepair, enterRepairCommand, repairFade, REPAIR_IMMUNITY_MS } from "./RepairRoutine";
import { moveRacer, steer } from "./RacerVisuals";

function crashedRun(mode: "arcade" | "racer" | "chaos" = "arcade") {
  const state = createInitialState(800, 1000, mode);
  state.isStarted = true;
  state.score = 8524.75;
  state.level = 7;
  state.distance = 999;
  state.combo = 12;
  state.maxCombo = 18;
  state.momentum = 2.2;
  state.focus = 79;
  state.focusTimer = 140;
  state.timeWarpTimer = 150;
  state.stormTimer = 320;
  state.player.weaponTimer = 420;
  state.player.boostTimer = 260;
  state.obstacles.push(createObstacle(800, state, true));
  state.projectiles.push(createProjectile(state, 400, true));
  state.keys = { left: true, shoot: true };
  beginRepair(state, 1000, () => .1);
  return state;
}

function nextPhase(state: ReturnType<typeof crashedRun>) {
  return advanceRepair(state, state.repair!.phaseEnds);
}

function ready(state: ReturnType<typeof crashedRun>) {
  nextPhase(state); nextPhase(state); nextPhase(state);
  assert.equal(state.repair!.phase, "command");
}

test("crashes fade out, reveal the cockpit and give reading time before the timer starts", () => {
  const state = crashedRun();
  const repair = state.repair!;
  assert.equal(state.isGameOver, false);
  assert.deepEqual(state.keys, {});
  assert.equal(repairFade(repair, 1000), 0);
  assert.equal(repairFade(repair, 1600), 1);
  assert.equal(enterRepairCommand(state, "right", 1300), null);
  nextPhase(state);
  assert.equal(repair.phase, "reveal");
  assert.equal(repairFade(repair, repair.phaseStarted), 1);
  assert.equal(repairFade(repair, repair.phaseEnds), 0);
  nextPhase(state);
  assert.equal(repair.phase, "briefing");
  nextPhase(state);
  assert.equal(repair.phase, "command");
  assert.deepEqual(repair.sequences.map(sequence => sequence.length), [3, 4, 5]);
  assert.ok(repair.sequences.every(sequence => sequence.includes("left") && sequence.includes("right")));
});

test("three successful sequences preserve the full run and grant immunity only after returning", () => {
  for (const mode of ["arcade", "racer", "chaos"] as const) {
    const state = crashedRun(mode);
    const snapshot = structuredClone({ ...state, repair: null });
    ready(state);
    for (let round = 0; round < 3; round++) {
      const repair = state.repair!;
      for (const key of repair.sequences[round]) enterRepairCommand(state, key, repair.phaseStarted + 100);
      assert.equal(repair.phase, round === 2 ? "success" : "stepComplete");
      if (round < 2) nextPhase(state);
    }
    assert.equal(state.immunityMs, 0);
    nextPhase(state); // departure fade
    nextPhase(state); // returning fade
    assert.equal(state.immunityMs, 0);
    assert.equal(nextPhase(state), "resumed");
    assert.equal(state.repair, null);
    assert.equal(state.immunityMs, REPAIR_IMMUNITY_MS);
    assert.deepEqual({ ...state, immunityMs: 0 }, snapshot);
    assert.equal(advanceRepair(state, 100000), null);
  }
});

test("wrong arrows and deadlines lead to game over exactly once with the original metrics", () => {
  for (const failure of ["wrong", "timeout", "late-key"] as const) {
    const state = crashedRun();
    ready(state);
    const repair = state.repair!;
    if (failure === "wrong") enterRepairCommand(state, "right", repair.phaseStarted + 1);
    else if (failure === "late-key") enterRepairCommand(state, "left", repair.phaseEnds);
    else nextPhase(state);
    assert.equal(repair.phase, "failure");
    assert.equal(repair.failure, failure === "wrong" ? "wrong" : "timeout");
    assert.equal(state.isGameOver, false);
    assert.equal(nextPhase(state), "failed");
    assert.equal(state.isGameOver, true);
    assert.equal(state.score, 8524.75);
    assert.equal(state.level, 7);
    assert.equal(advanceRepair(state, 100000), null);
    assert.equal(beginRepair(state, 100000), false);
  }
});

test("holding a key, steering and double taps cannot advance or alter a repair", () => {
  const state = crashedRun();
  ready(state);
  const snapshot = structuredClone(state);
  enterRepairCommand(state, "left", state.repair!.phaseStarted + 10, true);
  steer(state, -1); steer(state, -1);
  moveRacer(state, 15, 1, 800, false);
  assert.deepEqual(state, snapshot);
  assert.equal(beginRepair(state, 100000), false);
});

test("immunity lasts three active seconds independent of frame rate, slow motion, and pauses", () => {
  for (const hz of [30, 60, 144]) {
    const state = createInitialState(800, 1000);
    state.isStarted = true;
    state.immunityMs = REPAIR_IMMUNITY_MS;
    state.timeWarpTimer = 240;
    state.focusTimer = 190;
    for (let frame = 0; frame < hz * 2; frame++) advanceImmunity(state, 1000 / hz);
    assert.ok(Math.abs(state.immunityMs - 1000) < .00001);
    assert.equal(beginRepair(state, 4000), false);
    state.isPaused = true;
    advanceImmunity(state, 9000);
    assert.ok(Math.abs(state.immunityMs - 1000) < .00001);
    state.isPaused = false;
    advanceImmunity(state, 1001);
    assert.equal(state.immunityMs, 0);
    assert.equal(beginRepair(state, 6000), true);
    assert.equal(createInitialState(800, 1000).repair, null);
  }
});
