import { useEffect, useRef, useState, useCallback } from "react";
import { GameState, createInitialState, checkCollision, spawnExplosion } from "./GameEngine";
import { GameOverModal } from "./GameOverModal";
import { Shield, Zap, ChevronLeft, ChevronRight, Crosshair } from "lucide-react";

interface GameCanvasProps {
  onGameOver: (score: number, level: number) => void;
}

const COLORS = {
  player: '#00FFFF',
  playerShield: '#FFFFFF',
  obstacle: '#FF0055',
  projectile: '#FFFF00',
  powerUpShield: '#00FFFF',
  powerUpWeapon: '#FF00FF',
  grid: 'rgba(255, 0, 255, 0.15)',
};

function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const check = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setIsTouch(check());
  }, []);
  return isTouch;
}

export function GameCanvas({ onGameOver }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const stateRef = useRef<GameState | null>(null);
  const isTouchDevice = useIsTouchDevice();
  
  const [hudData, setHudData] = useState({ score: 0, level: 1, hasShield: false, weaponTimer: 0, isGameOver: false });

  const initGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    stateRef.current = createInitialState(canvas.width, canvas.height);
    setHudData({ score: 0, level: 1, hasShield: false, weaponTimer: 0, isGameOver: false });
  };

  const handleRestart = () => {
    initGame();
  };

  const handleTouchControl = useCallback((key: string, pressed: boolean) => {
    if (!stateRef.current) return;
    stateRef.current.keys[key] = pressed;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 800;
    canvas.height = 1000;
    
    initGame();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!stateRef.current) return;
      stateRef.current.keys[e.key] = true;
      
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!stateRef.current) return;
      stateRef.current.keys[e.key] = false;
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);

    const loop = () => {
      if (!stateRef.current || !canvas) return;
      const state = stateRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (!state.isGameOver) {
        updateGame(state, canvas.width, canvas.height);
      }
      
      drawGame(ctx, state, canvas.width, canvas.height);
      
      if (state.frames % 5 === 0 || state.isGameOver) {
        setHudData(prev => {
          if (
            prev.score !== state.score || 
            prev.level !== state.level || 
            prev.hasShield !== state.player.hasShield ||
            Math.ceil(prev.weaponTimer/60) !== Math.ceil(state.player.weaponTimer/60) ||
            prev.isGameOver !== state.isGameOver
          ) {
            return {
              score: Math.floor(state.score),
              level: state.level,
              hasShield: state.player.hasShield,
              weaponTimer: Math.ceil(state.player.weaponTimer / 60),
              isGameOver: state.isGameOver
            };
          }
          return prev;
        });
      }

      if (state.isGameOver && !hudData.isGameOver) {
        onGameOver(Math.floor(state.score), state.level);
      }

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateGame = (state: GameState, cw: number, ch: number) => {
    state.frames++;
    state.score += 0.1 * state.level;
    
    if (state.score > state.level * 1000) {
      state.level++;
      state.spawnRate = Math.max(15, state.spawnRate - 5);
      state.baseObstacleSpeed += 0.5;
    }

    state.gridOffset = (state.gridOffset + state.level + 2) % 100;

    const { player, keys } = state;
    if ((keys["ArrowLeft"] || keys["a"] || keys["A"]) && player.x > 0) {
      player.x -= player.speed;
    }
    if ((keys["ArrowRight"] || keys["d"] || keys["D"]) && player.x + player.w < cw) {
      player.x += player.speed;
    }

    if (player.weaponTimer > 0) {
      player.weaponTimer--;
      if (state.frames % 10 === 0) {
        state.projectiles.push({
          x: player.x + player.w / 2 - 4,
          y: player.y,
          w: 8,
          h: 24,
          speed: 15,
          color: COLORS.projectile
        });
      }
    } else {
      if ((keys[" "] || keys["SpaceBar"]) && state.frames % 15 === 0) {
        state.projectiles.push({
           x: player.x + player.w / 2 - 2,
           y: player.y,
           w: 4,
           h: 15,
           speed: 12,
           color: COLORS.player
        });
      }
    }

    if (state.frames % state.spawnRate === 0) {
      const w = 40 + Math.random() * 60;
      state.obstacles.push({
        x: Math.random() * (cw - w),
        y: -100,
        w: w,
        h: 20 + Math.random() * 30,
        speed: state.baseObstacleSpeed + Math.random() * 2,
        color: COLORS.obstacle
      });
    }

    if (state.frames % 600 === 0 && Math.random() > 0.3) {
      const type = Math.random() > 0.5 ? 'shield' : 'weapon';
      state.powerUps.push({
        x: Math.random() * (cw - 30),
        y: -50,
        w: 30,
        h: 30,
        speed: state.baseObstacleSpeed * 0.8,
        color: type === 'shield' ? COLORS.powerUpShield : COLORS.powerUpWeapon,
        type: type,
        active: true
      });
    }

    state.projectiles.forEach(p => p.y -= p.speed || 10);
    state.obstacles.forEach(o => o.y += o.speed || 5);
    state.powerUps.forEach(p => p.y += p.speed || 4);
    
    state.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life++;
    });

    state.projectiles = state.projectiles.filter(p => p.y > -50);
    state.obstacles = state.obstacles.filter(o => o.y < ch + 50);
    state.powerUps = state.powerUps.filter(p => p.y < ch + 50);
    state.particles = state.particles.filter(p => p.life < p.maxLife);

    state.projectiles.forEach(proj => {
      state.obstacles.forEach(obs => {
        if (checkCollision(proj, obs)) {
          proj.y = -999;
          obs.y = ch + 999;
          state.score += 50;
          spawnExplosion(state, obs.x + obs.w/2, obs.y + obs.h/2, COLORS.obstacle, 15);
        }
      });
    });

    state.powerUps.forEach(pu => {
      if (checkCollision(player, pu)) {
        pu.y = ch + 999;
        spawnExplosion(state, pu.x + pu.w/2, pu.y + pu.h/2, pu.color, 30);
        if (pu.type === 'shield') player.hasShield = true;
        if (pu.type === 'weapon') player.weaponTimer = 60 * 10;
        state.score += 100;
      }
    });

    state.obstacles.forEach(obs => {
      const hitbox = {
        x: player.x + 8,
        y: player.y + 8,
        w: player.w - 16,
        h: player.h - 16
      };
      
      if (checkCollision(hitbox, obs)) {
        if (player.hasShield) {
          player.hasShield = false;
          obs.y = ch + 999;
          spawnExplosion(state, player.x + player.w/2, player.y + player.h/2, COLORS.powerUpShield, 40);
          spawnExplosion(state, obs.x + obs.w/2, obs.y + obs.h/2, COLORS.obstacle, 20);
        } else {
          state.isGameOver = true;
          spawnExplosion(state, player.x + player.w/2, player.y + player.h/2, COLORS.player, 100);
        }
      }
    });
  };

  const drawGame = (ctx: CanvasRenderingContext2D, state: GameState, cw: number, ch: number) => {
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 2;
    for (let i = 0; i < ch; i += 100) {
      const y = (i + state.gridOffset) % ch;
      ctx.globalAlpha = y / ch; 
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.5;
    for (let i = 0; i <= cw; i += 100) {
      ctx.beginPath();
      ctx.moveTo(cw/2, 0); 
      ctx.lineTo(i, ch);
      ctx.stroke();
    }
    ctx.restore();

    ctx.globalCompositeOperation = 'lighter';

    state.particles.forEach(p => {
      const alpha = 1 - (p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    const drawNeonRect = (e: {x: number, y: number, w: number, h: number}, color: string, isTriangle = false) => {
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      if (isTriangle) {
        ctx.moveTo(e.x + e.w / 2, e.y);
        ctx.lineTo(e.x + e.w, e.y + e.h);
        ctx.lineTo(e.x + e.w / 2, e.y + e.h - 10);
        ctx.lineTo(e.x, e.y + e.h);
        ctx.closePath();
      } else {
        ctx.rect(e.x, e.y, e.w, e.h);
      }
      ctx.fill();
      if (isTriangle) {
         ctx.stroke();
      }
      ctx.shadowBlur = 0;
    };

    state.obstacles.forEach(o => drawNeonRect(o, o.color));
    state.projectiles.forEach(p => drawNeonRect(p, p.color));

    state.powerUps.forEach(pu => {
      ctx.shadowBlur = 20;
      ctx.shadowColor = pu.color;
      ctx.fillStyle = pu.color;
      ctx.beginPath();
      ctx.moveTo(pu.x + pu.w/2, pu.y);
      ctx.lineTo(pu.x + pu.w, pu.y + pu.h/2);
      ctx.lineTo(pu.x + pu.w/2, pu.y + pu.h);
      ctx.lineTo(pu.x, pu.y + pu.h/2);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      
      ctx.fillStyle = '#FFF';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pu.type === 'shield' ? 'S' : 'W', pu.x + pu.w/2, pu.y + pu.h/2);
    });

    if (!state.isGameOver) {
      drawNeonRect(state.player, COLORS.player, true);
      
      if (state.player.hasShield) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = COLORS.powerUpShield;
        ctx.strokeStyle = COLORS.powerUpShield;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(state.player.x + state.player.w/2, state.player.y + state.player.h/2, state.player.w, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
    
    ctx.globalCompositeOperation = 'source-over';
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto flex flex-col gap-3">
      <div
        className="relative scanlines border-4 border-primary rounded-xl overflow-hidden box-glow-primary bg-black"
        style={{ touchAction: 'none' }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas 
          ref={canvasRef} 
          className="w-full h-auto max-h-[80vh] object-contain block"
          style={{ aspectRatio: '8/10', touchAction: 'none' }}
        />
        
        <div className="absolute top-0 left-0 w-full p-4 sm:p-6 flex justify-between items-start pointer-events-none">
          <div className="space-y-2">
            <div className="bg-background/80 backdrop-blur border border-primary/50 text-primary px-3 py-1 sm:px-4 sm:py-2 rounded-lg font-display text-lg sm:text-2xl shadow-[0_0_10px_rgba(0,255,255,0.3)]" data-testid="text-score">
              SCORE: {hudData.score.toLocaleString()}
            </div>
            <div className="bg-background/80 backdrop-blur border border-secondary/50 text-secondary px-3 py-0.5 sm:px-4 sm:py-1 rounded-lg font-display text-base sm:text-lg shadow-[0_0_10px_rgba(255,0,255,0.3)] inline-block" data-testid="text-level">
              LEVEL {hudData.level}
            </div>
          </div>
          
          <div className="flex gap-2">
            {hudData.hasShield && (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center box-glow-primary animate-pulse" data-testid="status-shield">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
            )}
            {hudData.weaponTimer > 0 && (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-secondary/20 border-2 border-secondary flex items-center justify-center box-glow-secondary relative" data-testid="status-weapon">
                <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
                <div className="absolute -bottom-2 -right-2 bg-background border border-secondary rounded text-xs px-1 font-mono text-secondary">
                  {hudData.weaponTimer}s
                </div>
              </div>
            )}
          </div>
        </div>

        {hudData.isGameOver && (
          <GameOverModal 
            score={hudData.score} 
            level={hudData.level} 
            onRestart={handleRestart} 
          />
        )}
      </div>

      {isTouchDevice && !hudData.isGameOver && (
        <TouchControls onControl={handleTouchControl} />
      )}
    </div>
  );
}

interface TouchControlsProps {
  onControl: (key: string, pressed: boolean) => void;
}

function TouchControls({ onControl }: TouchControlsProps) {
  const handleTouchStart = useCallback((key: string) => (e: React.TouchEvent) => {
    e.preventDefault();
    onControl(key, true);
  }, [onControl]);

  const handleTouchEnd = useCallback((key: string) => (e: React.TouchEvent) => {
    e.preventDefault();
    onControl(key, false);
  }, [onControl]);

  return (
    <div
      className="flex items-center justify-between gap-4 px-2 select-none"
      style={{ touchAction: 'none' }}
      onContextMenu={(e) => e.preventDefault()}
      data-testid="touch-controls"
    >
      <div className="flex gap-3">
        <button
          className="w-[72px] h-[72px] rounded-xl bg-primary/15 border-2 border-primary/60 flex items-center justify-center active:bg-primary/30 active:border-primary transition-colors"
          onTouchStart={handleTouchStart("ArrowLeft")}
          onTouchEnd={handleTouchEnd("ArrowLeft")}
          onTouchCancel={() => onControl("ArrowLeft", false)}
          data-testid="button-touch-left"
          aria-label="Move left"
        >
          <ChevronLeft className="w-10 h-10 text-primary" />
        </button>
        <button
          className="w-[72px] h-[72px] rounded-xl bg-primary/15 border-2 border-primary/60 flex items-center justify-center active:bg-primary/30 active:border-primary transition-colors"
          onTouchStart={handleTouchStart("ArrowRight")}
          onTouchEnd={handleTouchEnd("ArrowRight")}
          onTouchCancel={() => onControl("ArrowRight", false)}
          data-testid="button-touch-right"
          aria-label="Move right"
        >
          <ChevronRight className="w-10 h-10 text-primary" />
        </button>
      </div>

      <button
        className="w-[72px] h-[72px] rounded-xl bg-secondary/15 border-2 border-secondary/60 flex items-center justify-center active:bg-secondary/30 active:border-secondary transition-colors"
        onTouchStart={handleTouchStart(" ")}
        onTouchEnd={handleTouchEnd(" ")}
        onTouchCancel={() => onControl(" ", false)}
        data-testid="button-touch-fire"
        aria-label="Fire weapon"
      >
        <Crosshair className="w-10 h-10 text-secondary" />
      </button>
    </div>
  );
}
