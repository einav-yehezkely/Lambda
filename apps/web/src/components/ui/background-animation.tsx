'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/theme-context';

const NODE_COUNT    = 90;
const MAX_DIST      = 200;
const CURSOR_RADIUS = 200;

type Node = {
  x: number; y: number; ox: number; oy: number;
  vx: number; vy: number;
  depth: number; r: number;
  phase: number; freq: number;
};

export function BackgroundAnimation() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const rawMouse     = useRef({ x: -1000, y: -1000 });
  const smoothCursor = useRef({ x: -1000, y: -1000 });
  const { isDark }   = useTheme();
  const isDarkRef    = useRef(isDark);

  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animId: number;
    let W = window.innerWidth, H = window.innerHeight;

    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W; canvas.height = H;
    };
    resize();

    const nodes: Node[] = Array.from({ length: NODE_COUNT }, () => {
      const depth = 0.3 + Math.random() * 0.7;
      const x = Math.random() * W, y = Math.random() * H;
      return {
        x, y, ox: x, oy: y,
        vx: (Math.random() - 0.5) * 0.18 * depth,
        vy: (Math.random() - 0.5) * 0.18 * depth,
        depth,
        r: 3 + depth * 3,
        phase: Math.random() * Math.PI * 2,
        freq: 0.006 + Math.random() * 0.008,
      };
    });

    const onMouse = (e: MouseEvent) => { rawMouse.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('resize', resize);

    const sm = smoothCursor.current;

    function tick() {
      ctx.clearRect(0, 0, W, H);

      // Background gradient – switches based on theme
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) * 0.62);
      if (isDarkRef.current) {
        bg.addColorStop(0,    '#0d1117');
        bg.addColorStop(0.48, '#0a1020');
        bg.addColorStop(0.80, '#07162e');
        bg.addColorStop(1,    '#030810');
      } else {
        bg.addColorStop(0,    '#f5f8fc');
        bg.addColorStop(0.48, '#eaf0f9');
        bg.addColorStop(0.80, '#cddcf0');
        bg.addColorStop(1,    '#1A365D');
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Smooth cursor
      sm.x += (rawMouse.current.x - sm.x) * 0.08;
      sm.y += (rawMouse.current.y - sm.y) * 0.08;

      // Update nodes + cursor pull
      for (const n of nodes) {
        n.phase += n.freq;
        n.ox += n.vx + Math.sin(n.phase) * 0.125;
        n.oy += n.vy + Math.cos(n.phase * 0.7) * 0.125;
        const pad = 90;
        if (n.ox < -pad) n.ox = W + pad; else if (n.ox > W + pad) n.ox = -pad;
        if (n.oy < -pad) n.oy = H + pad; else if (n.oy > H + pad) n.oy = -pad;

        const cdx = sm.x - n.ox, cdy = sm.y - n.oy;
        const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
        const pull = cdist < CURSOR_RADIUS ? (1 - cdist / CURSOR_RADIUS) * 28 * n.depth : 0;
        n.x = n.ox + (pull > 0 ? (cdx / cdist) * pull : 0);
        n.y = n.oy + (pull > 0 ? (cdy / cdist) * pull : 0);
      }

      // Edges between nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            const t = 1 - dist / MAX_DIST;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(70, 125, 210, ${t * 0.5 * ((a.depth + b.depth) / 2)})`;
            ctx.lineWidth = 1.4;
            ctx.stroke();
          }
        }
      }

      // Lines from cursor to nearby nodes
      for (const n of nodes) {
        const dx = sm.x - n.x, dy = sm.y - n.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CURSOR_RADIUS) {
          const t = 1 - dist / CURSOR_RADIUS;
          ctx.beginPath();
          ctx.moveTo(sm.x, sm.y);
          ctx.lineTo(n.x, n.y);
          ctx.strokeStyle = `rgba(80, 150, 230, ${t * 0.3})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      // Draw nodes as diamonds
      for (const n of nodes) {
        const s = n.r;
        ctx.beginPath();
        ctx.moveTo(n.x,     n.y - s);
        ctx.lineTo(n.x + s, n.y);
        ctx.lineTo(n.x,     n.y + s);
        ctx.lineTo(n.x - s, n.y);
        ctx.closePath();
        ctx.fillStyle = `rgba(70, 125, 210, ${0.6 * n.depth + 0.2})`;
        ctx.fill();
      }

      // Cursor orb
      if (rawMouse.current.x > -500) {
        const glow = ctx.createRadialGradient(sm.x, sm.y, 0, sm.x, sm.y, 40);
        glow.addColorStop(0,   'rgba(100, 160, 240, 0.22)');
        glow.addColorStop(0.5, 'rgba(80, 140, 220, 0.08)');
        glow.addColorStop(1,   'rgba(60, 120, 200, 0)');
        ctx.beginPath();
        ctx.arc(sm.x, sm.y, 40, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      animId = requestAnimationFrame(tick);
    }

    tick();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 -z-10 block" />;
}
