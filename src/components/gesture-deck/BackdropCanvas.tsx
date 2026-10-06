// Lightweight holographic backdrop: perspective grid + drifting particles.
// One canvas, one rAF loop, transform/opacity-only work — no 3D engine.
import { useEffect, useRef } from "react";

const PARTICLE_COUNT = 70;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
}

export function BackdropCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const particles: Particle[] = [];

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.00012,
        vy: (Math.random() - 0.5) * 0.00012,
        r: 0.8 + Math.random() * 1.8,
        a: 0.15 + Math.random() * 0.45,
      });
    }

    const horizon = 0.62;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, w, h);

      // deep-space gradient
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#010409");
      g.addColorStop(horizon, "#03101e");
      g.addColorStop(1, "#010409");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // perspective grid below the horizon
      ctx.strokeStyle = "rgba(34, 211, 238, 0.10)";
      ctx.lineWidth = 1;
      const gridY = h * horizon;
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const y = gridY + (h - gridY) * t * t;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let i = -10; i <= 10; i++) {
        ctx.beginPath();
        ctx.moveTo(w / 2 + i * (w / 40), gridY);
        ctx.lineTo(w / 2 + i * (w / 8), h);
        ctx.stroke();
      }
      // horizon glow
      const hg = ctx.createLinearGradient(0, gridY - 40, 0, gridY + 40);
      hg.addColorStop(0, "rgba(34,211,238,0)");
      hg.addColorStop(0.5, "rgba(34,211,238,0.16)");
      hg.addColorStop(1, "rgba(34,211,238,0)");
      ctx.fillStyle = hg;
      ctx.fillRect(0, gridY - 40, w, 80);

      // particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x += 1;
        if (p.x > 1) p.x -= 1;
        if (p.y < 0) p.y += 1;
        if (p.y > 1) p.y -= 1;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(103, 232, 249, ${p.a})`;
        ctx.fill();
      }
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="gd-backdrop" aria-hidden="true" />;
}
