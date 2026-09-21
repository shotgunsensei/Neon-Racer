import type { Entity, GameState } from "./GameEngine";

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

// One shared ground projection keeps lanes, pickups, shots and threats aligned.
// The player's center (y=940) stays at its original screen position and scale.
export function project(x: number, y: number) {
  const depth = Math.max(0, y / 940);
  const scale = 0.2 + 0.8 * depth;
  return { x: 400 + (x - 400) * scale, y: 180 + 760 * depth * depth, scale };
}

export function inPerspective(ctx: CanvasRenderingContext2D, entity: Entity, draw: () => void) {
  const x = entity.x + entity.w / 2;
  const y = entity.y + entity.h / 2;
  const point = project(x, y);
  const top = project(x, entity.y);
  const bottom = project(x, entity.y + entity.h);
  ctx.save();
  ctx.translate(point.x, (top.y + bottom.y) / 2);
  ctx.scale(point.scale, Math.max(0.05, (bottom.y - top.y) / entity.h));
  ctx.translate(-x, -y);
  draw();
  ctx.restore();
}

export function drawTrack(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.save();
  const farLeft = project(0, 0), farRight = project(800, 0);
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

  const glow = ctx.createRadialGradient(400, 180, 0, 400, 180, 220);
  glow.addColorStop(0, "rgba(0,240,255,0.22)");
  glow.addColorStop(1, "rgba(0,240,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(180, 0, 440, 400);
  for (let lane = 0; lane <= 6; lane++) {
    const x = lane * 800 / 6;
    const far = project(x, 0), near = project(x, 1040);
    ctx.strokeStyle = lane === 0 || lane === 6 ? "#33e8ff" : "rgba(178,92,255,0.28)";
    ctx.lineWidth = lane === 0 || lane === 6 ? 3 : 1;
    ctx.beginPath(); ctx.moveTo(far.x, far.y); ctx.lineTo(near.x, near.y); ctx.stroke();
  }
  for (let y = state.gridOffset - 120; y < 1060; y += 120) {
    if (y < 0) continue;
    const left = project(0, y), right = project(800, y);
    ctx.strokeStyle = `rgba(192,73,255,${0.12 + left.scale * 0.22})`;
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
  }
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
  // Ground marker stays visible through a roll; the maneuver is cosmetic.
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
