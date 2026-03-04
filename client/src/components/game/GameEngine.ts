export interface Entity {
  x: number;
  y: number;
  w: number;
  h: number;
  speed?: number;
  color: string;
}

export interface PowerUp extends Entity {
  type: 'shield' | 'weapon';
  active: boolean;
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

export interface GameState {
  player: { x: number; y: number; w: number; h: number; speed: number; hasShield: boolean; weaponTimer: number };
  keys: { [key: string]: boolean };
  obstacles: Entity[];
  projectiles: Entity[];
  powerUps: PowerUp[];
  particles: Particle[];
  gridOffset: number;
  score: number;
  level: number;
  frames: number;
  isGameOver: boolean;
  baseObstacleSpeed: number;
  spawnRate: number; // frames between spawns
}

export const createInitialState = (canvasWidth: number, canvasHeight: number): GameState => ({
  player: {
    x: canvasWidth / 2 - 20,
    y: canvasHeight - 80,
    w: 40,
    h: 40,
    speed: 7,
    hasShield: false,
    weaponTimer: 0
  },
  keys: {},
  obstacles: [],
  projectiles: [],
  powerUps: [],
  particles: [],
  gridOffset: 0,
  score: 0,
  level: 1,
  frames: 0,
  isGameOver: false,
  baseObstacleSpeed: 4,
  spawnRate: 60
});

// AABB Collision detection
export const checkCollision = (r1: Entity | any, r2: Entity | any) => {
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
