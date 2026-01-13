'use client';

import { useEffect, useRef } from 'react';

export default function OceanBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;
    let time = 0;

    // Particles for underwater atmosphere
    interface Particle {
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      opacity: number;
      type: 'bubble' | 'plankton' | 'light';
    }

    const particles: Particle[] = [];

    const resize = () => {
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      // Reinitialize particles on resize
      particles.length = 0;
      initParticles();
    };

    const initParticles = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Bubbles - floating up
      for (let i = 0; i < 40; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 4 + 1,
          speedY: -(Math.random() * 0.8 + 0.2),
          speedX: (Math.random() - 0.5) * 0.3,
          opacity: Math.random() * 0.4 + 0.1,
          type: 'bubble',
        });
      }

      // Plankton - drifting slowly
      for (let i = 0; i < 60; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 2 + 0.5,
          speedY: (Math.random() - 0.5) * 0.2,
          speedX: (Math.random() - 0.5) * 0.3,
          opacity: Math.random() * 0.3 + 0.05,
          type: 'plankton',
        });
      }

      // Light rays
      for (let i = 0; i < 8; i++) {
        particles.push({
          x: (width / 9) * (i + 1),
          y: 0,
          size: 30 + Math.random() * 40,
          speedY: 0,
          speedX: 0,
          opacity: 0.03 + Math.random() * 0.02,
          type: 'light',
        });
      }
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      time += 0.01;
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Clear with deep ocean gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#0a1929'); // Surface - darker blue
      gradient.addColorStop(0.15, '#0d2137'); // Upper water
      gradient.addColorStop(0.4, '#0a1a2e'); // Mid depth
      gradient.addColorStop(0.7, '#061422'); // Deep
      gradient.addColorStop(1, '#030a12'); // Abyss
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Draw water surface with waves at very top
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let x = 0; x <= width; x += 20) {
        const waveY = 15 + Math.sin(x * 0.008 + time * 1.5) * 8 + Math.sin(x * 0.015 + time * 2) * 4;
        ctx.lineTo(x, waveY);
      }
      ctx.lineTo(width, 0);
      ctx.closePath();
      const surfaceGradient = ctx.createLinearGradient(0, 0, 0, 30);
      surfaceGradient.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
      surfaceGradient.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = surfaceGradient;
      ctx.fill();
      ctx.restore();

      // Draw light rays from surface
      particles.filter(p => p.type === 'light').forEach((p, i) => {
        const rayWidth = p.size + Math.sin(time + i) * 10;
        const shimmer = 0.5 + Math.sin(time * 0.5 + i * 0.7) * 0.5;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p.x - rayWidth / 2, 0);
        ctx.lineTo(p.x + rayWidth / 2, 0);
        ctx.lineTo(p.x + rayWidth * 3, height * 0.8);
        ctx.lineTo(p.x - rayWidth * 3, height * 0.8);
        ctx.closePath();

        const rayGradient = ctx.createLinearGradient(0, 0, 0, height * 0.8);
        rayGradient.addColorStop(0, `rgba(56, 189, 248, ${p.opacity * shimmer})`);
        rayGradient.addColorStop(0.3, `rgba(34, 197, 94, ${p.opacity * 0.5 * shimmer})`);
        rayGradient.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = rayGradient;
        ctx.fill();
        ctx.restore();
      });

      // Draw caustics (light patterns on surfaces)
      for (let i = 0; i < 5; i++) {
        const caustX = (width / 6) * (i + 1) + Math.sin(time + i) * 50;
        const caustY = 100 + Math.cos(time * 0.7 + i * 2) * 30;
        const caustSize = 80 + Math.sin(time * 1.5 + i) * 20;

        ctx.save();
        ctx.beginPath();
        ctx.ellipse(caustX, caustY, caustSize, caustSize * 0.3, Math.sin(time + i) * 0.2, 0, Math.PI * 2);
        const caustGradient = ctx.createRadialGradient(caustX, caustY, 0, caustX, caustY, caustSize);
        caustGradient.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
        caustGradient.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = caustGradient;
        ctx.fill();
        ctx.restore();
      }

      // Draw bubbles
      particles.filter(p => p.type === 'bubble').forEach(p => {
        // Update position
        p.y += p.speedY;
        p.x += p.speedX + Math.sin(time * 2 + p.y * 0.01) * 0.2;

        // Reset if out of bounds
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }

        // Draw bubble
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);

        // Bubble gradient for 3D effect
        const bubbleGradient = ctx.createRadialGradient(
          p.x - p.size * 0.3, p.y - p.size * 0.3, 0,
          p.x, p.y, p.size
        );
        bubbleGradient.addColorStop(0, `rgba(255, 255, 255, ${p.opacity * 0.8})`);
        bubbleGradient.addColorStop(0.5, `rgba(147, 197, 253, ${p.opacity * 0.4})`);
        bubbleGradient.addColorStop(1, `rgba(147, 197, 253, ${p.opacity * 0.1})`);
        ctx.fillStyle = bubbleGradient;
        ctx.fill();

        // Bubble outline
        ctx.strokeStyle = `rgba(147, 197, 253, ${p.opacity * 0.5})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();
      });

      // Draw plankton
      particles.filter(p => p.type === 'plankton').forEach(p => {
        // Update position with gentle drift
        p.y += p.speedY + Math.sin(time + p.x * 0.01) * 0.1;
        p.x += p.speedX + Math.cos(time * 0.5 + p.y * 0.01) * 0.1;

        // Wrap around
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        // Depth-based opacity (deeper = less visible)
        const depthFactor = 1 - (p.y / height) * 0.5;

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(147, 197, 253, ${p.opacity * depthFactor})`;
        ctx.fill();
        ctx.restore();
      });

      // Draw depth indicator on left side
      const depthLabels = ['Surface', '-1%', '-2%', '-5%', '-10%', '-20%', 'Deep'];
      const depthY = [50, height * 0.15, height * 0.25, height * 0.4, height * 0.55, height * 0.7, height * 0.85];

      ctx.save();
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      depthLabels.forEach((label, i) => {
        const y = depthY[i];
        const opacity = 0.3 + Math.sin(time + i) * 0.1;

        // Dashed line
        ctx.setLineDash([4, 8]);
        ctx.strokeStyle = `rgba(56, 189, 248, ${opacity * 0.3})`;
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(80, y);
        ctx.stroke();

        // Label
        ctx.fillStyle = `rgba(148, 163, 184, ${opacity})`;
        ctx.fillText(label, 25, y - 5);
      });
      ctx.restore();

      // Draw sonar ping effect (periodic)
      const pingPhase = (time * 0.5) % 3;
      if (pingPhase < 2) {
        const pingRadius = pingPhase * 200;
        const pingOpacity = Math.max(0, 1 - pingPhase / 2);
        const pingX = 60;
        const pingY = height * 0.3;

        ctx.save();
        ctx.beginPath();
        ctx.arc(pingX, pingY, pingRadius, -Math.PI * 0.3, Math.PI * 0.3);
        ctx.strokeStyle = `rgba(63, 185, 80, ${pingOpacity * 0.4})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      animationFrame = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ display: 'block' }}
    />
  );
}
