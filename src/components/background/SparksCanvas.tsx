'use client';

import { useEffect, useRef } from 'react';

interface Spark {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  maxOpacity: number;
  hue: number;
  wobble: number;
  wobbleSpeed: number;
}

export function SparksCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const sparksCount = 35;
    const sparks: Spark[] = Array.from({ length: sparksCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2.2 + 0.8,
      speedY: Math.random() * 0.65 + 0.35,
      speedX: (Math.random() - 0.5) * 0.35,
      maxOpacity: Math.random() * 0.8 + 0.2,
      hue: Math.random() > 0.3 ? Math.floor(Math.random() * 20 + 18) : Math.floor(Math.random() * 15 + 40),
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: Math.random() * 0.025 + 0.01,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        s.y -= s.speedY;
        s.wobble += s.wobbleSpeed;
        s.x += Math.sin(s.wobble) * 0.65 + s.speedX;

        if (s.y < -10 || s.x < -10 || s.x > width + 10) {
          s.y = height + 10;
          s.x = Math.random() * width;
        }

        const progress = 1 - s.y / height;
        const fade = progress < 0.15 ? progress / 0.15 : progress > 0.85 ? (1 - progress) / 0.15 : 1;
        const currentOpacity = Math.max(0, Math.min(1, s.maxOpacity * fade));

        ctx.save();
        ctx.shadowBlur = 9;
        ctx.shadowColor = `hsla(${s.hue}, 100%, 55%, ${currentOpacity})`;
        ctx.fillStyle = `hsla(${s.hue}, 100%, 75%, ${currentOpacity})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} className="flame-sparks-canvas" />;
}
