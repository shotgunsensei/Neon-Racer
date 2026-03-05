import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  sparklePhase: number;
  sparkleSpeed: number;
}

interface CorruptionBlock {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  life: number;
  maxLife: number;
  flickerRate: number;
  phase: number;
}

const CORRUPTION_COLORS = [
  "rgba(255, 0, 255,",
  "rgba(0, 255, 255,",
  "rgba(140, 0, 255,",
];

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let startTime = performance.now();

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const stars: Star[] = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 1.5 + 0.5,
      speed: Math.random() * 0.15 + 0.05,
      opacity: Math.random() * 0.6 + 0.2,
      sparklePhase: Math.random() * Math.PI * 2,
      sparkleSpeed: Math.random() * 0.8 + 0.3,
    }));

    const blocks: CorruptionBlock[] = [];
    let lastBlockSpawn = 0;

    let scanlineX = -200;
    let scanlineActive = false;
    let lastScanline = 0;

    const gridOffset = { y: 0 };

    function spawnBlock(now: number) {
      if (blocks.length > 6) return;
      blocks.push({
        x: Math.random() * (canvas!.width - 60) + 30,
        y: Math.random() * (canvas!.height * 0.4) + canvas!.height * 0.1,
        w: Math.random() * 40 + 15,
        h: Math.random() * 20 + 8,
        color: CORRUPTION_COLORS[Math.floor(Math.random() * CORRUPTION_COLORS.length)],
        life: 0,
        maxLife: Math.random() * 3000 + 2000,
        flickerRate: Math.random() * 10 + 5,
        phase: Math.random() * Math.PI * 2,
      });
      lastBlockSpawn = now;
    }

    function drawGradient(w: number, h: number) {
      const grad = ctx!.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, "#071026");
      grad.addColorStop(0.5, "#0b0420");
      grad.addColorStop(1, "#2b0036");
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, w, h);
    }

    function drawStars(now: number, dt: number) {
      for (const star of stars) {
        star.y += star.speed * (dt / 16);
        if (star.y > canvas!.height) {
          star.y = 0;
          star.x = Math.random() * canvas!.width;
        }
        const sparkle = Math.sin(now * 0.001 * star.sparkleSpeed + star.sparklePhase);
        const alpha = star.opacity * (0.6 + sparkle * 0.4);
        ctx!.fillStyle = `rgba(255, 255, 255, ${Math.max(0, alpha)})`;
        ctx!.beginPath();
        ctx!.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function drawGrid(now: number, dt: number) {
      const w = canvas!.width;
      const h = canvas!.height;
      const horizonY = h * 0.55;
      const gridBottom = h;
      const gridHeight = gridBottom - horizonY;

      const elapsed = (now - startTime) / 1000;
      const speed = 30 + elapsed * 0.5;
      gridOffset.y = (gridOffset.y + speed * (dt / 1000)) % 60;

      ctx!.save();

      const lineCount = 20;
      const vanishX = w / 2;

      ctx!.strokeStyle = "rgba(140, 0, 255, 0.3)";
      ctx!.lineWidth = 1;

      for (let i = 0; i <= lineCount; i++) {
        const t = i / lineCount;
        const leftX = vanishX - (vanishX + 200) * t;
        const rightX = vanishX + (vanishX + 200) * t;

        ctx!.beginPath();
        ctx!.moveTo(vanishX, horizonY);
        ctx!.lineTo(leftX, gridBottom);
        ctx!.stroke();

        ctx!.beginPath();
        ctx!.moveTo(vanishX, horizonY);
        ctx!.lineTo(rightX, gridBottom);
        ctx!.stroke();
      }

      const hLineCount = 15;
      for (let i = 0; i <= hLineCount; i++) {
        const rawT = (i / hLineCount + gridOffset.y / 60 / hLineCount) % 1;
        const t = rawT * rawT;
        const y = horizonY + gridHeight * t;
        const spread = (y - horizonY) / gridHeight;
        const x1 = vanishX - (vanishX + 200) * spread;
        const x2 = vanishX + (vanishX + 200) * spread;
        const alpha = 0.15 + spread * 0.25;

        ctx!.strokeStyle = `rgba(140, 0, 255, ${alpha})`;
        ctx!.beginPath();
        ctx!.moveTo(x1, y);
        ctx!.lineTo(x2, y);
        ctx!.stroke();
      }

      const glowGrad = ctx!.createLinearGradient(0, horizonY - 5, 0, horizonY + 5);
      glowGrad.addColorStop(0, "rgba(255, 0, 255, 0)");
      glowGrad.addColorStop(0.5, "rgba(255, 0, 255, 0.4)");
      glowGrad.addColorStop(1, "rgba(255, 0, 255, 0)");
      ctx!.fillStyle = glowGrad;
      ctx!.fillRect(0, horizonY - 5, w, 10);

      ctx!.restore();
    }

    function drawCorruptionBlocks(now: number, dt: number) {
      if (now - lastBlockSpawn > 1500 + Math.random() * 1000) {
        spawnBlock(now);
      }

      for (let i = blocks.length - 1; i >= 0; i--) {
        const block = blocks[i];
        block.life += dt;
        if (block.life >= block.maxLife) {
          blocks.splice(i, 1);
          continue;
        }

        const lifeRatio = block.life / block.maxLife;
        let alpha: number;
        if (lifeRatio < 0.2) {
          alpha = lifeRatio / 0.2;
        } else if (lifeRatio > 0.7) {
          alpha = 1 - (lifeRatio - 0.7) / 0.3;
        } else {
          alpha = 1;
        }

        const flicker = Math.sin(block.life * 0.001 * block.flickerRate + block.phase);
        if (flicker > 0.3) {
          alpha *= 0.6 + flicker * 0.4;
          ctx!.fillStyle = `${block.color} ${alpha * 0.5})`;
          ctx!.shadowColor = block.color + "0.8)";
          ctx!.shadowBlur = 10;
          ctx!.fillRect(block.x, block.y, block.w, block.h);
          ctx!.shadowBlur = 0;
        }
      }
    }

    function drawScanline(now: number) {
      if (!scanlineActive && now - lastScanline > 6000) {
        scanlineActive = true;
        scanlineX = -100;
        lastScanline = now;
      }

      if (scanlineActive) {
        scanlineX += 6;
        if (scanlineX > canvas!.width + 100) {
          scanlineActive = false;
        }

        const grad = ctx!.createLinearGradient(scanlineX - 80, 0, scanlineX + 20, 0);
        grad.addColorStop(0, "rgba(0, 255, 255, 0)");
        grad.addColorStop(0.7, "rgba(0, 255, 255, 0.08)");
        grad.addColorStop(1, "rgba(0, 255, 255, 0.3)");

        ctx!.fillStyle = grad;
        ctx!.fillRect(scanlineX - 80, 0, 100, canvas!.height);

        ctx!.strokeStyle = "rgba(0, 255, 255, 0.6)";
        ctx!.lineWidth = 2;
        ctx!.beginPath();
        ctx!.moveTo(scanlineX, 0);
        ctx!.lineTo(scanlineX, canvas!.height);
        ctx!.stroke();
      }
    }

    let lastFrame = performance.now();

    function animate(now: number) {
      const dt = Math.min(now - lastFrame, 50);
      lastFrame = now;

      const w = canvas!.width;
      const h = canvas!.height;

      drawGradient(w, h);
      drawStars(now, dt);
      drawGrid(now, dt);
      drawCorruptionBlocks(now, dt);
      drawScanline(now);

      animId = requestAnimationFrame(animate);
    }

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
      data-testid="animated-background"
    />
  );
}
