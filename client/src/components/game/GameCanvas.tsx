import { useCallback, useEffect, useRef, useState } from "react";
import {
  type GameMode,
  type GameState,
  type StarFieldParticle,
  createInitialState,
  createObstacle,
  createPowerUp,
  createProjectile,
  createStormFormation,
  spawnExplosion,
  GAME_MODE_PROFILES,
  checkCollision,
} from "./GameEngine";
import { drawObstacle, drawRacer, drawTrack, inPerspective, lateralSweep, moveRacer, project, steer } from "./RacerVisuals";
import { GameOverModal } from "./GameOverModal";
import { ChevronLeft, ChevronRight, Crosshair, Flame, Hourglass, Shield, Sparkles, Target, Volume2, VolumeX, Zap } from "lucide-react";
import { useGameAudio } from "./useGameAudio";

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
  stormCountdown: number;
  stormTimer: number;
  stormWave: number;
  stormsCleared: number;
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
  stormCountdown: Math.ceil(state.stormCountdown / 60),
  stormTimer: Math.ceil(state.stormTimer / 60),
  stormWave: state.stormWave,
  stormsCleared: state.stormsCleared,
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
  const reducedMotionRef = useRef(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const lastInactiveDrawRef = useRef(0);
  const lastHudRefreshRef = useRef(0);
  const onGameOverRef = useRef(onGameOver);
  const { muted, ensureAudio, play, setIntensity, toggleMuted } = useGameAudio();
  const playRef = useRef(play);
  const ensureAudioRef = useRef(ensureAudio);

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
    stormCountdown: 0,
    stormTimer: 0,
    stormWave: 0,
    stormsCleared: 0,
    isGameOver: false,
    isPaused: false,
    isStarted: false,
    mode: "arcade",
  });

  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => {
      reducedMotionRef.current = media.matches;
    };
    syncPreference();
    media.addEventListener("change", syncPreference);
    return () => media.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    playRef.current = play;
    ensureAudioRef.current = ensureAudio;
  }, [ensureAudio, play]);

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
      ensureAudioRef.current();
      playRef.current("launch");
      state.isStarted = true;
      state.isPaused = false;
      canvasRef.current?.focus({ preventScroll: true });
      gameOverNotifiedRef.current = false;
      setHudData((prev) => ({ ...prev, isStarted: true, isPaused: false, isGameOver: false }));
    }
  }, []);

  const activateSurge = useCallback(() => {
    const state = stateRef.current;
    if (!state || !state.isStarted || state.isPaused || state.isGameOver) return;
    if (state.focus < FOCUS_MAX || state.focusTimer > 0 || state.focusCooldown > 0) return;

    state.focus = 0;
    state.focusTimer = FOCUS_DURATION;
    state.focusCooldown = FOCUS_COOLDOWN;
    state.score += FOCUS_SCORE_BONUS;
    state.screenShake = Math.max(state.screenShake, 10);
    spawnExplosion(
      state,
      state.player.x + state.player.w / 2,
      state.player.y + state.player.h / 2,
      "#c4b5fd",
      42,
    );
    playRef.current("surge");
    setHudData(toHudData(state));
  }, []);

  const togglePause = useCallback(() => {
    const state = stateRef.current;
    if (!state || !state.isStarted || state.isGameOver) return;

    state.keys = {};
    state.flight.lastTap = -Infinity;
    state.isPaused = !state.isPaused;
    if (!state.isPaused) canvasRef.current?.focus({ preventScroll: true });
    setHudData((prev) => ({ ...prev, isPaused: state.isPaused }));
  }, []);

  const restartRun = useCallback(() => {
    initGame(modeRef.current);
    startRun();
  }, [initGame, startRun]);

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

  const drawProjectiles = (ctx: CanvasRenderingContext2D, state: GameState) => {
    for (const projectile of state.projectiles) {
      inPerspective(ctx, projectile, () => {
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
      });
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
      const point = project(particle.x, particle.y);
      ctx.arc(point.x, point.y, particle.size * point.scale, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
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
      playRef.current("level");
    }

    if (state.stormTimer > 0) {
      state.stormTimer -= deltaScale;
      state.stormSpawnCounter += motionScale;
      const formationInterval = Math.max(48, 92 - state.level * 2 - state.stormWave * 3);
      if (state.stormSpawnCounter >= formationInterval && state.obstacles.length < MAX_OBSTACLES - 4) {
        state.stormSpawnCounter = 0;
        state.obstacles.push(...createStormFormation(cw, state));
      }
      if (state.stormTimer <= 0) {
        state.stormTimer = 0;
        state.stormsCleared += 1;
        state.stormCountdown = Math.max(780, profile.stormInterval - state.stormWave * 75);
        state.score += 500 + state.stormWave * 180;
        addFocus(48);
        applyMomentum(0.35);
        playRef.current("stormClear");
      }
    } else {
      state.stormCountdown -= deltaScale;
      if (state.stormCountdown <= 0) {
        state.stormWave += 1;
        state.stormTimer = profile.stormDuration + Math.min(240, state.stormWave * 30);
        state.stormSpawnCounter = 999;
        state.stormSafeLane = clamp(Math.floor((state.player.x + state.player.w / 2) / (cw / 6)), 0, 5);
        state.stormPatternStep = 0;
        state.obstacles.length = 0;
        state.nearMissStreak = 0;
        state.screenShake = Math.max(state.screenShake, 8);
        playRef.current("storm");
      }
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

    const previousX = state.player.x;
    moveRacer(state, moveSpeed, deltaScale, cw, reducedMotionRef.current);

    if (state.weaponCooldown <= 0 && state.isStarted) {
      if (isWeaponActive || state.keys.shoot) {
        const shotX = state.player.x + state.player.w / 2;
        fireWeaponBurst(shotX);
        state.weaponCooldown = isWeaponActive ? (isFocusMode ? 6 : 8) : 15;
        playRef.current("shot");

        if (state.projectiles.length > MAX_PROJECTILES) {
          state.projectiles.splice(0, state.projectiles.length - MAX_PROJECTILES);
        }
      }
    }

    if (state.stormTimer <= 0) {
      const dynamicSpawn = Math.max(profile.minSpawnRate, state.spawnRate - state.level * 0.12);
      state.obstacleSpawnCounter += motionScale;
      while (state.obstacleSpawnCounter >= dynamicSpawn && state.obstacles.length < MAX_OBSTACLES) {
        state.obstacleSpawnCounter -= dynamicSpawn;
        state.obstacles.push(createObstacle(cw, state, Math.random() < 0.28));
      }
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
    const travelHitbox = lateralSweep(playerHitbox, previousX + 8);

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
      if (checkCollision(travelHitbox, powerUp)) {
        playRef.current("pickup");
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
      const obstaclePassedPlayerLine = obstacle.y > playerHitbox.y + playerHitbox.h;
      if (!obstacle.nearMissChecked && obstaclePassedPlayerLine) {
        obstacle.nearMissChecked = true;
        const horizontalGap = Math.max(
          playerHitbox.x - (obstacle.x + obstacle.w),
          obstacle.x - (playerHitbox.x + playerHitbox.w),
          0,
        );

        if (horizontalGap > 0 && horizontalGap <= NEAR_MISS_PROXIMITY) {
          state.nearMissStreak += 1;
          state.maxNearMissStreak = Math.max(state.maxNearMissStreak, state.nearMissStreak);
          state.comboWindow = Math.max(state.comboWindow, 90);
          state.combo = Math.max(state.combo, 1);
          state.score += Math.round((18 + state.nearMissStreak * 5) * (1 + state.momentum * 0.2));
          applyMomentum(0.07 + state.nearMissStreak * 0.01);
          addFocus(8 + state.nearMissStreak * 0.7);
          state.screenShake = Math.min(10, state.screenShake + 1.5);
          playRef.current("nearMiss");
        } else {
          state.nearMissStreak = 0;
          state.momentum = Math.max(1, state.momentum - 0.08);
          state.focus = Math.max(0, state.focus - 4);
        }
      }

      if (checkCollision(travelHitbox, obstacle)) {
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
          playRef.current("shieldBreak");
          removeBySwap(state.obstacles, i);
          continue;
        }

        state.isGameOver = true;
        playRef.current("crash");
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

    ctx.globalAlpha = 1;
    drawTrack(ctx, state, reducedMotionRef.current);
    drawParticles(ctx, state);

    for (const obstacle of [...state.obstacles].sort((a, b) => a.y - b.y)) {
      drawObstacle(ctx, obstacle);
    }

    drawProjectiles(ctx, state);

    for (const powerUp of state.powerUps) {
      inPerspective(ctx, powerUp, () => drawPowerUp(ctx, powerUp));
    }

    if (!state.isGameOver) {
      drawRacer(ctx, state, reducedMotionRef.current);
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

    if (state.stormTimer > 0) {
      const pulse = reducedMotionRef.current ? 0.4 : (Math.sin(state.frames * 0.18) + 1) * 0.5;
      ctx.save();
      ctx.fillStyle = `rgba(244, 63, 94, ${0.025 + pulse * 0.035})`;
      ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = `rgba(244, 63, 94, ${0.42 + pulse * 0.35})`;
      ctx.lineWidth = 5;
      ctx.strokeRect(10, 10, cw - 20, ch - 20);
      for (let y = 0; y < ch; y += 120) {
        ctx.globalAlpha = 0.08 + pulse * 0.06;
        ctx.fillStyle = "#fb7185";
        ctx.fillRect(0, (y + state.frames * 3) % ch, cw, 2);
      }
      ctx.restore();
    }

    if (state.focusTimer > 0) {
      const pulse = reducedMotionRef.current ? 0.4 : (Math.sin(state.frames * 0.3) + 1) * 0.5;
      ctx.save();
      const surgeGlow = ctx.createRadialGradient(
        state.player.x + state.player.w / 2,
        state.player.y + state.player.h / 2,
        10,
        state.player.x + state.player.w / 2,
        state.player.y + state.player.h / 2,
        360,
      );
      surgeGlow.addColorStop(0, `rgba(34, 211, 238, ${0.08 + pulse * 0.06})`);
      surgeGlow.addColorStop(1, "rgba(124, 58, 237, 0)");
      ctx.fillStyle = surgeGlow;
      ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = `rgba(196, 181, 253, ${0.3 + pulse * 0.3})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(18, 18, cw - 36, ch - 36);
      ctx.restore();
    }

    drawForeground(ctx, state, cw, ch);

    // Impact energy lives at the frame, keeping the camera and lane positions stable.
    if (state.screenShake > 0 && !reducedMotionRef.current) {
      ctx.save();
      ctx.strokeStyle = `rgba(170,236,255,${Math.min(0.45, state.screenShake / 36)})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, cw - 4, ch - 4);
      ctx.restore();
    }

    if (state.timeWarpTimer > 0) {
      const pulse = reducedMotionRef.current ? 0.4 : (Math.sin(state.frames * 0.2) + 1) * 0.5;
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
      const key = normalizeInput(e);
      if (!key) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.matches("input, textarea, select, [role='textbox']") ||
        (target?.closest("button") && key !== "left" && key !== "right")
      ) {
        return;
      }
      const state = stateRef.current;
      if (!state) return;

      if (e.repeat && key !== "left" && key !== "right" && key !== "shoot") {
        e.preventDefault();
        return;
      }

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

      if (key === "focus") {
        e.preventDefault();
        activateSurge();
        return;
      }

      if (!state.isStarted && (key === "left" || key === "right" || key === "shoot")) {
        startRun();
      }

      if (key === "left" || key === "right" || key === "shoot") {
        if (!e.repeat && !state.keys[key] && key !== "shoot") {
          steer(state, key === "left" ? -1 : 1);
        }
        state.keys[e.code] = true;
        state.keys[key] = true;
      }

      e.preventDefault();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (!state) return;

      const key = normalizeInput(e);
      state.keys[e.code] = false;
      if (key === "left" || key === "right" || key === "shoot") {
        state.keys[key] = key === "left"
          ? Boolean(state.keys.KeyA || state.keys.ArrowLeft)
          : key === "right"
            ? Boolean(state.keys.KeyD || state.keys.ArrowRight)
            : false;
      }
    };

    const loop = (time: number) => {
      const state = stateRef.current;
      const deltaMs = time - (lastFrameRef.current || time);
      lastFrameRef.current = time;
      const deltaScale = Math.min(40, deltaMs || FRAME_TIME) / FRAME_TIME;

      const isActivelyRunning = Boolean(state && state.isStarted && !state.isPaused && !state.isGameOver);
      if (state && isActivelyRunning) {
        updateGame(state, deltaScale, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      if (isActivelyRunning || time - lastInactiveDrawRef.current >= 100) {
        lastInactiveDrawRef.current = time;
        if (state) {
          drawGame(ctx, state, CANVAS_WIDTH, CANVAS_HEIGHT);
        } else {
          drawGame(ctx, createInitialState(CANVAS_WIDTH, CANVAS_HEIGHT, mode), CANVAS_WIDTH, CANVAS_HEIGHT);
        }
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

      const shouldRefreshHud =
        state &&
        (isActivelyRunning
          ? state.frames % HUD_REFRESH_FRAMES === 0
          : time - lastHudRefreshRef.current >= 100);
      if (state && shouldRefreshHud) {
        lastHudRefreshRef.current = time;
        const next = toHudData(state);
        setHudData((previous) => {
          setIntensity(Math.min(1, state.level / 12 + (state.stormTimer > 0 ? 0.35 : 0)));
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
            previous.focus !== next.focus ||
            previous.focusTimer !== next.focusTimer ||
            previous.focusCooldown !== next.focusCooldown ||
            previous.timeWarp !== next.timeWarp ||
            previous.stormCountdown !== next.stormCountdown ||
            previous.stormTimer !== next.stormTimer ||
            previous.stormWave !== next.stormWave ||
            previous.stormsCleared !== next.stormsCleared ||
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
    const clearInput = () => {
      const state = stateRef.current;
      if (!state) return;
      state.keys = {};
      state.flight.lastTap = -Infinity;
      if (state.isStarted && !state.isGameOver) {
        state.isPaused = true;
        setHudData(toHudData(state));
      }
    };
    const handleVisibility = () => { if (document.hidden) clearInput(); };
    window.addEventListener("blur", clearInput);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      cancelAnimationFrame(requestRef.current);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearInput);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [activateSurge, initGame, mode, restartRun, setIntensity, startRun, togglePause, updateGame]);

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
      if (pressed && !state.keys[key] && key !== "shoot") {
        steer(state, key === "left" ? -1 : 1);
      }
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
    <div
      className={`relative mx-auto h-full w-full max-w-4xl overflow-hidden border bg-black ${
        hudData.stormTimer > 0
          ? "border-rose-500 shadow-[0_0_38px_rgba(244,63,94,.38)]"
          : hudData.focusTimer > 0
            ? "border-violet-300 shadow-[0_0_42px_rgba(139,92,246,.46)]"
            : "border-primary/80 box-glow-primary"
      }`}
    >
      <canvas ref={canvasRef} tabIndex={0} aria-label="Neon Racer track. Arrow keys or A and D to steer; double-tap a direction to barrel roll. P to pause."
        className="w-full h-full block object-contain outline-none [@media(pointer:coarse)]:pb-20" />

      <div className="pointer-events-none absolute left-0 top-0 flex w-full items-start justify-between p-3 sm:p-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2 sm:block sm:space-y-2">
            <div className="border border-primary/50 bg-background/80 px-3 py-2 font-display text-lg text-primary backdrop-blur sm:text-2xl">
              SCORE: {hudData.score.toLocaleString()}
            </div>
            <div className="inline-block border border-secondary/50 bg-background/80 px-3 py-1 font-display text-sm text-secondary backdrop-blur sm:text-lg">
              LEVEL {hudData.level}
            </div>
          </div>
          <div className="w-36 border border-violet-300/40 bg-background/85 p-2 backdrop-blur sm:w-48">
            <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider">
              <span className={hudData.focus >= FOCUS_MAX ? "text-violet-200" : "text-muted-foreground"}>Neon Surge</span>
              <span className="text-violet-200">{hudData.focusTimer > 0 ? `${hudData.focusTimer}s` : `${hudData.focus}%`}</span>
            </div>
            <div className="h-1.5 overflow-hidden bg-muted">
              <div
                className={`h-full transition-[width] duration-150 ${hudData.focus >= FOCUS_MAX || hudData.focusTimer > 0 ? "bg-violet-300 shadow-[0_0_12px_#c4b5fd]" : "bg-primary"}`}
                style={{ width: `${hudData.focusTimer > 0 ? 100 : hudData.focus}%` }}
              />
            </div>
            <p className="mt-1 hidden font-mono text-[8px] uppercase tracking-wider text-muted-foreground sm:block">
              {hudData.focus >= FOCUS_MAX ? "F // ready" : "Near misses build charge"}
            </p>
          </div>
          {hudData.timeWarp > 0 && (
            <div className="mt-2 text-xs text-accent flex items-center gap-1">
              <Hourglass className="w-4 h-4" />
              TIME WARP: {hudData.timeWarp}
            </div>
          )}
        </div>

        <div className="hidden space-y-1 text-right sm:block">
          <div className="bg-background/80 border border-border/40 px-3 py-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">MODE</p>
            <p className="font-display text-primary">{MODE_UI[hudData.mode].label}</p>
            <p className="text-xs text-muted-foreground">{MODE_UI[hudData.mode].detail}</p>
          </div>
          <div className="bg-background/80 border border-border/40 px-3 py-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Distance</p>
            <p className="font-display text-accent">{hudData.distance}</p>
          </div>
          <div className="bg-background/80 border border-border/40 px-3 py-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Combo</p>
            <p className="font-display text-secondary">
              {hudData.combo} / {hudData.maxCombo}
            </p>
          </div>
          <div className="bg-background/80 border border-border/40 px-3 py-2">
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
          <div className="bg-background/80 border border-border/40 px-3 py-2">
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

      <button
        type="button"
        onClick={toggleMuted}
        className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center border border-border/70 bg-background/85 text-muted-foreground backdrop-blur transition-colors hover:border-primary hover:text-primary sm:right-auto sm:left-1/2 sm:-translate-x-1/2"
        aria-label={muted ? "Enable game audio" : "Mute game audio"}
        title={muted ? "Enable audio" : "Mute audio"}
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      <div className="pointer-events-none absolute bottom-24 right-3 z-10 flex flex-col gap-2 sm:bottom-auto sm:right-4 sm:top-16 sm:flex-row">
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

      {hudData.stormTimer > 0 && (
        <div className="pointer-events-none absolute right-3 top-16 z-10 text-right sm:inset-x-0 sm:text-center">
          <span className="border border-rose-400/40 bg-background/85 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-rose-200 sm:text-xs">
            Storm {hudData.stormWave} · {hudData.stormTimer}s
          </span>
        </div>
      )}

      {hudData.stormTimer <= 0 && hudData.stormCountdown > 0 && hudData.stormCountdown <= 5 && hudData.isStarted && (
        <div className="pointer-events-none absolute right-3 top-16 z-10 text-right sm:inset-x-0 sm:text-center">
          <p className="font-mono text-[9px] uppercase tracking-wider text-rose-300 sm:text-xs">
            Data Storm inbound // {hudData.stormCountdown}
          </p>
        </div>
      )}

      {hudData.focusTimer > 0 && (
        <div className="pointer-events-none absolute right-3 top-24 z-10 text-right sm:inset-x-0 sm:text-center">
          <span className="border border-violet-300/40 bg-background/85 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-violet-100 sm:text-xs">Neon Surge · {hudData.focusTimer}s</span>
        </div>
      )}

      {(!hudData.isStarted || !hudData.mode) && (
        <div className="absolute inset-0 bg-background/75 backdrop-blur-sm border border-primary/40 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-2xl font-display text-primary text-glow-primary">Run Ready: {MODE_UI[hudData.mode].label}</p>
          <p className="text-sm text-muted-foreground max-w-lg">
            Dodge obstacles, lock in pickups, and keep your combo alive. <br />
            Steer with A / D or ← / →. Double-tap either direction for a barrel-roll speed burst. Countersteer to brake; collisions still count. <br />
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
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 hidden px-3 [@media(pointer:coarse)]:flex items-end justify-between">
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
          <div className="pointer-events-auto flex gap-3">
            <button
              type="button"
              aria-label="Activate Neon Surge"
              disabled={hudData.focus < FOCUS_MAX || hudData.focusTimer > 0}
              onClick={activateSurge}
              className="flex h-16 w-16 touch-none select-none items-center justify-center rounded-full border-2 border-violet-300 bg-background/85 text-violet-200 shadow-[0_0_18px_rgba(196,181,253,.35)] active:bg-violet-300/30 disabled:border-muted disabled:text-muted-foreground disabled:shadow-none"
            >
              <Sparkles className="h-7 w-7" />
            </button>
            <button
              type="button"
              aria-label="Fire weapon"
              className="flex h-16 w-16 touch-none select-none items-center justify-center rounded-full border-2 border-secondary bg-background/80 text-secondary backdrop-blur box-glow-secondary active:bg-secondary/30"
              {...touchControlProps("shoot")}
            >
              <Crosshair className="h-8 w-8" />
            </button>
          </div>
        </div>
      )}

      {!hudData.isGameOver && hudData.isStarted && (
        <button
          type="button"
          onClick={activateSurge}
          disabled={hudData.focus < FOCUS_MAX || hudData.focusTimer > 0}
          className="absolute bottom-4 left-4 z-20 border border-violet-300 bg-background/90 px-4 py-2 font-mono text-[10px] uppercase tracking-[.22em] text-violet-100 backdrop-blur transition-all hover:bg-violet-300/20 disabled:border-border/50 disabled:text-muted-foreground [@media(pointer:coarse)]:hidden"
        >
          {hudData.focus >= FOCUS_MAX ? "F // Activate Surge" : `Surge charging // ${hudData.focus}%`}
        </button>
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
