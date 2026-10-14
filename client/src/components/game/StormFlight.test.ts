import assert from "node:assert/strict";
import { test } from "node:test";
import { createInitialState, createObstacle, type GameMode } from "./GameEngine";
import { moveRacer, steer } from "./RacerVisuals";
import { closingHazard, drawFlightAtmosphere, drawPeripheralWeather, flightSpeed, playfieldScale } from "./StormFlight";

test("steering acceleration integrates equally at 30, 60 and 144 Hz in every mode", () => {
  for (const mode of ["arcade", "racer", "chaos"] as GameMode[]) {
    const positions = [30, 60, 144].map(hz => {
      const state = createInitialState(800, 1000, mode);
      state.isStarted = true;
      state.keys.right = true;
      for (let i = 0; i < hz / 2; i++) moveRacer(state, state.player.speed * 60 / hz, 60 / hz, 800, false);
      return state.player.x;
    });
    assert.ok(Math.max(...positions) - Math.min(...positions) < 1e-8);
  }
});

test("normal steering has mass on launch but releasing, opposing keys and edges brake without drift", () => {
  const state = createInitialState(800, 1000);
  state.isStarted = true;
  state.keys.right = true;
  moveRacer(state, 7, 1, 800, false);
  assert.ok(state.player.x > 380 && state.player.x < 383);
  for (let i = 0; i < 20; i++) moveRacer(state, 7, 1, 800, false);
  const x = state.player.x;
  state.keys = {};
  moveRacer(state, 7, 1, 800, false);
  assert.equal(state.player.x, x);
  assert.equal(state.flight.steeringVelocity, 0);
  state.keys.left = state.keys.right = true;
  moveRacer(state, 7, 1, 800, false);
  assert.equal(state.player.x, x);
  state.keys.right = false;
  moveRacer(state, 7, 1, 800, false);
  assert.ok(state.player.x < x);
  state.keys = { right: true };
  state.player.x = 759.9;
  moveRacer(state, 7, 1, 800, false);
  assert.equal(state.player.x, 760);
  assert.equal(state.flight.steeringVelocity, 0);
});

test("calm effects retain steering, countersteering and barrel roll utility", () => {
  const a = createInitialState(800, 1000), b = createInitialState(800, 1000);
  for (const s of [a, b]) { s.isStarted = true; s.keys.left = true; }
  for (let i = 0; i < 10; i++) {
    moveRacer(a, 7, 1, 800, false); moveRacer(b, 7, 1, 800, true);
  }
  for (const s of [a, b]) { steer(s, 1); steer(s, 1); s.keys = {}; }
  moveRacer(a, 70, 10, 800, false); moveRacer(b, 70, 10, 800, true);
  assert.equal(a.player.x, b.player.x);
  assert.equal(b.flight.roll, 0);
  assert.notEqual(a.flight.roll, 0);
});

test("closing alerts use actual overlap, contact distance, level speed and slowdown; no safe-path promise", () => {
  const state = createInitialState(800, 1000);
  const obstacle = createObstacle(800, state, false);
  Object.assign(obstacle, { x: 380, y: 700, w: 40, h: 30, speed: 4 });
  state.obstacles = [obstacle];
  assert.equal(closingHazard(state), "TRAFFIC CLOSING");
  obstacle.y = 820;
  assert.equal(closingHazard(state), "EVADE / FIRE");
  state.timeWarpTimer = 10;
  assert.equal(closingHazard(state), "TRAFFIC CLOSING");
  obstacle.y = 700;
  assert.equal(closingHazard(state), "");
  state.timeWarpTimer = 0;
  obstacle.x = 412;
  assert.equal(closingHazard(state), "");
  obstacle.x = 380; obstacle.y = 960;
  assert.equal(closingHazard(state), "");
});

test("backing resolution follows letterboxing, DPR cap and narrow or wide viewports", () => {
  assert.equal(playfieldScale(800, 1000, 800, 1), 1);
  assert.equal(playfieldScale(896, 624, 800, 1), .624);
  assert.equal(playfieldScale(360, 500, 800, 3), .9);
  assert.equal(playfieldScale(1400, 500, 2800, 2), 1);
  assert.equal(playfieldScale(1600, 2000, 800, 2), 2);
});

test("speed cues respect time warp and bounded weather stays peripheral, quiet while inactive", () => {
  const state = createInitialState(800, 1000);
  state.isStarted = true;
  const normal = flightSpeed(state);
  state.timeWarpTimer = 1;
  assert.equal(flightSpeed(state), normal * .45);
  state.stormTimer = 1;
  const points: number[][] = [];
  const ctx = { save() {}, restore() {}, beginPath() {}, stroke() {},
    moveTo(x: number, y: number) { points.push([x, y]); }, lineTo() {},
  } as unknown as CanvasRenderingContext2D;
  drawPeripheralWeather(ctx, state, 800, false);
  assert.equal(points.length, 28);
  assert.ok(points.every(([x]) => x < 100 || x > 700));
  for (const phase of ["calm", "paused", "repair", "over", "idle"]) {
    points.length = 0;
    const s = createInitialState(800, 1000);
    s.isStarted = phase !== "idle"; s.isPaused = phase === "paused"; s.isGameOver = phase === "over";
    if (phase === "repair") s.repair = {} as NonNullable<typeof s.repair>;
    drawPeripheralWeather(ctx, s, 800, phase === "calm");
    assert.equal(points.length, 0);
  }
});

test("atmosphere is a stateless procedural renderer that preserves run and repair progress", () => {
  const state = createInitialState(800, 1000);
  const before = structuredClone(state);
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, { get(_target, key) {
    return key === "createLinearGradient" || key === "createRadialGradient" ? () => gradient : () => {};
  }, set() { return true; } }) as CanvasRenderingContext2D;
  drawFlightAtmosphere(ctx, state, 800, 135, false);
  drawFlightAtmosphere(ctx, state, 1400, 355, true);
  assert.deepEqual(state, before);
});
