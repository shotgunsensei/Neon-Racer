import type { Entity, GameState, Obstacle, PowerUp, Projectile } from "./GameEngine";

export type CameraView = "chase" | "cockpit";
type Point = { x: number; y: number; scale: number };
type PilotCamera = ReturnType<typeof createPilotCamera>;

const HORIZON = 355;
const EYE_HEIGHT = 58;
const FOCAL_LENGTH = 460;
const NEAR_PLANE = 32;
const BLOCK_HEIGHT = 34;

// A forward-facing camera at the rear of the cockpit. World coordinates and
// collision bounds stay untouched; every object uses this same projection.
export function createPilotCamera(player: GameState["player"], width = 800) {
  const x = player.x + player.w / 2;
  const y = player.y + player.h / 2 + 60;
  return {
    x,
    nearY: y - NEAR_PLANE,
    project(worldX: number, worldY: number, elevation = 0): Point {
      const scale = FOCAL_LENGTH / Math.max(NEAR_PLANE, y - worldY);
      return {
        x: width / 2 + (worldX - x) * scale,
        y: HORIZON + (EYE_HEIGHT - elevation) * scale,
        scale,
      };
    },
  };
}

// Clip entire faces at the near plane, including blocks that straddle it.
// Clamping vertices alone would leave passed objects stuck to the windscreen.
export function pilotFootprint(camera: PilotCamera, entity: Entity, elevation = 0): Point[] {
  if (entity.y >= camera.nearY) return [];
  const front = Math.min(entity.y + entity.h, camera.nearY);
  return [camera.project(entity.x, entity.y, elevation),
    camera.project(entity.x + entity.w, entity.y, elevation),
    camera.project(entity.x + entity.w, front, elevation),
    camera.project(entity.x, front, elevation)];
}

function polygon(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]) {
  ctx.beginPath();
  points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.closePath();
}

function line(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }) {
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}

function drawPilotTrack(ctx: CanvasRenderingContext2D, state: GameState, camera: PilotCamera) {
  const floor = ctx.createLinearGradient(0, HORIZON, 0, 1000);
  floor.addColorStop(0, "#171a36");
  floor.addColorStop(1, "#070e1b");
  ctx.fillStyle = floor;
  polygon(ctx, pilotFootprint(camera, { x: 0, y: -1600, w: 800, h: 2800, color: "" }));
  ctx.fill();
  for (let lane = 0; lane < 6; lane += 2) {
    ctx.fillStyle = "rgba(131,160,255,.045)";
    polygon(ctx, pilotFootprint(camera, { x: lane * 800 / 6, y: -1600, w: 800 / 6, h: 2800, color: "" }));
    ctx.fill();
  }
  for (let lane = 0; lane <= 6; lane++) {
    const x = lane * 800 / 6;
    ctx.strokeStyle = lane === 0 || lane === 6 ? "#65e7f4" : "rgba(158,159,241,.4)";
    ctx.lineWidth = lane === 0 || lane === 6 ? 2.5 : 1;
    line(ctx, camera.project(x, -1600), camera.project(x, camera.nearY));
  }
  for (let y = state.gridOffset - 1200; y < camera.nearY; y += 120) {
    const a = camera.project(0, y), b = camera.project(800, y);
    ctx.strokeStyle = "rgba(143,109,231,.25)";
    ctx.lineWidth = 1;
    line(ctx, a, b);
    for (const x of [-18, 818]) {
      ctx.strokeStyle = state.player.boostTimer > 0 ? "#ffd38a" : "#39d6ec";
      ctx.lineWidth = Math.min(7, a.scale * 2);
      line(ctx, camera.project(x, y), camera.project(x, y, 45));
    }
  }
  // The illuminated corridor matches the collision width, even during a roll.
  ctx.fillStyle = "rgba(81,246,255,.06)";
  polygon(ctx, pilotFootprint(camera, { x: state.player.x + 8, y: -120,
    w: state.player.w - 16, h: 1200, color: "" }));
  ctx.fill();
}

function drawPilotObstacle(ctx: CanvasRenderingContext2D, obstacle: Obstacle, camera: PilotCamera) {
  const ground = pilotFootprint(camera, obstacle);
  if (!ground.length) return;
  const top = pilotFootprint(camera, obstacle, BLOCK_HEIGHT);
  const sweeper = obstacle.type === "sweeper";
  ctx.fillStyle = "rgba(0,0,0,.65)";
  polygon(ctx, ground); ctx.fill();
  const side = obstacle.x + obstacle.w / 2 < camera.x ? [1, 2] : [0, 3];
  ctx.fillStyle = sweeper ? "#125c61" : "#6c1e4c";
  polygon(ctx, [ground[side[0]], ground[side[1]], top[side[1]], top[side[0]]]); ctx.fill();
  ctx.fillStyle = sweeper ? "#227d78" : "#982d61";
  ctx.strokeStyle = obstacle.color;
  ctx.lineWidth = 1.5;
  polygon(ctx, top); ctx.fill(); ctx.stroke();
  const face = ctx.createLinearGradient(0, top[3].y, 0, ground[3].y);
  face.addColorStop(0, sweeper ? "#124b53" : "#501331");
  face.addColorStop(1, "#0c1025");
  ctx.fillStyle = face;
  polygon(ctx, [top[3], top[2], ground[2], ground[3]]); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = obstacle.color;
  ctx.lineWidth = Math.min(5, 2 * ground[3].scale);
  line(ctx, top[3], top[2]);
  const frontY = Math.min(obstacle.y + obstacle.h, camera.nearY);
  const mark = (u: number, z: number) => camera.project(obstacle.x + obstacle.w * u, frontY, z);
  ctx.strokeStyle = sweeper ? "#c4fff3" : "#ffd5e5";
  ctx.lineWidth = Math.max(1, ground[3].scale);
  if (sweeper) {
    const direction = obstacle.drift > 0 ? 1 : -1;
    line(ctx, mark(.5 - direction * .15, 25), mark(.5 + direction * .15, 17));
    line(ctx, mark(.5 + direction * .15, 17), mark(.5 - direction * .15, 9));
  } else {
    line(ctx, mark(.25, 17), mark(.75, 17));
  }
}

function drawPilotProjectile(ctx: CanvasRenderingContext2D, shot: Projectile, camera: PilotCamera) {
  if (shot.y >= camera.nearY) return;
  const x = shot.x + shot.w / 2;
  const nose = camera.project(x, shot.y, 24);
  const tail = camera.project(x, Math.min(camera.nearY, shot.y + shot.h + shot.trail), 24);
  ctx.strokeStyle = shot.color;
  ctx.lineWidth = Math.max(1.5, Math.min(12, shot.w * nose.scale));
  ctx.shadowColor = shot.color;
  ctx.shadowBlur = 10;
  line(ctx, nose, tail);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#eaffff";
  ctx.beginPath(); ctx.arc(nose.x, nose.y, Math.max(1.5, nose.scale * 1.6), 0, Math.PI * 2); ctx.fill();
}

function drawPilotPickup(ctx: CanvasRenderingContext2D, pickup: PowerUp, camera: PilotCamera) {
  const y = pickup.y + pickup.h / 2;
  if (y >= camera.nearY) return;
  const p = camera.project(pickup.x + pickup.w / 2, y, 26);
  const radius = pickup.w * p.scale / 2;
  ctx.strokeStyle = pickup.color;
  ctx.fillStyle = "#0c1930";
  ctx.lineWidth = Math.max(1.5, p.scale * 2);
  polygon(ctx, [{ x: p.x, y: p.y - radius }, { x: p.x + radius, y: p.y },
    { x: p.x, y: p.y + radius }, { x: p.x - radius, y: p.y }]);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${Math.max(9, 14 * p.scale)}px monospace`;
  ctx.fillText(pickup.type === "shield" ? "S" : pickup.type === "weapon" ? "W" : pickup.type === "boost" ? "B" : "E", p.x, p.y);
}

export function drawPilotWorld(ctx: CanvasRenderingContext2D, state: GameState, reducedMotion = false, width = 800) {
  const camera = createPilotCamera(state.player, width);
  ctx.save();
  // A small bank cue conveys steering without spinning the pilot's horizon.
  if (!reducedMotion) {
    ctx.translate(width / 2, HORIZON);
    ctx.rotate(-state.flight.bank * .055);
    ctx.translate(-width / 2, -HORIZON);
  }
  const glow = ctx.createRadialGradient(width / 2, HORIZON, 0, width / 2, HORIZON, 500);
  glow.addColorStop(0, "rgba(52,190,229,.17)");
  glow.addColorStop(1, "rgba(52,190,229,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, 1000);
  for (const star of state.stars) {
    ctx.fillStyle = `rgba(148,218,245,${star.alpha * .55})`;
    ctx.fillRect((star.x / 800 * width - (camera.x - 400) * .08 + width) % width, star.y * .35, star.size, star.size);
  }
  drawPilotTrack(ctx, state, camera);
  // One depth ordering keeps shots/pickups occluded correctly by nearer blocks.
  const objects = [
    ...state.obstacles.map(entity => ({ y: entity.y + entity.h, draw: () => drawPilotObstacle(ctx, entity, camera) })),
    ...state.projectiles.map(entity => ({ y: entity.y + entity.h, draw: () => drawPilotProjectile(ctx, entity, camera) })),
    ...state.powerUps.map(entity => ({ y: entity.y + entity.h, draw: () => drawPilotPickup(ctx, entity, camera) })),
    ...state.particles.map(particle => ({ y: particle.y, draw: () => {
      if (particle.y >= camera.nearY) return;
      const p = camera.project(particle.x, particle.y, 24);
      ctx.globalAlpha = Math.max(0, 1 - particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.min(35, particle.size * p.scale), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } })),
  ];
  objects.sort((a, b) => a.y - b.y).forEach(object => object.draw());
  ctx.restore();
}

// The supplied feed renders the SAME snapshot with the existing chase renderer.
// It never advances simulation, starts another animation loop, or draws a HUD.
export function drawCockpit(ctx: CanvasRenderingContext2D, state: GameState,
  drawChaseFeed: () => void, width = 800) {
  const radar = { x: width - 254, y: 708, w: 224, h: 280 };
  const center = width / 2;
  ctx.save();
  const metal = ctx.createLinearGradient(0, 690, 0, 1000);
  metal.addColorStop(0, "#263c50");
  metal.addColorStop(.2, "#0e1b2b");
  metal.addColorStop(1, "#050b16");
  const panel = (points: [number, number][]) => {
    ctx.fillStyle = metal;
    ctx.strokeStyle = "#3f667a";
    ctx.lineWidth = 2;
    polygon(ctx, points.map(([x, y]) => ({ x, y }))); ctx.fill(); ctx.stroke();
  };
  // Canopy rails and an open center windshield.
  panel([[0, 0], [width, 0], [width, 38], [width - 150, 26], [width - 230, 46], [230, 46], [150, 26], [0, 38]]);
  panel([[0, 0], [24, 0], [46, 450], [78, 750], [50, 880], [0, 880]]);
  panel([[width, 0], [width - 24, 0], [width - 46, 450], [width - 78, 750], [width - 50, 880], [width, 880]]);
  ctx.strokeStyle = "rgba(108,225,239,.65)";
  line(ctx, { x: 46, y: 470 }, { x: 70, y: 720 });
  line(ctx, { x: width - 46, y: 470 }, { x: width - 70, y: 680 });

  // A sparse collimated sight stays above approaching hazards.
  ctx.strokeStyle = "rgba(148,242,244,.6)";
  ctx.lineWidth = 1.5;
  line(ctx, { x: center - 26, y: 448 }, { x: center - 7, y: 448 });
  line(ctx, { x: center + 7, y: 448 }, { x: center + 26, y: 448 });
  line(ctx, { x: center, y: 437 }, { x: center, y: 443 });
  ctx.fillStyle = "#9de6ed";
  ctx.font = "14px monospace";
  ctx.textAlign = "center";
  ctx.fillText("PILOT // " + String(Math.min(6, Math.floor((state.player.x + 20) / (800 / 6)) + 1)).padStart(2, "0"), center, 160);

  panel([[0, 756], [174, 800], [256, 892], [width - 276, 900], [width - 270, 678], [width, 660], [width, 1000], [0, 1000]]);
  ctx.save();
  ctx.translate(center - 400, 0);
  panel([[240, 938], [285, 887], [458, 887], [519, 938], [519, 1000], [240, 1000]]);
  ctx.strokeStyle = "#6de4e5";
  line(ctx, { x: 285, y: 890 }, { x: 458, y: 890 });
  ctx.restore();
  // Instrument lamps and power gauge on the left console.
  ctx.textAlign = "left";
  ctx.font = "20px monospace";
  ctx.fillStyle = "#8cb2c5";
  ctx.fillText("FLIGHT SYSTEMS", 35, 827);
  const indicators = [
    { label: "SHIELD", active: state.player.hasShield, color: "#6de4e5" },
    { label: `WEAPON${state.player.weaponTimer > 0 ? ` ${Math.ceil(state.player.weaponTimer / 60)}s` : ""}`, active: state.player.weaponTimer > 0, color: "#f28cd9" },
    { label: `BOOST${state.player.boostTimer > 0 ? ` ${Math.ceil(state.player.boostTimer / 60)}s` : ""}`, active: state.player.boostTimer > 0, color: "#8bf2b2" },
  ];
  indicators.forEach(({ label, active, color }, i) => {
    ctx.fillStyle = active ? color : "#314857";
    ctx.fillRect(35, 848 + i * 30, 7, 7);
    ctx.fillStyle = active ? color : "#7390a3";
    ctx.fillText(label, 54, 856 + i * 30);
  });
  ctx.save();
  ctx.translate(center - 400, 0);
  ctx.fillStyle = "#8cb2c5";
  ctx.textAlign = "center";
  ctx.fillText("OVERDRIVE", 374, 925);
  ctx.fillStyle = "#a4f7ed";
  ctx.font = "bold 27px monospace";
  ctx.fillText(`${state.momentum.toFixed(1)}x`, 374, 959);
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i / 12 <= (state.momentum - 1) / 1.6 ? "#69ddd7" : "#1d3542";
    ctx.fillRect(282 + i * 16, 976, 11, 5);
  }
  ctx.restore();

  ctx.font = "bold 20px monospace";
  ctx.textAlign = "left";
  ctx.fillStyle = "#8af1e3";
  ctx.fillText("RADAR / CHASE", radar.x, 695);
  ctx.fillStyle = state.isPaused ? "#f9cc81" : "#8af1e3";
  ctx.beginPath(); ctx.arc(width - 39, 690, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#070c1a";
  ctx.fillRect(radar.x - 3, radar.y - 3, radar.w + 6, radar.h + 6);
  ctx.save();
  ctx.beginPath(); ctx.rect(radar.x, radar.y, radar.w, radar.h); ctx.clip();
  ctx.translate(radar.x, radar.y);
  ctx.scale(radar.w / 800, radar.h / 1000);
  drawChaseFeed();
  ctx.restore();
  ctx.strokeStyle = "#60acae";
  ctx.lineWidth = 1;
  ctx.strokeRect(radar.x, radar.y, radar.w, radar.h);
  // Shield status is also visible in peripheral glass, without hiding blocks.
  if (state.player.hasShield) {
    ctx.strokeStyle = "rgba(131,248,255,.45)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(center, 445, center - 50, 370, 0, Math.PI, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
