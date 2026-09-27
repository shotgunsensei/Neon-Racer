import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState, createProjectile, createStormFormation } from "./GameEngine";
import { createPilotCamera, drawCockpit, drawPilotWorld, pilotFootprint } from "./CockpitVisuals";

test("pilot camera follows the ship in every lane and on wide viewports", () => {
  const state = createInitialState(800, 1000);
  for (const width of [800, 1250, 2400]) {
    for (const x of [0, 220, 380, 760]) {
      state.player.x = x;
      const camera = createPilotCamera(state.player, width);
      for (const y of [-120, 0, 500, 900, 950]) {
        assert.equal(camera.project(x + 20, y).x, width / 2);
        const left = camera.project(x - 10, y), right = camera.project(x + 50, y);
        assert.ok(left.x < width / 2 && right.x > width / 2);
      }
    }
  }
});

test("approaching blocks enlarge continuously and their faces stay visible at contact", () => {
  const state = createInitialState(800, 1000);
  const camera = createPilotCamera(state.player);
  let previousScale = 0;
  let previousY = 0;
  for (let y = -120; y <= state.player.y + state.player.h; y++) {
    const p = camera.project(400, y);
    assert.ok(p.scale > previousScale);
    assert.ok(p.y > previousY);
    previousScale = p.scale;
    previousY = p.y;
  }
  const block = { x: 380, y: state.player.y - 20, w: 40, h: 30, color: "red" };
  const top = pilotFootprint(camera, block, 34);
  assert.ok(top.every(p => p.y > 355 && p.y < 700));
  assert.ok(top[3].x < 400 && top[2].x > 400);
});

test("storm gaps remain inside the same projected lane rays while steering", () => {
  const state = createInitialState(800, 1000, "chaos");
  const blocks = createStormFormation(800, state);
  for (const playerX of [0, 380, 760]) {
    state.player.x = playerX;
    const camera = createPilotCamera(state.player);
    for (const y of [-70, 350, 700, 910]) {
      for (const block of blocks) {
        const lane = Math.floor(block.x / (800 / 6));
        const footprint = pilotFootprint(camera, { ...block, y });
        footprint.forEach((p, i) => {
          const worldY = i < 2 ? y : y + block.h;
          assert.ok(p.x > camera.project(lane * 800 / 6, worldY).x);
          assert.ok(p.x < camera.project((lane + 1) * 800 / 6, worldY).x);
        });
      }
    }
  }
});

test("near-plane clipping removes passed blocks and keeps crossing faces finite", () => {
  const camera = createPilotCamera(createInitialState(800, 1000).player);
  const block = { x: 350, y: camera.nearY - 15, w: 70, h: 40, color: "red" };
  const points = pilotFootprint(camera, block);
  assert.equal(points.length, 4);
  assert.deepEqual(points[3], camera.project(block.x, camera.nearY));
  assert.deepEqual(pilotFootprint(camera, { ...block, y: camera.nearY }), []);
  for (const y of [camera.nearY, 1000, 100000]) {
    const p = camera.project(400, y, 24);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.scale > 0);
  }
});

test("cockpit and radar render one shared snapshot without advancing or mutating the run", () => {
  const state = createInitialState(800, 1000, "chaos");
  state.isStarted = true;
  state.flight.bank = .5;
  state.player.hasShield = true;
  state.obstacles = createStormFormation(800, state);
  state.projectiles.push(createProjectile(state, 400, true));
  state.powerUps.push({ x: 350, y: 550, w: 24, h: 24, color: "#00ffff", active: true, type: "shield" });
  state.particles.push({ x: 400, y: 900, vx: 1, vy: 1, life: 5, maxLife: 20, color: "red", size: 3 });
  const before = structuredClone(state);
  let saves = 0, feedCount = 0, rotations = 0;
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, name) {
      if (name === "save") return () => saves++;
      if (name === "restore") return () => { assert.ok(saves > 0); saves--; };
      if (name === "rotate") return () => rotations++;
      if (name === "createLinearGradient" || name === "createRadialGradient") return () => gradient;
      return (...args: unknown[]) => args.forEach(arg => {
        if (typeof arg === "number") assert.ok(Number.isFinite(arg));
      });
    },
    set: () => true,
  });
  for (const reducedMotion of [true, false]) {
    drawPilotWorld(ctx, state, reducedMotion, 1400);
    if (reducedMotion) assert.equal(rotations, 0);
    drawCockpit(ctx, state, () => { feedCount++; assert.deepEqual(state, before); }, 1400);
    assert.equal(saves, 0);
    assert.deepEqual(state, before);
  }
  assert.equal(feedCount, 2);
  assert.equal(rotations, 1);
});
