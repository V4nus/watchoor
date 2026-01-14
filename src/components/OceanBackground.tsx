'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function OceanBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Scene setup
    const scene = new THREE.Scene();

    // Sky gradient background
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#87CEEB');    // Light sky blue
    gradient.addColorStop(0.3, '#B0E0E6'); // Powder blue
    gradient.addColorStop(0.5, '#E0F4FF'); // Very light blue near horizon
    gradient.addColorStop(0.52, '#4A90A4'); // Ocean horizon
    gradient.addColorStop(1, '#1a5c6e');    // Deep ocean
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 512);

    const skyTexture = new THREE.CanvasTexture(canvas);
    scene.background = skyTexture;

    // Camera - eye level at the ocean surface
    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      3000
    );
    camera.position.set(0, 3, 30);
    camera.lookAt(0, 2, -50);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Realistic ocean shader
    const oceanMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWaveHeight: { value: 2.5 },
        uWaveFrequency: { value: 0.15 },
        uWaveSpeed: { value: 1.2 },
        // Realistic ocean colors
        uDeepColor: { value: new THREE.Color(0x0a4d5c) },      // Deep teal
        uShallowColor: { value: new THREE.Color(0x1a8fa8) },   // Turquoise
        uSurfaceColor: { value: new THREE.Color(0x3dbbd4) },   // Light cyan
        uFoamColor: { value: new THREE.Color(0xffffff) },       // White foam
        uSkyColor: { value: new THREE.Color(0xc5e8f7) },        // Sky reflection
        uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
        uSunColor: { value: new THREE.Color(0xfffaf0) },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uWaveHeight;
        uniform float uWaveFrequency;
        uniform float uWaveSpeed;

        varying float vElevation;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;

        // Improved noise functions for realistic waves
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

          vec3 i  = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);

          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);

          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;

          i = mod289(i);
          vec4 p = permute(permute(permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0))
                  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                  + i.x + vec4(0.0, i1.x, i2.x, 1.0));

          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;

          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);

          vec4 x = x_ * ns.x + ns.yyyy;
          vec4 y = y_ * ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);

          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);

          vec4 s0 = floor(b0) * 2.0 + 1.0;
          vec4 s1 = floor(b1) * 2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));

          vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);

          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;

          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        float getWaveHeight(vec3 pos, float time) {
          float height = 0.0;

          // Large rolling waves
          height += sin(pos.x * 0.02 + time * 0.5) * 3.0;
          height += sin(pos.z * 0.03 + time * 0.4) * 2.0;
          height += sin((pos.x + pos.z) * 0.025 + time * 0.6) * 2.5;

          // Medium waves
          height += snoise(vec3(pos.x * 0.05, pos.z * 0.05, time * 0.3)) * 1.5;
          height += snoise(vec3(pos.x * 0.08, pos.z * 0.06, time * 0.4)) * 1.0;

          // Small detail waves (chop)
          height += snoise(vec3(pos.x * 0.15, pos.z * 0.15, time * 0.8)) * 0.4;
          height += snoise(vec3(pos.x * 0.3, pos.z * 0.25, time * 1.2)) * 0.2;

          // Curling wave effect near camera
          float curl = smoothstep(20.0, 50.0, pos.z) * smoothstep(80.0, 50.0, pos.z);
          height += curl * sin(pos.x * 0.1 + time * 2.0) * 4.0;

          return height;
        }

        void main() {
          vec3 pos = position;
          float time = uTime * uWaveSpeed;

          // Calculate wave height
          float elevation = getWaveHeight(pos, time);
          pos.y += elevation * uWaveHeight * 0.3;

          // Calculate normal for lighting
          float delta = 0.1;
          float hL = getWaveHeight(vec3(pos.x - delta, 0.0, pos.z), time);
          float hR = getWaveHeight(vec3(pos.x + delta, 0.0, pos.z), time);
          float hD = getWaveHeight(vec3(pos.x, 0.0, pos.z - delta), time);
          float hU = getWaveHeight(vec3(pos.x, 0.0, pos.z + delta), time);

          vec3 calcNormal = normalize(vec3(hL - hR, 2.0 * delta, hD - hU));

          vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
          vec4 viewPosition = viewMatrix * modelPosition;
          vec4 projectedPosition = projectionMatrix * viewPosition;

          gl_Position = projectedPosition;

          vElevation = elevation;
          vWorldPosition = modelPosition.xyz;
          vNormal = normalize(normalMatrix * calcNormal);
          vUv = uv;
        }
      `,
      fragmentShader: `
        uniform vec3 uDeepColor;
        uniform vec3 uShallowColor;
        uniform vec3 uSurfaceColor;
        uniform vec3 uFoamColor;
        uniform vec3 uSkyColor;
        uniform vec3 uSunDirection;
        uniform vec3 uSunColor;
        uniform float uTime;

        varying float vElevation;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;

        void main() {
          // View direction for fresnel
          vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

          // Fresnel effect - more reflection at grazing angles
          float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 3.0);
          fresnel = clamp(fresnel, 0.0, 1.0);

          // Base water color based on depth/elevation
          float depthFactor = smoothstep(-3.0, 3.0, vElevation);
          vec3 waterColor = mix(uDeepColor, uShallowColor, depthFactor);
          waterColor = mix(waterColor, uSurfaceColor, smoothstep(1.0, 3.0, vElevation));

          // Sky reflection
          vec3 reflectedColor = mix(waterColor, uSkyColor, fresnel * 0.6);

          // Sun specular highlight
          vec3 halfVector = normalize(uSunDirection + viewDirection);
          float specular = pow(max(dot(vNormal, halfVector), 0.0), 256.0);
          specular += pow(max(dot(vNormal, halfVector), 0.0), 32.0) * 0.5;
          vec3 sunHighlight = uSunColor * specular * 2.0;

          // Foam on wave crests
          float foam = smoothstep(2.0, 4.0, vElevation);
          foam += smoothstep(1.5, 2.5, vElevation) * 0.3;

          // Add foam noise pattern
          float foamNoise = fract(sin(dot(vWorldPosition.xz * 0.5, vec2(12.9898, 78.233))) * 43758.5453);
          foam *= (0.7 + foamNoise * 0.3);
          foam = clamp(foam, 0.0, 1.0);

          // Subsurface scattering effect
          float sss = pow(max(dot(viewDirection, -uSunDirection), 0.0), 4.0);
          vec3 sssColor = uShallowColor * sss * 0.4;

          // Combine all effects
          vec3 finalColor = reflectedColor;
          finalColor += sunHighlight;
          finalColor += sssColor;
          finalColor = mix(finalColor, uFoamColor, foam * 0.8);

          // Distance fog for depth
          float dist = length(vWorldPosition - cameraPosition);
          float fogFactor = 1.0 - exp(-dist * 0.003);
          vec3 fogColor = mix(uSkyColor, uDeepColor, 0.3);
          finalColor = mix(finalColor, fogColor, fogFactor * 0.5);

          // Subtle color variation
          finalColor += vec3(0.02, 0.04, 0.06) * (1.0 - fresnel);

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      side: THREE.DoubleSide,
    });

    // Create ocean mesh - larger and more detailed
    const oceanGeometry = new THREE.PlaneGeometry(600, 600, 512, 512);
    oceanGeometry.rotateX(-Math.PI / 2);
    const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
    ocean.position.y = 0;
    scene.add(ocean);

    // Spray particles for realism
    const sprayCount = 3000;
    const sprayGeometry = new THREE.BufferGeometry();
    const sprayPositions = new Float32Array(sprayCount * 3);
    const spraySizes = new Float32Array(sprayCount);
    const sprayVelocities: { x: number; y: number; z: number; life: number }[] = [];

    for (let i = 0; i < sprayCount; i++) {
      sprayPositions[i * 3] = (Math.random() - 0.5) * 200;
      sprayPositions[i * 3 + 1] = Math.random() * 15 + 5;
      sprayPositions[i * 3 + 2] = Math.random() * 100 - 50;
      spraySizes[i] = Math.random() * 3 + 1;
      sprayVelocities.push({
        x: (Math.random() - 0.5) * 0.3,
        y: Math.random() * 0.2 + 0.1,
        z: (Math.random() - 0.5) * 0.2,
        life: Math.random(),
      });
    }

    sprayGeometry.setAttribute('position', new THREE.BufferAttribute(sprayPositions, 3));
    sprayGeometry.setAttribute('size', new THREE.BufferAttribute(spraySizes, 1));

    const sprayMaterial = new THREE.PointsMaterial({
      size: 0.8,
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const spray = new THREE.Points(sprayGeometry, sprayMaterial);
    scene.add(spray);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x88bbdd, 0.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaf0, 1.5);
    sunLight.position.set(50, 80, 30);
    scene.add(sunLight);

    // Hemisphere light for natural sky/ground lighting
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x1a5c6e, 0.4);
    scene.add(hemiLight);

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation
    const clock = new THREE.Clock();
    let animationFrame: number;

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      // Update ocean shader time
      oceanMaterial.uniforms.uTime.value = elapsedTime;

      // Animate spray particles
      const sprayPos = spray.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < sprayCount; i++) {
        const vel = sprayVelocities[i];

        sprayPos[i * 3] += vel.x;
        sprayPos[i * 3 + 1] += vel.y;
        sprayPos[i * 3 + 2] += vel.z;

        vel.y -= 0.015; // Gravity
        vel.life -= 0.008;

        // Reset particle
        if (vel.life <= 0 || sprayPos[i * 3 + 1] < 0) {
          sprayPos[i * 3] = (Math.random() - 0.5) * 200;
          sprayPos[i * 3 + 1] = Math.random() * 5 + 8;
          sprayPos[i * 3 + 2] = Math.random() * 60 - 30;
          vel.x = (Math.random() - 0.5) * 0.4;
          vel.y = Math.random() * 0.3 + 0.2;
          vel.z = (Math.random() - 0.5) * 0.3;
          vel.life = Math.random() * 0.5 + 0.5;
        }
      }
      spray.geometry.attributes.position.needsUpdate = true;

      // Subtle camera bob (like floating on water)
      camera.position.y = 3 + Math.sin(elapsedTime * 0.5) * 0.5 + Math.sin(elapsedTime * 0.8) * 0.3;
      camera.position.x = Math.sin(elapsedTime * 0.2) * 2;
      camera.rotation.z = Math.sin(elapsedTime * 0.3) * 0.02;

      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrame);
      renderer.dispose();
      oceanGeometry.dispose();
      oceanMaterial.dispose();
      sprayGeometry.dispose();
      sprayMaterial.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full"
    />
  );
}
