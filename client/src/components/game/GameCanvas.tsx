import { useCallback, useEffect, useRef, useState } from "react";
import {
  type GameMode,
  type GameState,
  type Obstacle,
  type Projectile,
  type StarFieldParticle,
  createInitialState,
  createObstacle,
  createPowerUp,
  createProjectile,
  spawnExplosion,
  GAME_MODE_PROFILES,
  checkCollision,
} from "./GameEngine";
import { GameOverModal } from "./GameOverModal";
import { ChevronLeft, ChevronRight, Crosshair, Flame, Hourglass, Shield, Sparkles, Target, Zap } from "lucide-react";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 1000;
const FRAME_TIME = 16.6667;
const HUD_REFRESH_FRAMES = 4;
const MAX_PARTICLES = 240;
const MAX_OBSTACLES = 24;
const MAX_POWERUPS = 6;
const MAX_PROJECTILES = 28;
const TIME_WARP_SCALE = 0.45;
const FOCUS_MAX = 100;
const FOCUS_GAIN_RATE = 0.045;
const FOCUS_DECAY_RATE = 0.16;
const FOCUS_DURATION = 190;
const FOCUS_COOLDOWN = 320;
const FOCUS_SCORE_BONUS = 130;
const FOCUS_SPEED_BONUS = 1.14;
const FOCUS_TIME_SCALE = 0.7;
const NEAR_MISS_PROXIMITY = 12;
const MOMENTUM_MAX = 2.6;
const MOMENTUM_DECAY = 0.0045;

type InputKey = "left" | "right" | "shoot" | "pause" | "start" | "restart" | "focus" | null;

interface HudSnapshot {
  score: number;
  level: number;
  hasShield: boolean;
  weaponTimer: number;
  boostTimer: number;
  distance: number;
  combo: number;
  maxCombo: number;
  nearMissStreak: number;
  maxNearMissStreak: number;
  maxMomentum: number;
  focus: number;
  maxFocus: number;
  focusTimer: number;
  focusCooldown: number;
  timeWarp: number;
  momentum: number;
  isGameOver: boolean;
  isPaused: boolean;
  isStarted: boolean;
  mode: GameMode;
}

interface GameOverMeta {
  score: number;
  level: number;
  distance: number;
  maxCombo: number;
  maxMomentum: number;
  maxFocus: number;
  nearMiss: number;
  mode: GameMode;
}

interface GameCanvasProps {
  mode: GameMode;
  onGameOver: (score: number, level: number, meta?: GameOverMeta) => void;
}

interface DrawableColors {
  player: string;
  playerShield: string;
  obstacle: string;
  obstacleDrift: string;
  projectile: string;
  projectileBoost: string;
  powerUpShield: string;
  powerUpWeapon: string;
  powerUpBoost: string;
  powerUpEmp: string;
  grid: string;
  overlay: string;
}

const COLORS: DrawableColors = {
  player: "#00ffff",
  playerShield: "#ffffff",
  obstacle: "#ff0055",
  obstacleDrift: "#00ffd5",
  projectile: "#00eaff",
  projectileBoost: "#ffff33",
  powerUpShield: "#00ffff",
  powerUpWeapon: "#ff00ff",
  powerUpBoost: "#00ff80",
  powerUpEmp: "#ff8a00",
  grid: "rgba(255, 0, 255, 0.15)",
  overlay: "rgba(0, 0, 0, 0.78)",
};

const MODE_UI = {
  arcade: {
    label: "Arcade",
    detail: "Balanced flow",
  },
  racer: {
    label: "Racer",
    detail: "Aggressive windows",
  },
  chaos: {
    label: "Chaos",
    detail: "Dense threat profile",
  },
};

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

const normalizeInput = (event: KeyboardEvent): InputKey => {
  switch (event.code) {
    case "ArrowLeft":
    case "KeyA":
      return "left";
    case "ArrowRight":
    case "KeyD":
      return "right";
    case "Space":
      return "shoot";
    case "KeyP":
    case "Escape":
      return "pause";
    case "Enter":
      return "start";
    case "KeyR":
      return "restart";
    case "KeyF":
      return "focus";
    default:
      return null;
  }
};

const toHudData = (state: GameState): HudSnapshot => ({
  score: Math.floor(state.score),
  level: state.level,
  hasShield: state.player.hasShield,
  weaponTimer: Math.ceil(state.player.weaponTimer / 60),
  boostTimer: Math.ceil(state.player.boostTimer / 60),
  distance: Math.floor(state.distance / 30),
  combo: state.combo,
  maxCombo: state.maxCombo,
  nearMissStreak: state.nearMissStreak,
  maxNearMissStreak: state.maxNearMissStreak,
  maxMomentum: Math.round(state.maxMomentum * 10) / 10,
  focus: Math.round(state.focus),
  maxFocus: Math.round(state.maxFocus),
  focusTimer: Math.ceil(state.focusTimer / 60),
  focusCooldown: Math.ceil(state.focusCooldown / 60),
  timeWarp: Math.ceil(state.timeWarpTimer / 60),
  momentum: Math.round(state.momentum * 10) / 10,
  isGameOver: state.isGameOver,
  isPaused: state.isPaused,
  isStarted: state.isStarted,
  mode: state.mode,
});

const removeBySwap = <T,>(array: T[], index: number) => {
  const last = array.length - 1;
  if (index < 0 || index > last) return;
  array[index] = array[last];
  array.pop();
};

export function GameCanvas({ mode, onGameOver }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const lastFrameRef = useRef(0);
  const stateRef = useRef<GameState | null>(null);
  const modeRef = useRef<GameMode>(mode);
  const gameOverNotifiedRef = useRef(false);
  const onGameOverRef = useRef(onGameOver);

  const [hudData, setHudData] = useState<HudSnapshot>({
    score: 0,
    level: 1,
    hasShield: false,
    weaponTimer: 0,
    boostTimer: 0,
    distance: 0,
    combo: 0,
    maxCombo: 0,
    nearMissStreak: 0,
    maxNearMissStreak: 0,
    maxMomentum: 1,
    focus: 0,
    maxFocus: 0,
    focusTimer: 0,
    focusCooldown: 0,
    timeWarp: 0,
    momentum: 1,
    isGameOver: false,
    isPaused: false,
    isStarted: false,
    mode: "arcade",
  });

  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  const initGame = useCallback((nextMode: GameMode = modeRef.current) => {
    const state = createInitialState(CANVAS_WIDTH, CANVAS_HEIGHT, nextMode);
    state.mode = nextMode;
    state.isStarted = false;
    state.isPaused = false;
    stateRef.current = state;
    gameOverNotifiedRef.current = false;
    setHudData(toHudData(state));
  }, []);

  const startRun = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;

    if (!state.isStarted) {
      state.isStarted = true;
      state.isPaused = false;
      gameOverNotifiedRef.current = false;
      setHudData((prev) => ({ ...prev, isStarted: true, isPaused: false, isGameOver: false }));
    }
  }, []);

  const togglePause = useCallback(() => {
    const state = stateRef.current;
    if (!state || !state.isStarted || state.isGameOver) return;

    state.isPaused = !state.isPaused;
    setHudData((prev) => ({ ...prev, isPaused: state.isPaused }));
  }, []);

  const restartRun = useCallback(() => {
    initGame(modeRef.current);
    startRun();
  }, [initGame, startRun]);

  const drawNeonRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    isTriangle = false,
  ) => {
    ctx.shadowBlur = 12;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;

    if (isTriangle) {
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w / 2, y + h - 10);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 4);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, state: GameState) => {
    const { player } = state;
    const isBoost = player.boostTimer > 0;
    const isWarped = state.timeWarpTimer > 0;
    const isOverdrive = state.momentum >= 1.8;
    const trailColor = isBoost ? "#ff9900" : COLORS.player;
    const glow = isBoost ? "rgba(255, 120, 0, 0.45)" : "rgba(0, 255, 255, 0.4)";

    const trailLength = isWarped ? 58 : 38;
    const trail = ctx.createLinearGradient(
      player.x + player.w / 2,
      player.y + player.h - 2,
      player.x + player.w / 2,
      player.y + player.h + trailLength,
    );
    trail.addColorStop(0, `${trailColor}00`);
    trail.addColorStop(1, `${trailColor}99`);
    ctx.fillStyle = trail;
    ctx.fillRect(player.x + player.w / 2 - 5, player.y + player.h - 4, 10, trailLength);

    drawNeonRect(ctx, player.x, player.y, player.w, player.h, COLORS.player, true);
    ctx.fillStyle = trailColor;
    ctx.fillRect(player.x + player.w / 2 - 6, player.y + player.h - 3, 12, 6);
    ctx.fillStyle = glow;
    ctx.fillRect(player.x + player.w / 2 - 4, player.y + player.h + 2, 8, 10);

    if (isWarped) {
      ctx.shadowBlur = 24;
      ctx.shadowColor = "#7c3aed";
      ctx.strokeStyle = "rgba(124, 58, 237, 0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(player.x + player.w / 2, player.y + player.h / 2, player.w, player.w * 0.78, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    if (isOverdrive) {
      const overdrivePulse = (Math.sin(state.frames * 0.25) + 1) * 0.5;
      ctx.shadowBlur = 16;
      ctx.shadowColor = `rgba(255, 238, 153, ${0.25 + overdrivePulse * 0.35})`;
      ctx.strokeStyle = `rgba(255, 238, 153, ${0.5 + overdrivePulse * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        player.x + player.w / 2,
        player.y + player.h / 2,
        player.w * 1.05,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    if (player.hasShield) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = COLORS.playerShield;
      ctx.strokeStyle = COLORS.playerShield;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x + player.w / 2, player.y + player.h / 2, player.w, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  };

  const drawPowerUp = (
    ctx: CanvasRenderingContext2D,
    powerUp: {
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      type: string;
    },
  ) => {
    const icon =
      powerUp.type === "shield"
        ? "S"
        : powerUp.type === "weapon"
          ? "W"
          : powerUp.type === "boost"
            ? "B"
            : "E";
    const isEmp = powerUp.type === "emp";

    ctx.save();
    ctx.translate(powerUp.x + powerUp.w / 2, powerUp.y + powerUp.h / 2);
    ctx.shadowBlur = isEmp ? 22 : 14;
    ctx.shadowColor = powerUp.color;
    ctx.fillStyle = powerUp.color;
    ctx.beginPath();
    const radius = powerUp.w / 2;
    ctx.moveTo(0, -radius);
    ctx.lineTo(radius, 0);
    ctx.lineTo(0, radius);
    ctx.lineTo(-radius, 0);
    ctx.closePath();
    ctx.fill();

    if (isEmp) {
      ctx.beginPath();
      ctx.arc(0, 0, radius - 3, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, powerUp.x + powerUp.w / 2, powerUp.y + powerUp.h / 2 + 1);
  };

  const drawObstacle = (ctx: CanvasRenderingContext2D, obstacle: Obstacle) => {
    if (obstacle.type === "sweeper") {
      ctx.shadowBlur = 20;
      ctx.shadowColor = COLORS.obstacleDrift;
      ctx.fillStyle = obstacle.color;
      ctx.beginPath();
      ctx.roundRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h, 5);
      ctx.fill();
      ctx.fillStyle = "rgba(0,255,255,0.45)";
      ctx.fillRect(obstacle.x + 2, obstacle.y + 2, Math.max(4, obstacle.w * 0.15), obstacle.h - 4);
      ctx.fillRect(
        obstacle.x + obstacle.w - Math.max(4, obstacle.w * 0.15),
        obstacle.y + 2,
        Math.max(4, obstacle.w * 0.15),
        obstacle.h - 4,
      );
      ctx.shadowBlur = 0;
      return;
    }

    drawNeonRect(ctx, obstacle.x, obstacle.y, obstacle.w, obstacle.h, obstacle.color);
  };

  const drawProjectiles = (ctx: CanvasRenderingContext2D, state: GameState) => {
    for (const projectile of state.projectiles) {
      const trailGradient = ctx.createLinearGradient(
        projectile.x + projectile.w / 2,
        projectile.y + projectile.h,
        projectile.x + projectile.w / 2,
        projectile.y + projectile.h + projectile.trail,
      );
      trailGradient.addColorStop(0, projectile.color);
      trailGradient.addColorStop(1, `${projectile.color}00`);

      ctx.strokeStyle = trailGradient;
      ctx.lineWidth = Math.max(2, projectile.w * 0.8);
      ctx.beginPath();
      ctx.moveTo(projectile.x + projectile.w / 2, projectile.y + projectile.h);
      ctx.lineTo(projectile.x + projectile.w / 2, projectile.y + projectile.h + projectile.trail);
      ctx.stroke();

      ctx.fillStyle = projectile.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = projectile.color;
      ctx.fillRect(projectile.x, projectile.y, projectile.w, projectile.h);
      ctx.shadowBlur = 0;
    }
  };

  const drawParticles = (ctx: CanvasRenderingContext2D, state: GameState) => {
    for (const particle of state.particles) {
      const alpha = 1 - particle.life / particle.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, state: GameState, cw: number, ch: number) => {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 2;

    for (let i = 0; i < ch; i += 96) {
      const y = (i + state.gridOffset) % ch;
      ctx.globalAlpha = 0.15 + (1 - y / ch) * 0.2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 8; i++) {
      const x = (i * cw) / 8;
      ctx.beginPath();
      ctx.moveTo(cw / 2, 0);
      ctx.lineTo(x, ch);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cw / 2, 0);
      ctx.lineTo(cw - x, ch);
      ctx.stroke();
    }
    ctx.restore();
  };

  const updateGame = useCallback((state: GameState, deltaScale: number, cw: number, ch: number) => {
    const profile = GAME_MODE_PROFILES[state.mode];
    const isFocusMode = state.focusTimer > 0;
    const worldScale = state.timeWarpTimer > 0 ? TIME_WARP_SCALE : 1;
    const focusScale = isFocusMode ? FOCUS_TIME_SCALE : 1;
    const motionScale = deltaScale * worldScale * focusScale;
    const levelSpeed = 1 + state.level * 0.015;
    const isWeaponActive = state.player.weaponTimer > 0;
    const applyMomentum = (amount: number) => {
      state.momentum = clamp(state.momentum + amount, 1, MOMENTUM_MAX);
      state.maxMomentum = Math.max(state.maxMomentum, state.momentum);
    };
    const addFocus = (amount: number) => {
      state.focus = clamp(state.focus + amount, 0, FOCUS_MAX);
      state.maxFocus = Math.max(state.maxFocus, state.focus);
    };

    const fireWeaponBurst = (centerX: number) => {
      const spread = isWeaponActive ? 0 : state.player.w * 0.3;
      const spreadShots = isFocusMode || state.momentum >= 2.15;
      state.projectiles.push(createProjectile(state, centerX, isWeaponActive));
      if (spreadShots) {
        state.projectiles.push(createProjectile(state, centerX - spread, isWeaponActive));
        state.projectiles.push(createProjectile(state, centerX + spread, isWeaponActive));
      }
    };

    state.frames += 1;
    state.player.speed =
      (state.player.boostTimer > 0 ? profile.boostSpeed : profile.playerSpeed) *
      (isFocusMode ? FOCUS_SPEED_BONUS : 1);
    const moveSpeed = state.player.speed * motionScale;

    state.distance += moveSpeed * 1.6;
    const scoreMultiplier =
      1 + (state.combo * 0.05) + (state.momentum - 1) * 0.45 + (isFocusMode ? 0.35 : 0);
    state.score += 0.12 * levelSpeed * deltaScale * 60 * scoreMultiplier;
    state.gridOffset = (state.gridOffset + (state.level + 2) * motionScale) % 120;

    while (state.score >= state.level * 1100) {
      state.level += 1;
      state.baseObstacleSpeed = Math.min(profile.baseObstacleSpeed * 2.2, state.baseObstacleSpeed + 0.35);
      state.spawnRate = Math.max(profile.minSpawnRate, state.spawnRate - 3);
      state.score += 20;
    }

    if (state.player.boostTimer > 0) state.player.boostTimer -= deltaScale;
    if (state.player.weaponTimer > 0) state.player.weaponTimer -= deltaScale;
    if (state.timeWarpTimer > 0) state.timeWarpTimer -= deltaScale;
    if (state.weaponCooldown > 0) state.weaponCooldown -= deltaScale;
    if (state.comboWindow > 0) state.comboWindow -= deltaScale;
    if (state.focusCooldown > 0) state.focusCooldown -= deltaScale;
    if (state.focusTimer > 0) state.focusTimer -= deltaScale;
    state.momentum = clamp(state.momentum - MOMENTUM_DECAY * deltaScale, 1, MOMENTUM_MAX);

    state.player.boostTimer = clamp(state.player.boostTimer, 0, 9999);
    state.player.weaponTimer = clamp(state.player.weaponTimer, 0, 9999);
    state.weaponCooldown = clamp(state.weaponCooldown, 0, 9999);
    state.comboWindow = clamp(state.comboWindow, 0, 9999);
    state.timeWarpTimer = clamp(state.timeWarpTimer, 0, 9999);
    state.focusTimer = clamp(state.focusTimer, 0, FOCUS_DURATION);
    state.focusCooldown = clamp(state.focusCooldown, 0, FOCUS_COOLDOWN);
    if (!isFocusMode && state.focusCooldown <= 0) {
      addFocus(FOCUS_GAIN_RATE * deltaScale * 2);
    }
    state.maxFocus = Math.max(state.maxFocus, state.focus);

    if (state.comboWindow <= 0) {
      state.combo = 0;
    }

    state.screenShake = Math.max(0, state.screenShake - 0.45 * deltaScale);

    if (state.keys.left && state.player.x > 0) {
      state.player.x = clamp(state.player.x - moveSpeed, 0, cw - state.player.w);
    }
    if (state.keys.right && state.player.x + state.player.w < cw) {
      state.player.x = clamp(state.player.x + moveSpeed, 0, cw - state.player.w);
    }

    if (state.weaponCooldown <= 0 && state.isStarted) {
      if (isWeaponActive || state.keys.shoot) {
        const shotX = state.player.x + state.player.w / 2;
        fireWeaponBurst(shotX);
        state.weaponCooldown = isWeaponActive ? (isFocusMode ? 6 : 8) : 15;

        if (state.projectiles.length > MAX_PROJECTILES) {
          state.projectiles.splice(0, state.projectiles.length - MAX_PROJECTILES);
        }
      }
    }

    const dynamicSpawn = Math.max(profile.minSpawnRate, state.spawnRate - state.level * 0.12);
    state.obstacleSpawnCounter += motionScale;
    while (state.obstacleSpawnCounter >= dynamicSpawn && state.obstacles.length < MAX_OBSTACLES) {
      state.obstacleSpawnCounter -= dynamicSpawn;
      state.obstacles.push(createObstacle(cw, state, Math.random() < 0.28));
    }

    state.powerUpSpawnCounter += motionScale;
    if (state.powerUpSpawnCounter >= state.powerUpSpawnDelay) {
      state.powerUpSpawnCounter = 0;
      state.powerUpSpawnDelay = profile.powerUpDelay[0] + Math.random() * (profile.powerUpDelay[1] - profile.powerUpDelay[0]);
      if (state.powerUps.length < MAX_POWERUPS && Math.random() > 0.34) {
        state.powerUps.push(createPowerUp(cw, ch, state.mode));
      }
    }

    for (let i = 0; i < state.projectiles.length; i++) {
      const projectile = state.projectiles[i];
      projectile.y -= (projectile.speed + state.player.speed * 0.12) * motionScale;
    }

    for (let i = 0; i < state.obstacles.length; i++) {
      const obstacle = state.obstacles[i];
      obstacle.y += (obstacle.speed ?? state.baseObstacleSpeed) * levelSpeed * motionScale;
      if (obstacle.type === "sweeper") {
        obstacle.x += obstacle.drift * motionScale;
        if (obstacle.x <= 0 || obstacle.x + obstacle.w >= cw) {
          obstacle.drift *= -1;
          obstacle.x = clamp(obstacle.x, 2, cw - obstacle.w - 2);
        }
      }
    }

    for (let i = 0; i < state.powerUps.length; i++) {
      const powerUp = state.powerUps[i];
      powerUp.y += (powerUp.speed || 2.5) * motionScale;
    }

    for (let i = 0; i < state.stars.length; i++) {
      const star = state.stars[i] as StarFieldParticle;
      star.y += star.speed * 0.7 * levelSpeed * motionScale;
      star.twinkle += 0.08 * deltaScale;
      if (star.y > ch + 10) {
        star.y = -10;
        star.x = Math.random() * cw;
      }
    }

    for (let i = 0; i < state.particles.length; i++) {
      const particle = state.particles[i];
      particle.x += particle.vx * deltaScale;
      particle.y += particle.vy * deltaScale;
      particle.life += deltaScale;
    }

    const playerHitbox = {
      x: state.player.x + 8,
      y: state.player.y + 10,
      w: state.player.w - 16,
      h: state.player.h - 16,
      color: COLORS.player,
    };

    for (let p = state.projectiles.length - 1; p >= 0; p--) {
      const projectile = state.projectiles[p];
      let struck = false;

      for (let o = state.obstacles.length - 1; o >= 0; o--) {
        const obstacle = state.obstacles[o];
        if (checkCollision(projectile, obstacle)) {
          const momentumKillBonus = 1 + (state.momentum - 1) * 0.6;
          state.score += Math.round((obstacle.points + state.combo * 4) * momentumKillBonus);
          state.combo += 1;
          state.maxCombo = Math.max(state.maxCombo, state.combo);
          applyMomentum(0.12 + state.momentum * 0.03);
          addFocus(12 + state.momentum * 2.1);
          state.comboWindow = 180;
          state.screenShake = Math.min(16, state.screenShake + 4);
          spawnExplosion(state, obstacle.x + obstacle.w / 2, obstacle.y + obstacle.h / 2, obstacle.color, 10);
          removeBySwap(state.projectiles, p);
          removeBySwap(state.obstacles, o);
          struck = true;
          break;
        }
      }

      if (struck) continue;
      if (projectile.y < -60 || projectile.y > ch + 40) {
        removeBySwap(state.projectiles, p);
      }
    }

    for (let i = state.powerUps.length - 1; i >= 0; i--) {
      const powerUp = state.powerUps[i];
      if (checkCollision(playerHitbox, powerUp)) {
        spawnExplosion(state, powerUp.x + powerUp.w / 2, powerUp.y + powerUp.h / 2, powerUp.color, 16);

        if (powerUp.type === "shield") {
          state.player.hasShield = true;
          applyMomentum(0.12);
          state.score += 110;
        } else if (powerUp.type === "weapon") {
          state.player.weaponTimer = 600;
          applyMomentum(0.22);
          state.score += 140;
        } else if (powerUp.type === "boost") {
          state.player.boostTimer = profile.boostDuration;
          applyMomentum(0.32);
          state.score += 160;
        } else {
          applyMomentum(0.15);
          state.timeWarpTimer = profile.timeWarpDuration;
          state.score += 220;
          state.screenShake = Math.min(14, state.screenShake + 8);
          state.nearMissStreak = 0;
          for (let o = 0; o < state.obstacles.length; o++) {
            spawnExplosion(
              state,
              state.obstacles[o].x + state.obstacles[o].w / 2,
              state.obstacles[o].y + state.obstacles[o].h / 2,
              state.obstacles[o].color,
              6,
            );
          }
          state.obstacles.length = 0;
        }

        removeBySwap(state.powerUps, i);
        continue;
      }

      if (powerUp.y > ch + 60) {
        removeBySwap(state.powerUps, i);
      }
    }

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const obstacle = state.obstacles[i];
      const obstaclePassedPlayerLine = obstacle.y + obstacle.h >= playerHitbox.y - NEAR_MISS_PROXIMITY;
      if (!obstacle.nearMissChecked && obstaclePassedPlayerLine) {
        obstacle.nearMissChecked = true;
        const obstacleCenter = obstacle.x + obstacle.w / 2;
        const playerCenter = state.player.x + state.player.w / 2;
        const nearDistance = Math.abs(playerCenter - obstacleCenter);
        const nearWindow = (state.player.w + obstacle.w) * 0.45 + NEAR_MISS_PROXIMITY;

        if (nearDistance <= nearWindow) {
          state.nearMissStreak += 1;
          state.maxNearMissStreak = Math.max(state.maxNearMissStreak, state.nearMissStreak);
          state.comboWindow = Math.max(state.comboWindow, 90);
          state.combo = Math.max(state.combo, 1);
          state.score += Math.round((18 + state.nearMissStreak * 5) * (1 + state.momentum * 0.2));
          applyMomentum(0.07 + state.nearMissStreak * 0.01);
          addFocus(8 + state.nearMissStreak * 0.7);
          state.screenShake = Math.min(10, state.screenShake + 1.5);
        } else {
          state.nearMissStreak = 0;
          state.momentum = Math.max(1, state.momentum - 0.08);
          state.focus = Math.max(0, state.focus - 4);
        }
      }

      if (checkCollision(playerHitbox, obstacle)) {
        spawnExplosion(
          state,
          state.player.x + state.player.w / 2,
          state.player.y + state.player.h / 2,
          COLORS.player,
          28,
        );

        if (state.player.hasShield) {
          state.player.hasShield = false;
          state.momentum = Math.max(1, state.momentum * 0.78);
          state.score += 20;
          state.focus = Math.max(0, state.focus * 0.6);
          removeBySwap(state.obstacles, i);
          continue;
        }

        state.isGameOver = true;
        state.screenShake = 18;
        state.player.weaponTimer = 0;
        state.player.boostTimer = 0;
        state.focusTimer = 0;
        state.focusCooldown = 0;
        state.projectiles = [];
        state.nearMissStreak = 0;
        state.momentum = 1;
        state.focus = 0;
        spawnExplosion(
          state,
          state.player.x + state.player.w / 2,
          state.player.y + state.player.h / 2,
          COLORS.player,
          80,
        );
        break;
      }

      if (obstacle.y > ch + obstacle.h + 80) {
        removeBySwap(state.obstacles, i);
      }
    }

    for (let i = state.particles.length - 1; i >= 0; i--) {
      if (state.particles[i].life >= state.particles[i].maxLife) {
        removeBySwap(state.particles, i);
      }
    }

    if (state.particles.length > MAX_PARTICLES) {
      state.particles.splice(0, state.particles.length - MAX_PARTICLES);
    }
  }, []);

  const drawForeground = (ctx: CanvasRenderingContext2D, state: GameState, cw: number, ch: number) => {
    for (const star of state.stars as StarFieldParticle[]) {
      const twinkle = 0.35 + Math.sin(star.twinkle) * 0.4;
      ctx.globalAlpha = Math.max(0.1, star.alpha * twinkle);
      ctx.fillStyle = "#7bdff5";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }

    drawGrid(ctx, state, cw, ch);
    drawParticles(ctx, state);

    for (const obstacle of state.obstacles) {
      drawObstacle(ctx, obstacle);
    }

    drawProjectiles(ctx, state);

    for (const powerUp of state.powerUps) {
      drawPowerUp(ctx, powerUp);
    }

    if (!state.isGameOver) {
      drawPlayer(ctx, state);
    }
  };

  const drawGame = (ctx: CanvasRenderingContext2D, state: GameState, cw: number, ch: number) => {
    const background = ctx.createLinearGradient(0, 0, 0, ch);
    background.addColorStop(0, "rgba(6, 10, 32, 1)");
    background.addColorStop(0.52, "rgba(10, 8, 20, 1)");
    background.addColorStop(1, "rgba(28, 0, 45, 1)");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, cw, ch);

    if (state.timeWarpTimer > 0) {
      ctx.save();
      ctx.fillStyle = "rgba(124, 58, 237, 0.08)";
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
    }

    if (state.screenShake > 0) {
      const jitter = clamp(state.screenShake * 0.6, 0, 8);
      ctx.save();
      ctx.translate(Math.random() * jitter * 2 - jitter, Math.random() * jitter * 2 - jitter);
      drawForeground(ctx, state, cw, ch);
      ctx.restore();
      return;
    }

    drawForeground(ctx, state, cw, ch);

    if (state.timeWarpTimer > 0) {
      const pulse = (Math.sin(state.frames * 0.2) + 1) * 0.5;
      ctx.save();
      ctx.strokeStyle = `rgba(124, 58, 237, ${0.14 + pulse * 0.08})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(20, 20);
      ctx.lineTo(cw - 20, 20);
      ctx.moveTo(20, ch - 20);
      ctx.lineTo(cw - 20, ch - 20);
      ctx.moveTo(20, 20);
      ctx.lineTo(20, ch - 20);
      ctx.moveTo(cw - 20, 20);
      ctx.lineTo(cw - 20, ch - 20);
      ctx.stroke();
      ctx.restore();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    canvas.style.aspectRatio = `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    initGame(mode);

    const handleKeyDown = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (!state) return;

      const key = normalizeInput(e);
      if (!key) return;

      if (key === "start") {
        e.preventDefault();
        startRun();
        return;
      }

      if (key === "pause") {
        e.preventDefault();
        togglePause();
        return;
      }

      if (key === "restart" && state.isGameOver) {
        e.preventDefault();
        restartRun();
        return;
      }

      if (!state.isStarted && (key === "left" || key === "right" || key === "shoot")) {
        startRun();
      }

      if (key === "left" || key === "right" || key === "shoot") {
        state.keys[key] = true;
      }

      e.preventDefault();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (!state) return;

      const key = normalizeInput(e);
      if (key === "left" || key === "right" || key === "shoot") {
        state.keys[key] = false;
      }
    };

    const loop = (time: number) => {
      const state = stateRef.current;
      const deltaMs = time - (lastFrameRef.current || time);
      lastFrameRef.current = time;
      const deltaScale = Math.min(40, deltaMs || FRAME_TIME) / FRAME_TIME;

      if (state && state.isStarted && !state.isPaused && !state.isGameOver) {
        updateGame(state, deltaScale, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      if (state) {
        drawGame(ctx, state, CANVAS_WIDTH, CANVAS_HEIGHT);
      } else {
        drawGame(ctx, createInitialState(CANVAS_WIDTH, CANVAS_HEIGHT, mode), CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      if (state?.isGameOver && !gameOverNotifiedRef.current) {
        const meta: GameOverMeta = {
          score: Math.floor(state.score),
          level: state.level,
          distance: Math.floor(state.distance / 30),
          maxCombo: state.maxCombo,
          maxMomentum: Math.round(state.maxMomentum * 10) / 10,
          maxFocus: Math.round(state.maxFocus),
          nearMiss: state.maxNearMissStreak,
          mode: state.mode,
        };
        gameOverNotifiedRef.current = true;
        onGameOverRef.current(meta.score, meta.level, meta);
      }

      if (state && (state.frames % HUD_REFRESH_FRAMES === 0 || state.isGameOver || state.isPaused || !state.isStarted)) {
        const next = toHudData(state);
        setHudData((previous) => {
          if (
            previous.score !== next.score ||
            previous.level !== next.level ||
            previous.hasShield !== next.hasShield ||
            previous.weaponTimer !== next.weaponTimer ||
            previous.boostTimer !== next.boostTimer ||
            previous.distance !== next.distance ||
            previous.combo !== next.combo ||
            previous.maxCombo !== next.maxCombo ||
            previous.nearMissStreak !== next.nearMissStreak ||
            previous.maxNearMissStreak !== next.maxNearMissStreak ||
            previous.maxMomentum !== next.maxMomentum ||
            previous.momentum !== next.momentum ||
            previous.timeWarp !== next.timeWarp ||
            previous.isPaused !== next.isPaused ||
            previous.isStarted !== next.isStarted ||
            previous.isGameOver !== next.isGameOver ||
            previous.mode !== next.mode
          ) {
            return next;
          }

          return previous;
        });
      }

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      cancelAnimationFrame(requestRef.current);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [initGame, mode, restartRun, startRun, togglePause, updateGame]);

  useEffect(() => {
    modeRef.current = mode;
    if (stateRef.current && stateRef.current.mode !== mode) {
      initGame(mode);
    }
  }, [mode, initGame]);

  const setTouchInput = useCallback(
    (key: "left" | "right" | "shoot", pressed: boolean) => {
      const state = stateRef.current;
      if (!state) return;
      if (pressed && !state.isStarted) startRun();
      state.keys[key] = pressed;
    },
    [startRun],
  );

  const touchControlProps = (key: "left" | "right" | "shoot") => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setTouchInput(key, true);
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setTouchInput(key, false);
    },
    onPointerCancel: () => setTouchInput(key, false),
    onLostPointerCapture: () => setTouchInput(key, false),
  });

  return (
    <div className="relative w-full max-w-4xl mx-auto scanlines border-4 border-primary rounded-xl overflow-hidden box-glow-primary bg-black">
      <canvas ref={canvasRef} className="w-full h-auto max-h-[80vh] block object-contain" />

      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none">
        <div className="space-y-2">
          <div className="bg-background/80 backdrop-blur border border-primary/50 text-primary px-4 py-2 rounded-lg font-display text-2xl shadow-[0_0_10px_rgba(0,255,255,0.3)]">
            SCORE: {hudData.score.toLocaleString()}
          </div>
          <div className="bg-background/80 backdrop-blur border border-secondary/50 text-secondary px-4 py-1 rounded-lg font-display text-lg shadow-[0_0_10px_rgba(255,0,255,0.3)] inline-block">
            LEVEL {hudData.level}
          </div>
          {hudData.timeWarp > 0 && (
            <div className="mt-2 text-xs text-accent flex items-center gap-1">
              <Hourglass className="w-4 h-4" />
              TIME WARP: {hudData.timeWarp}
            </div>
          )}
        </div>

        <div className="space-y-1 text-right">
          <div className="bg-background/80 border border-border/40 px-4 py-2 rounded-lg">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">MODE</p>
            <p className="font-display text-primary">{MODE_UI[hudData.mode].label}</p>
            <p className="text-xs text-muted-foreground">{MODE_UI[hudData.mode].detail}</p>
          </div>
          <div className="bg-background/80 border border-border/40 px-4 py-2 rounded-lg">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Distance</p>
            <p className="font-display text-accent">{hudData.distance}</p>
          </div>
          <div className="bg-background/80 border border-border/40 px-4 py-2 rounded-lg">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Combo</p>
            <p className="font-display text-secondary">
              {hudData.combo} / {hudData.maxCombo}
            </p>
          </div>
          <div className="bg-background/80 border border-border/40 px-4 py-2 rounded-lg">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Near-Miss</p>
            <p className="font-display text-accent">
              {hudData.nearMissStreak} / {hudData.maxNearMissStreak}
            </p>
            <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden border border-muted-foreground/20">
              <div
                className="h-full bg-accent transition-all duration-150"
                style={{ width: `${Math.min(100, (hudData.maxNearMissStreak / 12) * 100)}%` }}
              />
            </div>
          </div>
          <div className="bg-background/80 border border-border/40 px-4 py-2 rounded-lg">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Overdrive</p>
            <p className={`font-display ${hudData.momentum >= 2 ? "text-secondary" : "text-primary"}`}>
              {hudData.momentum.toFixed(1)}x
            </p>
            <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden border border-muted-foreground/20">
              <div
                className={`h-full transition-all duration-150 ${hudData.momentum >= 2 ? "bg-secondary" : "bg-primary"}`}
                style={{ width: `${Math.min(100, ((hudData.momentum - 1) / (MOMENTUM_MAX - 1)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-10 flex gap-2 pointer-events-none">
        {hudData.hasShield && (
          <div className="w-12 h-12 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center box-glow-primary animate-pulse">
            <Shield className="w-6 h-6 text-primary" />
          </div>
        )}
        {hudData.weaponTimer > 0 && (
          <div className="w-12 h-12 rounded-full bg-secondary/20 border-2 border-secondary flex items-center justify-center box-glow-secondary relative">
            <Zap className="w-6 h-6 text-secondary" />
            <div className="absolute -bottom-2 -right-2 bg-background border border-secondary rounded text-xs px-1 font-mono text-secondary">
              {hudData.weaponTimer}
            </div>
          </div>
        )}
        {hudData.boostTimer > 0 && (
          <div className="w-12 h-12 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center box-glow-accent relative">
            <Flame className="w-6 h-6 text-accent" />
            <div className="absolute -bottom-2 -right-2 bg-background border border-accent rounded text-xs px-1 font-mono text-accent">
              {hudData.boostTimer}
            </div>
          </div>
        )}
        {hudData.timeWarp > 0 && (
          <div className="w-12 h-12 rounded-full bg-purple-600/20 border-2 border-purple-400 flex items-center justify-center relative box-glow-primary">
            <Sparkles className="w-6 h-6 text-purple-400" />
            <div className="absolute -bottom-2 -right-2 bg-background border border-purple-400 rounded text-xs px-1 font-mono text-purple-300">
              {hudData.timeWarp}
            </div>
          </div>
        )}
      </div>

      {(!hudData.isStarted || !hudData.mode) && (
        <div className="absolute inset-0 bg-background/75 backdrop-blur-sm border border-primary/40 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-2xl font-display text-primary text-glow-primary">Run Ready: {MODE_UI[hudData.mode].label}</p>
          <p className="text-sm text-muted-foreground max-w-lg">
            Dodge obstacles, lock in pickups, and keep your combo alive. <br />
            Press <span className="text-primary">ENTER</span> or move/shoot to launch.
          </p>
          <button
            onClick={startRun}
            className="px-7 py-3 rounded-lg bg-primary/20 border border-primary text-primary font-display tracking-wide"
          >
            Launch Run
          </button>
        </div>
      )}

      {hudData.isPaused && !hudData.isGameOver && (
        <div className="absolute inset-0 bg-background/65 backdrop-blur-sm border border-secondary/40 flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-2xl font-display text-secondary text-glow-secondary">PAUSED</p>
          <p className="text-sm text-muted-foreground">Press <span className="text-secondary">P</span> or <span className="text-secondary">ESC</span> to resume.</p>
          <button
            onClick={togglePause}
            className="px-7 py-3 rounded-lg bg-secondary/20 border border-secondary text-secondary font-display tracking-wide"
          >
            Resume
          </button>
        </div>
      )}

      {hudData.isGameOver && (
        <GameOverModal
          score={hudData.score}
          level={hudData.level}
          distance={hudData.distance}
          maxCombo={hudData.maxCombo}
          maxMomentum={hudData.maxMomentum}
          nearMiss={hudData.maxNearMissStreak}
          mode={hudData.mode}
          onRestart={restartRun}
        />
      )}

      {!hudData.isGameOver && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 hidden px-4 [@media(pointer:coarse)]:flex items-end justify-between">
          <div className="pointer-events-auto flex gap-3">
            <button
              type="button"
              aria-label="Move left"
              className="flex h-16 w-16 touch-none select-none items-center justify-center rounded-full border-2 border-primary bg-background/80 text-primary backdrop-blur box-glow-primary active:bg-primary/30"
              {...touchControlProps("left")}
            >
              <ChevronLeft className="h-9 w-9" />
            </button>
            <button
              type="button"
              aria-label="Move right"
              className="flex h-16 w-16 touch-none select-none items-center justify-center rounded-full border-2 border-primary bg-background/80 text-primary backdrop-blur box-glow-primary active:bg-primary/30"
              {...touchControlProps("right")}
            >
              <ChevronRight className="h-9 w-9" />
            </button>
          </div>
          <button
            type="button"
            aria-label="Fire weapon"
            className="pointer-events-auto flex h-16 w-16 touch-none select-none items-center justify-center rounded-full border-2 border-secondary bg-background/80 text-secondary backdrop-blur box-glow-secondary active:bg-secondary/30"
            {...touchControlProps("shoot")}
          >
            <Crosshair className="h-8 w-8" />
          </button>
        </div>
      )}

      {hudData.timeWarp > 0 && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-1"
          style={{
            background: "linear-gradient(90deg, rgba(147,51,234,0.5), rgba(34,211,238,0.5), rgba(147,51,234,0.5))",
            animation: "neon-scan 1.3s linear infinite",
          }}
        />
      )}
    </div>
  );
}
