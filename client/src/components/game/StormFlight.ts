import type { GameState } from "./GameEngine";

// Render only enough pixels for the displayed playfield, including letterboxing.
export function playfieldScale(width: number, height: number, logicalWidth: number, dpr: number) {
  return Math.max(0.1, Math.min(2, dpr || 1) * Math.min(1, height / 1000, width / logicalWidth));
}

export function flightSpeed(state: GameState) {
  return (state.baseObstacleSpeed * (1 + state.level * 0.015) / 4) *
    (state.timeWarpTimer > 0 ? 0.45 : 1) * (state.focusTimer > 0 ? 0.7 : 1);
}

// Closing distance, not a predicted safe path: sweepers can change lanes.
export function closingHazard(state: GameState) {
  const hitbox = { x: state.player.x + 8, w: state.player.w - 16, y: state.player.y + 10 };
  let nearest = Infinity;
  for (const obstacle of state.obstacles) {
    const gap = hitbox.y - (obstacle.y + obstacle.h);
    if (gap < 0 || obstacle.x >= hitbox.x + hitbox.w || obstacle.x + obstacle.w <= hitbox.x) continue;
    const speed = (obstacle.speed ?? state.baseObstacleSpeed) * (1 + state.level * 0.015) *
      (state.timeWarpTimer > 0 ? 0.45 : 1) * (state.focusTimer > 0 ? 0.7 : 1);
    if (speed > 0) nearest = Math.min(nearest, gap / (speed * 60));
  }
  return nearest <= 1.5 ? nearest <= 0.65 ? "EVADE / FIRE" : "TRAFFIC CLOSING" : "";
}

// Original procedural scenery. No downloads, textures, or per-frame particles.
const skyline = Array.from({ length: 36 }, (_, i) => ({
  x: i / 36, height: 22 + ((i * 31 + 7) % 79), width: 12 + ((i * 13) % 15),
}));

export function drawFlightAtmosphere(ctx: CanvasRenderingContext2D, state: GameState,
  width: number, horizon: number, reducedMotion: boolean) {
  ctx.save();
  const storm = state.stormTimer > 0;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon + 90);
  sky.addColorStop(0, "#030a1b");
  sky.addColorStop(0.65, storm ? "#241534" : "#141b3f");
  sky.addColorStop(1, storm ? "#794c60" : "#265c78");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizon + 55);
  const glow = ctx.createRadialGradient(width / 2, horizon, 5, width / 2, horizon, width * .55);
  glow.addColorStop(0, storm ? "rgba(249,144,160,.24)" : "rgba(78,220,240,.22)");
  glow.addColorStop(1, "rgba(65,180,215,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, horizon + 90);
  for (const building of skyline) {
    const x = building.x * width;
    ctx.fillStyle = "#070f24";
    ctx.fillRect(x, horizon - building.height, building.width, building.height);
    ctx.fillStyle = storm ? "#b37b8e" : "#428aa6";
    ctx.fillRect(x + 3, horizon - building.height + 6, 2, 3);
    ctx.fillRect(x + building.width - 5, horizon - building.height + 18, 2, 3);
  }
  ctx.strokeStyle = storm ? "rgba(247,164,183,.5)" : "rgba(114,226,243,.5)";
  ctx.beginPath(); ctx.moveTo(0, horizon); ctx.lineTo(width, horizon); ctx.stroke();
  ctx.restore();
  drawPeripheralWeather(ctx, state, width, reducedMotion);
}

export function drawPeripheralWeather(ctx: CanvasRenderingContext2D, state: GameState,
  width: number, reducedMotion: boolean) {
  if (reducedMotion || !state.isStarted || state.isPaused || state.isGameOver || state.repair) return;
  const storm = state.stormTimer > 0;
  const speed = flightSpeed(state);
  const count = storm ? 28 : 12;
  ctx.save();
  ctx.strokeStyle = storm ? "rgba(180,223,247,.32)" : "rgba(133,222,243,.2)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side < 0 ? width * .03 + (i * 29 % 57) : width * .97 - (i * 29 % 57);
    const y = (i * 79 + state.distance * (storm ? 1.6 : .7)) % 1000;
    const length = Math.min(65, (storm ? 20 : 8) + speed * 9);
    ctx.moveTo(x, y); ctx.lineTo(x + side * (storm ? 8 : 3), y + length);
  }
  ctx.stroke();
  ctx.restore();
}
