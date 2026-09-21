import { createFlightPose, type FlightPose } from "./RacerVisuals";

export type GameMode = "arcade" | "racer" | "chaos";
export type PowerUpType = "shield" | "weapon" | "boost" | "emp";
export type ObstacleType = "block" | "sweeper";

export interface Entity {
  x: number;
  y: number;
  w: number;
  h: number;
  speed?: number;
  color: string;
}

export interface Obstacle extends Entity {
  type: ObstacleType;
  points: number;
  drift: number;
  nearMissChecked: boolean;
}

export interface PowerUp extends Entity {
  type: PowerUpType;
  active: boolean;
}

export interface Projectile extends Entity {
  speed: number;
  trail: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface StarFieldParticle {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
  twinkle: number;
}

export interface GameState {
  flight: FlightPose;
  player: {
    x: number;
    y: number;
    w: number;
    h: number;
    baseSpeed: number;
    speed: number;
    hasShield: boolean;
    weaponTimer: number;
    boostTimer: number;
  };
  keys: { [key: string]: boolean };
  obstacles: Obstacle[];
  projectiles: Projectile[];
  powerUps: PowerUp[];
  particles: Particle[];
  stars: StarFieldParticle[];
  gridOffset: number;
  score: number;
  level: number;
  frames: number;
  isGameOver: boolean;
  isStarted: boolean;
  isPaused: boolean;
  baseObstacleSpeed: number;
  spawnRate: number; // frames between obstacle spawns
  obstacleSpawnCounter: number;
  powerUpSpawnCounter: number;
  powerUpSpawnDelay: number;
  weaponCooldown: number;
  distance: number;
  combo: number;
  comboWindow: number;
  maxCombo: number;
  mode: GameMode;
  momentum: number;
  maxMomentum: number;
  focus: number;
  maxFocus: number;
  focusTimer: number;
  focusCooldown: number;
  screenShake: number;
  nearMissStreak: number;
  maxNearMissStreak: number;
  timeWarpTimer: number;
  stormCountdown: number;
  stormTimer: number;
  stormSpawnCounter: number;
  stormWave: number;
  stormsCleared: number;
  stormSafeLane: number;
  stormPatternStep: number;
}

export interface GameModeProfile {
  label: string;
  playerSpeed: number;
  boostSpeed: number;
  baseObstacleSpeed: number;
  spawnRate: number;
  minSpawnRate: number;
  obstacleWidth: [number, number];
  obstacleHeight: [number, number];
  obstacleSpeedVariance: number;
  powerUpDelay: [number, number];
  boostDuration: number;
  timeWarpDuration: number;
  stormInterval: number;
  stormDuration: number;
}

export const GAME_MODE_PROFILES: Record<GameMode, GameModeProfile> = {
  arcade: {
    label: "Arcade",
    playerSpeed: 7,
    boostSpeed: 11,
    baseObstacleSpeed: 4,
    spawnRate: 60,
    minSpawnRate: 24,
    obstacleWidth: [36, 82],
    obstacleHeight: [20, 36],
    obstacleSpeedVariance: 2.2,
    powerUpDelay: [320, 560],
    boostDuration: 360,
    timeWarpDuration: 240,
    stormInterval: 1500,
    stormDuration: 540,
  },
  racer: {
    label: "Racer",
    playerSpeed: 8.5,
    boostSpeed: 13,
    baseObstacleSpeed: 4.8,
    spawnRate: 52,
    minSpawnRate: 18,
    obstacleWidth: [32, 78],
    obstacleHeight: [20, 34],
    obstacleSpeedVariance: 2.6,
    powerUpDelay: [260, 500],
    boostDuration: 390,
    timeWarpDuration: 280,
    stormInterval: 1320,
    stormDuration: 600,
  },
  chaos: {
    label: "Chaos",
    playerSpeed: 9.2,
    boostSpeed: 13.8,
    baseObstacleSpeed: 5.4,
    spawnRate: 44,
    minSpawnRate: 16,
    obstacleWidth: [30, 88],
    obstacleHeight: [18, 38],
    obstacleSpeedVariance: 2.9,
    powerUpDelay: [220, 440],
    boostDuration: 420,
    timeWarpDuration: 320,
    stormInterval: 1140,
    stormDuration: 660,
  },
};

const createStarField = (cw: number, ch: number) => {
  const count = Math.max(90, Math.floor((cw * ch) / 3500));
  const stars: StarFieldParticle[] = [];

  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * cw,
      y: Math.random() * ch,
      size: Math.random() * 1.8 + 0.4,
      speed: Math.random() * 0.9 + 0.3,
      alpha: Math.random() * 0.6 + 0.2,
      twinkle: Math.random() * Math.PI * 2,
    });
  }

  return stars;
};

const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min;

export const createInitialState = (canvasWidth: number, canvasHeight: number, mode: GameMode = "arcade"): GameState => {
  const profile = GAME_MODE_PROFILES[mode];
  const [minPowerupDelay, maxPowerupDelay] = profile.powerUpDelay;

  return {
    flight: createFlightPose(),
    player: {
      x: canvasWidth / 2 - 20,
      y: canvasHeight - 80,
      w: 40,
      h: 40,
      baseSpeed: profile.playerSpeed,
      speed: profile.playerSpeed,
      hasShield: false,
      weaponTimer: 0,
      boostTimer: 0,
    },
    keys: {},
    obstacles: [],
    projectiles: [],
    powerUps: [],
    particles: [],
    stars: createStarField(canvasWidth, canvasHeight),
    gridOffset: 0,
    score: 0,
    level: 1,
    frames: 0,
    isGameOver: false,
    isStarted: false,
    isPaused: false,
    baseObstacleSpeed: profile.baseObstacleSpeed,
    spawnRate: profile.spawnRate,
    obstacleSpawnCounter: 0,
    powerUpSpawnCounter: 0,
    powerUpSpawnDelay: randomBetween(minPowerupDelay, maxPowerupDelay),
    weaponCooldown: 0,
    distance: 0,
    combo: 0,
    comboWindow: 0,
    maxCombo: 0,
    mode,
    momentum: 1,
    maxMomentum: 1,
    focus: 0,
    maxFocus: 0,
    focusTimer: 0,
    focusCooldown: 0,
    screenShake: 0,
    nearMissStreak: 0,
    maxNearMissStreak: 0,
    timeWarpTimer: 0,
    stormCountdown: profile.stormInterval,
    stormTimer: 0,
    stormSpawnCounter: 0,
    stormWave: 0,
    stormsCleared: 0,
    stormSafeLane: 3,
    stormPatternStep: 0,
  };
};

// AABB Collision detection
export const checkCollision = (r1: Entity, r2: Entity) => {
  return (
    r1.x < r2.x + r2.w &&
    r1.x + r1.w > r2.x &&
    r1.y < r2.y + r2.h &&
    r1.y + r1.h > r2.y
  );
};

export const spawnExplosion = (state: GameState, x: number, y: number, color: string, count: number = 20) => {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 5 + 2;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      maxLife: Math.random() * 30 + 20,
      color,
      size: Math.random() * 4 + 2
    });
  }
};

export const createObstacle = (cw: number, state: GameState, isDrifting: boolean): Obstacle => {
  const profile = GAME_MODE_PROFILES[state.mode];
  const w = randomBetween(...profile.obstacleWidth);
  const h = randomBetween(...profile.obstacleHeight);
  const speed = state.baseObstacleSpeed + Math.random() * profile.obstacleSpeedVariance;
  const drift = isDrifting ? (Math.random() < 0.5 ? -1 : 1) * randomBetween(0.8, 2.2) : 0;

  return {
    x: Math.random() * (cw - w),
    y: -h - 40,
    w,
    h,
    speed,
    drift,
    type: isDrifting ? "sweeper" : "block",
    points: isDrifting ? 80 : 50,
    color: isDrifting ? "#00ffd5" : "#ff0055",
    nearMissChecked: false,
  };
};

export const createStormFormation = (cw: number, state: GameState): Obstacle[] => {
  const laneCount = 6;
  const laneWidth = cw / laneCount;
  const corridorSteps = [0, 1, 0, -1, 0, 1, 0, -1];
  const corridorDelta = corridorSteps[(state.stormPatternStep + state.stormWave) % corridorSteps.length];
  state.stormSafeLane = Math.max(0, Math.min(laneCount - 1, state.stormSafeLane + corridorDelta));
  state.stormPatternStep += 1;
  const sharedSpeed = state.baseObstacleSpeed + Math.min(2.4, state.stormWave * 0.18);
  const obstacles: Obstacle[] = [];

  for (let lane = 0; lane < laneCount; lane += 1) {
    if (lane === state.stormSafeLane) continue;
    const obstacle = createObstacle(cw, state, false);
    obstacle.x = lane * laneWidth + 5;
    obstacle.y = -70;
    obstacle.w = laneWidth - 10;
    obstacle.h = state.stormPatternStep % 3 === 0 ? 34 : 24;
    obstacle.speed = sharedSpeed;
    obstacle.drift = 0;
    obstacle.type = "block";
    obstacle.points = 100 + state.stormWave * 10;
    obstacle.color = state.stormPatternStep % 2 === 0 ? "#fb7185" : "#e879f9";
    obstacles.push(obstacle);
  }

  return obstacles;
};

export const createPowerUp = (cw: number, ch: number, mode: GameMode): PowerUp => {
  const spawnRoll = Math.random();
  const type: PowerUpType =
    spawnRoll > 0.86 ? "emp" : spawnRoll > 0.75 ? "boost" : spawnRoll > 0.42 ? "weapon" : "shield";

  return {
    x: Math.random() * (cw - 30),
    y: -50,
    w: 30,
    h: 30,
    speed: 2.8,
    color:
      type === "shield"
        ? "#00ffff"
        : type === "weapon"
          ? "#ff00ff"
          : type === "boost"
            ? "#00ff80"
            : "#ffaa00",
    type,
    active: true,
  };
};

export const createProjectile = (state: GameState, cx: number, isWeaponMode: boolean) => {
  const baseColor = isWeaponMode ? "#ffff33" : "#00eaff";
  const width = isWeaponMode ? 8 : 4;
  const height = isWeaponMode ? 24 : 16;
  const speed = isWeaponMode ? 14 : 12;

  return {
    x: cx - width / 2,
    y: state.player.y,
    w: width,
    h: height,
    speed,
    trail: isWeaponMode ? 16 : 8,
    color: baseColor,
  };
};
