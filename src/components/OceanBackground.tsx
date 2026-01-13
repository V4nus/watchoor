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

    const resize = () => {
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    // Wave parameters for turbulent ocean
    interface Wave {
      amplitude: number;
      wavelength: number;
      speed: number;
      phase: number;
      y: number; // base Y position
    }

    const waves: Wave[] = [
      // Main massive waves (closest to viewer)
      { amplitude: 80, wavelength: 400, speed: 0.8, phase: 0, y: 0.35 },
      { amplitude: 60, wavelength: 300, speed: 1.0, phase: 2, y: 0.4 },
      { amplitude: 50, wavelength: 250, speed: 1.2, phase: 4, y: 0.45 },
      // Mid waves
      { amplitude: 40, wavelength: 350, speed: 0.6, phase: 1, y: 0.5 },
      { amplitude: 35, wavelength: 280, speed: 0.9, phase: 3, y: 0.55 },
      // Background waves
      { amplitude: 25, wavelength: 400, speed: 0.4, phase: 0.5, y: 0.6 },
      { amplitude: 20, wavelength: 320, speed: 0.5, phase: 2.5, y: 0.65 },
    ];

    // Foam/spray particles
    interface Spray {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      size: number;
    }
    const sprays: Spray[] = [];

    const addSpray = (x: number, y: number, intensity: number) => {
      for (let i = 0; i < intensity; i++) {
        sprays.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 8,
          vy: -Math.random() * 12 - 5,
          life: 1,
          maxLife: Math.random() * 40 + 20,
          size: Math.random() * 4 + 2,
        });
      }
    };

    const draw = () => {
      time += 0.025;
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Dark stormy sky gradient
      const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.5);
      skyGradient.addColorStop(0, '#0a0e14');
      skyGradient.addColorStop(0.5, '#0d1520');
      skyGradient.addColorStop(1, '#0f1a28');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, width, height);

      // Deep ocean base
      const oceanGradient = ctx.createLinearGradient(0, height * 0.3, 0, height);
      oceanGradient.addColorStop(0, '#0a2540');
      oceanGradient.addColorStop(0.3, '#061a30');
      oceanGradient.addColorStop(0.6, '#041222');
      oceanGradient.addColorStop(1, '#020a14');
      ctx.fillStyle = oceanGradient;
      ctx.fillRect(0, height * 0.3, width, height * 0.7);

      // Draw waves from back to front
      waves.slice().reverse().forEach((wave, index) => {
        const baseY = height * wave.y;
        const layerIndex = waves.length - 1 - index;

        // Calculate wave path
        ctx.beginPath();
        ctx.moveTo(-50, height);

        let prevY = baseY;
        for (let x = -50; x <= width + 50; x += 5) {
          // Complex wave formula for turbulent effect
          const y = baseY +
            Math.sin((x / wave.wavelength) * Math.PI * 2 + time * wave.speed + wave.phase) * wave.amplitude +
            Math.sin((x / (wave.wavelength * 0.5)) * Math.PI * 2 + time * wave.speed * 1.5) * wave.amplitude * 0.3 +
            Math.sin((x / (wave.wavelength * 0.3)) * Math.PI * 2 + time * wave.speed * 2) * wave.amplitude * 0.15;

          ctx.lineTo(x, y);

          // Add spray at wave peaks (for front waves)
          if (layerIndex < 3 && Math.random() < 0.01 && y < prevY - 5) {
            addSpray(x, y, 3);
          }
          prevY = y;
        }

        ctx.lineTo(width + 50, height);
        ctx.closePath();

        // Wave color based on depth
        const darkness = layerIndex / waves.length;
        const r = Math.floor(10 + darkness * 20);
        const g = Math.floor(40 + darkness * 60);
        const b = Math.floor(80 + darkness * 100);

        // Gradient fill for each wave
        const waveGradient = ctx.createLinearGradient(0, baseY - wave.amplitude, 0, baseY + wave.amplitude * 2);
        waveGradient.addColorStop(0, `rgba(${r + 30}, ${g + 50}, ${b + 70}, 0.95)`);
        waveGradient.addColorStop(0.3, `rgba(${r + 15}, ${g + 30}, ${b + 50}, 0.9)`);
        waveGradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.95)`);
        waveGradient.addColorStop(1, `rgba(${r - 5}, ${g - 10}, ${b - 10}, 1)`);

        ctx.fillStyle = waveGradient;
        ctx.fill();

        // Wave crest highlight (foam line)
        if (layerIndex < 4) {
          ctx.beginPath();
          for (let x = -50; x <= width + 50; x += 5) {
            const y = baseY +
              Math.sin((x / wave.wavelength) * Math.PI * 2 + time * wave.speed + wave.phase) * wave.amplitude +
              Math.sin((x / (wave.wavelength * 0.5)) * Math.PI * 2 + time * wave.speed * 1.5) * wave.amplitude * 0.3 +
              Math.sin((x / (wave.wavelength * 0.3)) * Math.PI * 2 + time * wave.speed * 2) * wave.amplitude * 0.15;

            if (x === -50) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }

          const foamOpacity = 0.4 - layerIndex * 0.08;
          ctx.strokeStyle = `rgba(200, 230, 255, ${foamOpacity})`;
          ctx.lineWidth = 3 - layerIndex * 0.5;
          ctx.stroke();

          // Extra foam effect on wave crests
          ctx.strokeStyle = `rgba(255, 255, 255, ${foamOpacity * 0.5})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      // Draw and update spray particles
      sprays.forEach((spray, i) => {
        spray.x += spray.vx;
        spray.y += spray.vy;
        spray.vy += 0.4; // gravity
        spray.life -= 1 / spray.maxLife;

        if (spray.life > 0) {
          ctx.beginPath();
          ctx.arc(spray.x, spray.y, spray.size * spray.life, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(200, 230, 255, ${spray.life * 0.6})`;
          ctx.fill();
        }
      });

      // Remove dead sprays
      for (let i = sprays.length - 1; i >= 0; i--) {
        if (sprays[i].life <= 0) {
          sprays.splice(i, 1);
        }
      }

      // Dramatic foam overlay at the "splash zone"
      const splashY = height * 0.32;
      for (let i = 0; i < 15; i++) {
        const foamX = (Math.sin(time * 0.5 + i * 0.8) * 0.5 + 0.5) * width;
        const foamY = splashY + Math.sin(time * 1.2 + i) * 30;
        const foamSize = 20 + Math.sin(time + i) * 10;

        ctx.beginPath();
        ctx.arc(foamX, foamY, foamSize, 0, Math.PI * 2);
        const foamGradient = ctx.createRadialGradient(foamX, foamY, 0, foamX, foamY, foamSize);
        foamGradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        foamGradient.addColorStop(0.5, 'rgba(200, 230, 255, 0.08)');
        foamGradient.addColorStop(1, 'rgba(200, 230, 255, 0)');
        ctx.fillStyle = foamGradient;
        ctx.fill();
      }

      // Mist/spray atmosphere at top
      const mistGradient = ctx.createLinearGradient(0, 0, 0, height * 0.4);
      mistGradient.addColorStop(0, 'rgba(150, 180, 200, 0.03)');
      mistGradient.addColorStop(0.5, 'rgba(150, 180, 200, 0.06)');
      mistGradient.addColorStop(1, 'rgba(150, 180, 200, 0)');
      ctx.fillStyle = mistGradient;
      ctx.fillRect(0, 0, width, height * 0.4);

      // Vignette effect for drama
      const vignetteGradient = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) * 0.8
      );
      vignetteGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignetteGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.1)');
      vignetteGradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
      ctx.fillStyle = vignetteGradient;
      ctx.fillRect(0, 0, width, height);

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
