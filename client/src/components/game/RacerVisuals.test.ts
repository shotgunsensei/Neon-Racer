import assert from "node:assert/strict";
import { test } from "node:test";
import { checkCollision, createInitialState, type GameMode } from "./GameEngine";
import { createFlightPose, inPerspective, lateralSweep, moveRacer, project, projectFootprint, steer, updateFlight } from "./RacerVisuals";

test("projection grows monotonically toward the racer and preserves its lane at contact", () => {
  let previous = project(100, 0);
  for (let y = 20; y <= 1040; y += 20) {
    const next = project(100, y);
    assert.ok(next.y > previous.y && next.scale > previous.scale);
    assert.ok(next.x < previous.x);
    previous = next;
  }
  assert.deepEqual(project(100, 940), { x: 100, y: 940, scale: 1 });
  assert.equal(project(0, 500).x + project(800, 500).x, 800);
});

test("double taps roll in either direction across all game modes without granting immunity or score", () => {
  for (const mode of ["arcade", "racer", "chaos"] as GameMode[]) {
    for (const direction of [-1, 1] as const) {
      const state = createInitialState(800, 1000, mode);
      state.isStarted = true;
      const player = { ...state.player };
      steer(state, direction);
      assert.equal(state.flight.rollRemaining, 0);
      updateFlight(state.flight, 0, 8, false);
      steer(state, direction);
      updateFlight(state.flight, direction, 19, false);
      assert.equal(state.flight.rollDirection, direction);
      assert.ok(Math.abs(state.flight.roll - Math.PI * direction) < 1e-10);
      assert.deepEqual(state.player, player);
      assert.equal(state.score, 0);
      assert.ok(checkCollision({ ...state.player, color: "cyan" }, { ...state.player, color: "red" }));
      updateFlight(state.flight, 0, 19, false);
      assert.equal(state.flight.rollRemaining, 0);
      assert.equal(state.flight.roll, 0);
    }
  }
});

test("slow taps and alternating directions do not roll", () => {
  const state = createInitialState(800, 1000);
  state.isStarted = true;
  steer(state, -1);
  updateFlight(state.flight, 0, 18, false);
  steer(state, -1);
  steer(state, 1);
  assert.equal(state.flight.rollRemaining, 0);
});

test("cooldown prevents repeated rolls and allows another after expiry", () => {
  const state = createInitialState(800, 1000);
  state.isStarted = true;
  steer(state, 1); steer(state, 1);
  updateFlight(state.flight, 1, 40, false);
  steer(state, 1); steer(state, 1);
  assert.equal(state.flight.rollRemaining, 0);
  updateFlight(state.flight, 1, 32, false);
  steer(state, 1); steer(state, 1);
  assert.equal(state.flight.rollRemaining, 38);
});

test("double-tap window has the same duration at 30, 60 and 144 Hz", () => {
  for (const hz of [30, 60, 144]) {
    for (const seconds of [0.2, 0.4]) {
      const state = createInitialState(800, 1000);
      state.isStarted = true;
      steer(state, -1);
      for (let frame = 0; frame < Math.ceil(hz * seconds); frame++) {
        updateFlight(state.flight, 0, 60 / hz, false);
      }
      steer(state, -1);
      assert.equal(state.flight.rollRemaining > 0, seconds < 0.28);
    }
  }
});

test("idle, paused and game-over runs cannot initiate rolls", () => {
  for (const phase of ["idle", "pause", "over"]) {
    const state = createInitialState(800, 1000);
    state.isStarted = phase !== "idle";
    state.isPaused = phase === "pause";
    state.isGameOver = phase === "over";
    steer(state, -1); steer(state, -1);
    assert.equal(state.flight.rollRemaining, 0);
  }
});

test("banking is frame-rate independent and settles when lateral movement stops", () => {
  const a = createFlightPose(), b = createFlightPose();
  for (let i = 0; i < 60; i++) updateFlight(a, 1, 1, false);
  for (let i = 0; i < 120; i++) updateFlight(b, 1, 0.5, false);
  assert.ok(Math.abs(a.bank - b.bank) < 1e-10);
  assert.ok(a.bank > 0.5 && a.bank <= 0.55);
  updateFlight(a, 0, 60, false);
  assert.ok(Math.abs(a.bank) < 0.001);
});

test("reduced motion keeps the dodge benefit while suppressing the spin", () => {
  const normal = createInitialState(800, 1000), reduced = createInitialState(800, 1000);
  for (const state of [normal, reduced]) {
    state.isStarted = true;
    steer(state, 1); steer(state, 1);
  }
  moveRacer(normal, 70, 10, 800, false);
  moveRacer(reduced, 70, 10, 800, true);
  assert.equal(normal.player.x, reduced.player.x);
  assert.notEqual(normal.flight.roll, 0);
  assert.equal(reduced.flight.roll, 0);
  assert.ok(reduced.flight.bank <= 0.12);
  assert.equal(normal.flight.dashRemaining, reduced.flight.dashRemaining);
});

test("restart creates an independent neutral flight pose", () => {
  const first = createInitialState(800, 1000);
  first.flight.bank = 0.55;
  first.flight.rollRemaining = 38;
  const restarted = createInitialState(800, 1000);
  assert.deepEqual(restarted.flight, createFlightPose());
  assert.notEqual(first.flight, restarted.flight);
});

test("straight approaches stay on straight lane rays instead of bowing toward the center", () => {
  for (const x of [0, 60, 800 / 6, 300, 400, 500, 800 * 5 / 6, 740, 800]) {
    // Also cover diagonal approaches (sweepers) and negative spawn positions.
    for (const drift of [-0.15, 0, 0.15]) {
      const start = project(x - 120 * drift, -120);
      const end = project(x + 1080 * drift, 1080);
      for (let y = -100; y < 1080; y += 20) {
        const p = project(x + y * drift, y);
        const fraction = (p.y - start.y) / (end.y - start.y);
        const straightX = start.x + (end.x - start.x) * fraction;
        assert.ok(Math.abs(p.x - straightX) < 1e-8, `curved approach at x=${x}, y=${y}`);
      }
    }
  }
});

test("entry keeps the full track readable and spawns move continuously across y=0", () => {
  assert.ok(project(800, 0).x - project(0, 0).x >= 480 - 1e-8);
  for (const x of [0, 400, 800]) {
    for (let y = -120; y <= 1120; y += 10) {
      const a = project(x, y), b = project(x, y + 0.01);
      assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y) && a.scale > 0);
      assert.ok(b.y > a.y && b.y - a.y < 0.03);
      assert.ok(Math.abs(b.x - a.x) < 0.01);
    }
  }
});

test("storm blocks retain their lane gaps from spawn through the collision zone", () => {
  const laneWidth = 800 / 6;
  for (let lane = 0; lane < 6; lane++) {
    const leftStart = project(lane * laneWidth, -120), leftEnd = project(lane * laneWidth, 1080);
    const rightStart = project((lane + 1) * laneWidth, -120), rightEnd = project((lane + 1) * laneWidth, 1080);
    for (let y = -70; y <= 990; y += 20) {
      const block = { x: lane * laneWidth + 5, y, w: laneWidth - 10, h: 34, color: "red" };
      for (const p of projectFootprint(block)) {
        const fraction = (p.y - leftStart.y) / (leftEnd.y - leftStart.y);
        const leftX = leftStart.x + (leftEnd.x - leftStart.x) * fraction;
        const rightX = rightStart.x + (rightEnd.x - rightStart.x) * fraction;
        assert.ok(p.x > leftX && p.x < rightX, `block leaves lane ${lane} at y=${y}`);
      }
    }
  }
});

test("block elevation preserves its ground footprint and simulation bounds", () => {
  const block = Object.freeze({ x: 500, y: 920, w: 80, h: 30, color: "red" });
  const ground = projectFootprint(block), cap = projectFootprint(block, 18);
  assert.deepEqual(ground[0], project(500, 920));
  assert.deepEqual(ground[2], project(580, 950));
  for (let i = 0; i < ground.length; i++) {
    assert.equal(cap[i].x, ground[i].x);
    assert.ok(cap[i].y < ground[i].y);
  }
});

test("shot and pickup centers follow the same lane ray as the road", () => {
  for (const x of [20, 380, 740]) {
    let matrix: number[] = [];
    let translated: number[] = [];
    let drawn = false;
    const ctx = { save() {}, restore() {},
      transform(...args: number[]) { matrix = args; },
      translate(...args: number[]) { translated = args; },
    } as unknown as CanvasRenderingContext2D;
    const entity = { x, y: 450, w: 12, h: 24, color: "cyan" };
    inPerspective(ctx, entity, () => { drawn = true; });
    assert.ok(drawn);
    const [a, b, c, d, e, f] = matrix;
    for (const y of [entity.y, entity.y + entity.h]) {
      const centerX = entity.x + entity.w / 2;
      const localX = centerX + translated[0], localY = y + translated[1];
      const expected = project(centerX, y);
      assert.ok(Math.abs(a * localX + c * localY + e - expected.x) < 1e-8);
      assert.ok(Math.abs(b * localX + d * localY + f - expected.y) < 1e-8);
    }
  }
});

test("roll burst moves faster in both directions and quick taps carry through the dodge", () => {
  for (const direction of [-1, 1] as const) {
    const normal = createInitialState(800, 1000), rolling = createInitialState(800, 1000);
    normal.isStarted = rolling.isStarted = true;
    normal.keys[direction === -1 ? "left" : "right"] = true;
    steer(rolling, direction); steer(rolling, direction);
    const initialX = rolling.player.x;
    for (let i = 0; i < 18; i++) {
      moveRacer(normal, 7, 1, 800, false);
      moveRacer(rolling, 7, 1, 800, false);
    }
    assert.ok(Math.abs(rolling.player.x - initialX) > Math.abs(normal.player.x - initialX) * 1.6);
    assert.ok(Math.abs(rolling.player.x - initialX - direction * 7 * 18 * 1.7) < 1e-8);
    assert.equal(rolling.flight.dashRemaining, 0);
    const landedX = rolling.player.x;
    moveRacer(rolling, 7, 1, 800, false);
    assert.equal(rolling.player.x, landedX);
    assert.equal(rolling.score, 0);
    assert.equal(rolling.player.hasShield, false);
  }
});

test("countersteering brakes a roll immediately and track edges stop the burst", () => {
  const state = createInitialState(800, 1000);
  state.isStarted = true;
  steer(state, 1); steer(state, 1);
  state.keys.left = true;
  const initialX = state.player.x;
  moveRacer(state, 7, 1, 800, false);
  assert.equal(state.player.x, initialX - 7);
  assert.equal(state.flight.dashRemaining, 0);
  state.keys = {};
  for (const direction of [-1, 1] as const) {
    state.flight = createFlightPose();
    state.player.x = direction === -1 ? 1 : 759;
    steer(state, direction); steer(state, direction);
    moveRacer(state, 7, 1, 800, false);
    assert.equal(state.player.x, direction === -1 ? 0 : 760);
    assert.equal(state.flight.dashRemaining, 0);
  }
});

test("burst distance is consistent across frame rates, including its final partial frame", () => {
  const positions = [];
  for (const delta of [0.5, 1, 2.4]) {
    const state = createInitialState(800, 1000);
    state.isStarted = true;
    steer(state, 1); steer(state, 1);
    for (let time = 0; time < 24; time += delta) moveRacer(state, 7 * delta, delta, 800, false);
    positions.push(state.player.x);
  }
  assert.ok(Math.max(...positions) - Math.min(...positions) < 1e-8);
});

test("paused and ended runs cannot move or spend their burst", () => {
  for (const phase of ["pause", "over"]) {
    const state = createInitialState(800, 1000);
    state.isStarted = true;
    steer(state, 1); steer(state, 1);
    state.isPaused = phase === "pause";
    state.isGameOver = phase === "over";
    moveRacer(state, 7, 1, 800, false);
    assert.equal(state.player.x, 380);
    assert.equal(state.flight.dashRemaining, 18);
  }
});

test("swept collision detects thin hazards crossed between frames in both directions", () => {
  const obstacle = { x: 45, y: 930, w: 15, h: 24, color: "red" };
  for (const [previousX, currentX] of [[0, 90], [90, 0]]) {
    const hitbox = { x: currentX, y: 930, w: 24, h: 24, color: "cyan" };
    assert.equal(checkCollision(hitbox, obstacle), false);
    assert.equal(checkCollision(lateralSweep(hitbox, previousX), obstacle), true);
    assert.equal(checkCollision(lateralSweep(hitbox, previousX), { ...obstacle, y: 880 }), false);
  }
});
