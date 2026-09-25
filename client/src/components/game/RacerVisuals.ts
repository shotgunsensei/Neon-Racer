import type { Entity, GameState, Obstacle } from "./GameEngine";

export interface FlightPose {
  elapsed: number;
  bank: number;
  roll: number;
  rollDirection: number;
  rollRemaining: number;
  dashRemaining: number;
  cooldown: number;
  lastTap: number;
  lastDirection: number;
}

export const createFlightPose = (): FlightPose => ({
  elapsed: 0, bank: 0, roll: 0, rollDirection: 0, rollRemaining: 0, dashRemaining: 0, cooldown: 0,
  lastTap: -Infinity, lastDirection: 0,
});

// Frames are simulation time: pausing also pauses the roll and its cooldown.
export function steer(state: GameState, direction: -1 | 1) {
  if (!state.isStarted || state.isPaused || state.isGameOver) return;
  const pose = state.flight;
  if (pose.lastDirection === direction &&
      pose.elapsed - pose.lastTap <= 17 && pose.cooldown === 0) {
    pose.rollDirection = direction;
    pose.rollRemaining = 38;
    pose.dashRemaining = 18;
    pose.cooldown = 72;
    pose.lastTap = -Infinity;
  } else {
    pose.lastTap = pose.elapsed;
  }
  pose.lastDirection = direction;
}

export function updateFlight(pose: FlightPose, movement: number, delta: number, reducedMotion: boolean) {
  pose.elapsed += delta;
  const target = Math.max(-1, Math.min(1, movement)) * (reducedMotion ? 0.12 : 0.55);
  pose.bank += (target - pose.bank) * (1 - Math.exp(-delta * 0.16));
  pose.cooldown = Math.max(0, pose.cooldown - delta);
  pose.rollRemaining = Math.max(0, pose.rollRemaining - delta);
  const progress = 1 - pose.rollRemaining / 38;
  const eased = progress * progress * (3 - 2 * progress);
  pose.roll = !reducedMotion && pose.rollRemaining > 0 ? eased * Math.PI * 2 * pose.rollDirection : 0;
}

// A 300 ms directional burst starts at 2.4x strafe speed and eases to normal.
// Quick taps still dodge; opposite steering (or both arrows) brakes the burst.
export function moveRacer(state: GameState, baseStep: number, delta: number, width: number, reducedMotion: boolean) {
  if (!state.isStarted || state.isPaused || state.isGameOver || delta <= 0) return;
  const pose = state.flight;
  const left = Boolean(state.keys.left), right = Boolean(state.keys.right);
  const direction = Number(right) - Number(left);
  if ((left && right) || (direction !== 0 && direction !== pose.rollDirection)) pose.dashRemaining = 0;
  const burstTime = Math.min(delta, pose.dashRemaining);
  // Integrate the taper, including a frame that crosses the end of the burst.
  const averageSpeed = 1 + 1.4 * (pose.dashRemaining - burstTime / 2) / 18;
  const displacement = baseStep / delta * (
    pose.rollDirection * burstTime * averageSpeed + direction * (delta - burstTime)
  );
  pose.dashRemaining = Math.max(0, pose.dashRemaining - delta);
  const previousX = state.player.x;
  state.player.x = Math.max(0, Math.min(width - state.player.w, previousX + displacement));
  if (state.player.x === 0 || state.player.x === width - state.player.w) pose.dashRemaining = 0;
  updateFlight(pose, baseStep > 0 ? (state.player.x - previousX) / baseStep : 0, delta, reducedMotion);
}

// Cover every lateral position traversed this frame, so a fast roll cannot
// skip a thin obstacle or pickup between its starting and ending positions.
export function lateralSweep(hitbox: Entity, previousX: number): Entity {
  return { ...hitbox, x: Math.min(previousX, hitbox.x), w: hitbox.w + Math.abs(hitbox.x - previousX) };
}

// A single planar perspective transform: straight world paths stay straight on
// screen. The old linear X / quadratic Y mapping bowed obstacles off the lanes.
// A raised camera keeps 60% of the track width visible at entry (formerly 20%).
// Contact at the player's center remains 1:1; simulation/collision space is unchanged.
const CONTACT_Y = 940;
const ENTRY_Y = 180;
const PERSPECTIVE = 2 / 3;

export function project(x: number, y: number) {
  const depth = y / CONTACT_Y;
  const scale = 1 / Math.max(0.25, 1 + PERSPECTIVE * (1 - depth));
  return { x: 400 + (x - 400) * scale, y: ENTRY_Y + (CONTACT_Y - ENTRY_Y) * depth * scale, scale };
}

export function projectFootprint(entity: Entity, elevation = 0) {
  return [[entity.x, entity.y], [entity.x + entity.w, entity.y],
    [entity.x + entity.w, entity.y + entity.h], [entity.x, entity.y + entity.h]]
    .map(([x, y]) => {
      const point = project(x, y);
      return { ...point, y: point.y - elevation * point.scale };
    });
}

export function inPerspective(ctx: CanvasRenderingContext2D, entity: Entity, draw: () => void) {
  const x = entity.x + entity.w / 2;
  const y = entity.y + entity.h / 2;
  const top = project(x, entity.y);
  const bottom = project(x, entity.y + entity.h);
  ctx.save();
  // Shear along the same lane ray, rather than drawing shots vertically off-axis.
  ctx.transform(project(x, y).scale, 0, (bottom.x - top.x) / entity.h,
    (bottom.y - top.y) / entity.h, (top.x + bottom.x) / 2, (top.y + bottom.y) / 2);
  ctx.translate(-x, -y);
  draw();
  ctx.restore();
}

type ScreenPoint = { x: number; y: number };
function polygon(ctx: CanvasRenderingContext2D, points: ScreenPoint[]) {
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
}

export function drawTrack(ctx: CanvasRenderingContext2D, state: GameState, reducedMotion = false) {
  ctx.save();
  const farLeft = project(0, -120), farRight = project(800, -120);
  const nearLeft = project(0, 1040), nearRight = project(800, 1040);
  const floor = ctx.createLinearGradient(0, 180, 0, 1000);
  floor.addColorStop(0, "#141832");
  floor.addColorStop(1, "#100b21");
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.moveTo(farLeft.x, farLeft.y);
  ctx.lineTo(farRight.x, farRight.y);
  ctx.lineTo(nearRight.x, nearRight.y);
  ctx.lineTo(nearLeft.x, nearLeft.y);
  ctx.closePath();
  ctx.fill();

  // Quiet alternating lane surfaces reinforce depth without hiding the hazards.
  for (let lane = 0; lane < 6; lane += 2) {
    ctx.fillStyle = "rgba(129,159,255,0.035)";
    polygon(ctx, projectFootprint({ x: lane * 800 / 6, y: -120, w: 800 / 6, h: 1160, color: "" }));
    ctx.fill();
  }
  // Wide illuminated shoulders give the roadway physical thickness.
  for (const [x, width] of [[-18, 18], [800, 18]]) {
    ctx.fillStyle = "#153445";
    polygon(ctx, projectFootprint({ x, y: -120, w: width, h: 1160, color: "" }));
    ctx.fill();
  }

  const glow = ctx.createRadialGradient(400, 180, 0, 400, 180, 220);
  glow.addColorStop(0, "rgba(0,240,255,0.22)");
  glow.addColorStop(1, "rgba(0,240,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(180, 0, 440, 400);
  for (let lane = 0; lane <= 6; lane++) {
    const x = lane * 800 / 6;
    const far = project(x, -120), near = project(x, 1040);
    const edge = lane === 0 || lane === 6;
    ctx.strokeStyle = edge ? "#62eeff" : "rgba(155,162,255,0.38)";
    ctx.lineWidth = edge ? 2.5 : 1.2;
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = edge ? 8 : 0;
    ctx.beginPath(); ctx.moveTo(far.x, far.y); ctx.lineTo(near.x, near.y); ctx.stroke();
  }
  ctx.shadowBlur = 0;
  for (let y = state.gridOffset - 120; y < 1060; y += 120) {
    const left = project(0, y), right = project(800, y);
    ctx.strokeStyle = `rgba(146,111,231,${0.08 + left.scale * 0.15})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(left.x, left.y); ctx.lineTo(right.x, right.y); ctx.stroke();
    // Trackside pylons add height without obscuring the playable lanes.
    for (const x of [-22, 822]) {
      const p = project(x, y);
      ctx.strokeStyle = "#39d6ec";
      ctx.lineWidth = 3 * p.scale;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 55 * p.scale); ctx.stroke();
      ctx.fillStyle = "#f19aff";
      ctx.fillRect(p.x - 3 * p.scale, p.y - 55 * p.scale, 6 * p.scale, 5 * p.scale);
    }
    // Moving rail segments sell speed outside the collision area.
    const energized = state.player.boostTimer > 0 || state.focusTimer > 0;
    for (const x of [-10, 810]) {
      const a = project(x, y), b = project(x, y + (energized && !reducedMotion ? 65 : 28));
      ctx.strokeStyle = energized ? "#ffd38a" : "#b4f8ff";
      ctx.lineWidth = 3 * a.scale;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }

  // A faint ground ribbon follows the ship's collision width, making it easier
  // to compare incoming blocks with the player's current path during a bank/roll.
  const ribbon = { x: state.player.x + 8, y: 160, w: state.player.w - 16, h: state.player.y - 160 + 26, color: "" };
  const guide = ctx.createLinearGradient(0, project(400, 160).y, 0, CONTACT_Y);
  guide.addColorStop(0, "rgba(81,246,255,0)");
  guide.addColorStop(1, "rgba(81,246,255,0.09)");
  ctx.fillStyle = guide;
  polygon(ctx, projectFootprint(ribbon)); ctx.fill();
  ctx.restore();
}

export function drawObstacle(ctx: CanvasRenderingContext2D, obstacle: Obstacle) {
  const ground = projectFootprint(obstacle);
  const top = projectFootprint(obstacle, 18);
  const scale = project(obstacle.x, obstacle.y + obstacle.h).scale;
  const sweeper = obstacle.type === "sweeper";
  ctx.save();

  // The shadow/outline is the real footprint; the raised cap is decoration.
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  polygon(ctx, ground); ctx.fill();
  const side = obstacle.x + obstacle.w / 2 < 400 ? [1, 2] : [0, 3];
  ctx.fillStyle = sweeper ? "#0b4746" : "#471932";
  polygon(ctx, [top[side[0]], top[side[1]], ground[side[1]], ground[side[0]]]); ctx.fill();

  const cap = ctx.createLinearGradient(top[0].x, top[0].y, top[2].x, top[2].y);
  cap.addColorStop(0, sweeper ? "#25847c" : "#a73262");
  cap.addColorStop(1, sweeper ? "#113c43" : "#3b1239");
  ctx.fillStyle = cap;
  ctx.strokeStyle = obstacle.color;
  ctx.lineWidth = Math.max(1, 1.4 * scale);
  polygon(ctx, top); ctx.fill(); ctx.stroke();

  const face = ctx.createLinearGradient(0, top[3].y, 0, ground[3].y);
  face.addColorStop(0, obstacle.color);
  face.addColorStop(1, sweeper ? "#113e48" : "#541329");
  ctx.fillStyle = face;
  polygon(ctx, [top[3], top[2], ground[2], ground[3]]); ctx.fill();

  // A crisp front contact edge stays readable even when several blocks overlap.
  ctx.strokeStyle = obstacle.color; ctx.shadowColor = obstacle.color; ctx.shadowBlur = 5;
  polygon(ctx, ground); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = sweeper ? "#c4fff3" : "#ffd8e9";
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  ctx.beginPath(); ctx.moveTo(ground[3].x, ground[3].y); ctx.lineTo(ground[2].x, ground[2].y); ctx.stroke();

  // Direction chevrons distinguish genuinely drifting hazards from fixed blocks.
  const mark = (u: number, v: number) => {
    const p = project(obstacle.x + obstacle.w * u, obstacle.y + obstacle.h * v);
    return { x: p.x, y: p.y - 18 * p.scale };
  };
  const marks = sweeper
    ? [mark(obstacle.drift > 0 ? 0.4 : 0.6, 0.25), mark(obstacle.drift > 0 ? 0.65 : 0.35, 0.5), mark(obstacle.drift > 0 ? 0.4 : 0.6, 0.75)]
    : [mark(0.25, 0.5), mark(0.75, 0.5)];
  ctx.beginPath();
  marks.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
  ctx.stroke();
  ctx.restore();
}

type Vertex = [number, number, number];
// A small solid mesh, rotated around the ship's longitudinal axis, then lit
// and depth-sorted. This remains Canvas2D and needs no WebGL dependency.
const HULL: Vertex[] = [[0, -25, 0], [-23, 20, 0], [23, 20, 0], [0, 9, 10], [0, 14, -6]];
const FACES = [[0, 1, 3], [0, 3, 2], [1, 2, 3], [0, 4, 1], [0, 2, 4], [1, 4, 2]];

export function drawRacer(ctx: CanvasRenderingContext2D, state: GameState, reducedMotion: boolean) {
  const { player, flight } = state;
  const center = project(player.x + player.w / 2, player.y + player.h / 2);
  const angle = flight.bank + (reducedMotion ? 0 : flight.roll);
  const lift = reducedMotion ? 0 : Math.sin((1 - flight.rollRemaining / 38) * Math.PI) * (flight.rollRemaining > 0 ? 7 : 0);
  const color = player.boostTimer > 0 ? "#ffb347" : "#51f6ff";
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.beginPath(); ctx.ellipse(0, 16, 25, 10, 0, 0, Math.PI * 2); ctx.fill();
  // Ground marker stays visible through a roll while the hull banks above it.
  ctx.strokeStyle = "rgba(81,246,255,0.35)";
  ctx.beginPath(); ctx.ellipse(0, 12, 23, 9, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.translate(0, -lift);
  const rotate = ([x, y, z]: Vertex): Vertex => {
    const rx = x * Math.cos(angle) + z * Math.sin(angle);
    const rz = -x * Math.sin(angle) + z * Math.cos(angle);
    return [rx, y * 0.88 - rz * 0.7, y * 0.3 + rz];
  };
  const vertices = HULL.map(rotate);
  for (const side of [-1, 1]) {
    const [x, y] = rotate([side * 13, 18, 0]);
    const length = (player.boostTimer > 0 ? 64 : 38) + (reducedMotion ? 0 : Math.sin(state.frames * 0.8) * 5);
    const exhaust = ctx.createLinearGradient(x, y, x, y + length);
    exhaust.addColorStop(0, color); exhaust.addColorStop(1, "rgba(0,240,255,0)");
    ctx.fillStyle = exhaust;
    ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.lineTo(x - flight.bank * 13, y + length); ctx.closePath(); ctx.fill();
  }
  const faces = FACES.map((indices) => ({ indices, depth: indices.reduce((sum, i) => sum + vertices[i][2], 0) / 3 }));
  faces.sort((a, b) => a.depth - b.depth);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = color;
  ctx.shadowColor = color; ctx.shadowBlur = 7;
  for (const face of faces) {
    const brightness = Math.round(24 + Math.max(0, Math.min(1, (face.depth + 12) / 28)) * 40);
    ctx.fillStyle = `hsl(192 65% ${brightness}%)`;
    ctx.beginPath();
    face.indices.forEach((index, i) => { const v = vertices[index]; if (i === 0) ctx.moveTo(v[0], v[1]); else ctx.lineTo(v[0], v[1]); });
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  if (Math.cos(angle) > 0) {
    const cockpit = [[0, -12, 4], [-4, 6, 9], [4, 6, 9]] as Vertex[];
    ctx.fillStyle = "#e3ffff"; ctx.beginPath();
    cockpit.map(rotate).forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.closePath(); ctx.fill();
  }
  ctx.shadowBlur = 0;
  if (player.hasShield || state.timeWarpTimer > 0 || state.momentum >= 1.8) {
    ctx.strokeStyle = player.hasShield ? "#ffffff" : state.timeWarpTimer > 0 ? "#ad87ff" : "#ffee99";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, 35, 32, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
