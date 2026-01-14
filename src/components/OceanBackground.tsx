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
    scene.fog = new THREE.FogExp2(0x0a1628, 0.002);

    // Camera - low angle looking up at waves
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    camera.position.set(0, 15, 60);
    camera.lookAt(0, 20, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0a1628, 1);
    container.appendChild(renderer.domElement);

    // Ocean geometry - large plane with many segments for wave detail
    const oceanGeometry = new THREE.PlaneGeometry(400, 400, 256, 256);
    oceanGeometry.rotateX(-Math.PI / 2);

    // Store original positions for wave animation
    const positions = oceanGeometry.attributes.position;
    const originalY = new Float32Array(positions.count);
    for (let i = 0; i < positions.count; i++) {
      originalY[i] = positions.getY(i);
    }

    // Ocean material with custom shader for realistic water
    const oceanMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBigWavesElevation: { value: 0.35 },
        uBigWavesFrequency: { value: new THREE.Vector2(2, 1.5) },
        uBigWavesSpeed: { value: 0.75 },
        uSmallWavesElevation: { value: 0.15 },
        uSmallWavesFrequency: { value: 3.0 },
        uSmallWavesSpeed: { value: 0.2 },
        uDepthColor: { value: new THREE.Color(0x061a30) },
        uSurfaceColor: { value: new THREE.Color(0x1e90ff) },
        uColorOffset: { value: 0.08 },
        uColorMultiplier: { value: 5.0 },
        uFoamColor: { value: new THREE.Color(0xffffff) },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uBigWavesElevation;
        uniform vec2 uBigWavesFrequency;
        uniform float uBigWavesSpeed;
        uniform float uSmallWavesElevation;
        uniform float uSmallWavesFrequency;
        uniform float uSmallWavesSpeed;

        varying float vElevation;
        varying vec3 vNormal;
        varying vec3 vPosition;

        // Simplex noise function
        vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
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
          i = mod(i, 289.0);
          vec4 p = permute(permute(permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0))
                  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                  + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 1.0/7.0;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
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

        void main() {
          vec4 modelPosition = modelMatrix * vec4(position, 1.0);

          // Big waves
          float elevation = sin(modelPosition.x * uBigWavesFrequency.x + uTime * uBigWavesSpeed) *
                           sin(modelPosition.z * uBigWavesFrequency.y + uTime * uBigWavesSpeed) *
                           uBigWavesElevation;

          // Small waves with noise
          for(float i = 1.0; i <= 4.0; i++) {
            elevation -= abs(snoise(vec3(
              modelPosition.xz * uSmallWavesFrequency * i,
              uTime * uSmallWavesSpeed
            )) * uSmallWavesElevation / i);
          }

          modelPosition.y += elevation;

          vec4 viewPosition = viewMatrix * modelPosition;
          vec4 projectedPosition = projectionMatrix * viewPosition;

          gl_Position = projectedPosition;

          vElevation = elevation;
          vNormal = normal;
          vPosition = modelPosition.xyz;
        }
      `,
      fragmentShader: `
        uniform vec3 uDepthColor;
        uniform vec3 uSurfaceColor;
        uniform vec3 uFoamColor;
        uniform float uColorOffset;
        uniform float uColorMultiplier;

        varying float vElevation;
        varying vec3 vNormal;
        varying vec3 vPosition;

        void main() {
          float mixStrength = (vElevation + uColorOffset) * uColorMultiplier;
          mixStrength = clamp(mixStrength, 0.0, 1.0);

          vec3 color = mix(uDepthColor, uSurfaceColor, mixStrength);

          // Add foam on wave peaks
          float foam = smoothstep(0.2, 0.4, vElevation);
          color = mix(color, uFoamColor, foam * 0.3);

          // Fresnel effect for edge glow
          vec3 viewDirection = normalize(cameraPosition - vPosition);
          float fresnel = pow(1.0 - dot(viewDirection, vec3(0.0, 1.0, 0.0)), 3.0);
          color = mix(color, uSurfaceColor * 1.5, fresnel * 0.3);

          gl_FragColor = vec4(color, 0.95);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
    ocean.position.y = -5;
    scene.add(ocean);

    // Add second layer of waves (closer, bigger)
    const frontWaveGeometry = new THREE.PlaneGeometry(300, 150, 200, 100);
    frontWaveGeometry.rotateX(-Math.PI / 2.5);

    const frontWaveMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBigWavesElevation: { value: 0.6 },
        uBigWavesFrequency: { value: new THREE.Vector2(1.5, 1.0) },
        uBigWavesSpeed: { value: 0.5 },
        uSmallWavesElevation: { value: 0.2 },
        uSmallWavesFrequency: { value: 2.0 },
        uSmallWavesSpeed: { value: 0.15 },
        uDepthColor: { value: new THREE.Color(0x0a2540) },
        uSurfaceColor: { value: new THREE.Color(0x4169e1) },
        uColorOffset: { value: 0.1 },
        uColorMultiplier: { value: 4.0 },
        uFoamColor: { value: new THREE.Color(0xffffff) },
      },
      vertexShader: oceanMaterial.vertexShader,
      fragmentShader: oceanMaterial.fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const frontWave = new THREE.Mesh(frontWaveGeometry, frontWaveMaterial);
    frontWave.position.set(0, 10, 30);
    scene.add(frontWave);

    // Spray particles
    const sprayCount = 2000;
    const sprayGeometry = new THREE.BufferGeometry();
    const sprayPositions = new Float32Array(sprayCount * 3);
    const spraySpeeds = new Float32Array(sprayCount);

    for (let i = 0; i < sprayCount; i++) {
      sprayPositions[i * 3] = (Math.random() - 0.5) * 200;
      sprayPositions[i * 3 + 1] = Math.random() * 40 + 10;
      sprayPositions[i * 3 + 2] = (Math.random() - 0.5) * 100 + 30;
      spraySpeeds[i] = Math.random() * 0.5 + 0.2;
    }

    sprayGeometry.setAttribute('position', new THREE.BufferAttribute(sprayPositions, 3));

    const sprayMaterial = new THREE.PointsMaterial({
      size: 0.5,
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });

    const spray = new THREE.Points(sprayGeometry, sprayMaterial);
    scene.add(spray);

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x4488ff, 0.4);
    scene.add(ambientLight);

    // Directional light (moonlight effect)
    const directionalLight = new THREE.DirectionalLight(0x88aaff, 0.8);
    directionalLight.position.set(-50, 100, 50);
    scene.add(directionalLight);

    // Point light for dramatic effect
    const pointLight = new THREE.PointLight(0x3fb950, 1, 100);
    pointLight.position.set(0, 30, 40);
    scene.add(pointLight);

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
      frontWaveMaterial.uniforms.uTime.value = elapsedTime;

      // Animate spray particles
      const sprayPos = spray.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < sprayCount; i++) {
        sprayPos[i * 3 + 1] -= spraySpeeds[i];
        sprayPos[i * 3] += Math.sin(elapsedTime + i) * 0.05;

        if (sprayPos[i * 3 + 1] < 0) {
          sprayPos[i * 3 + 1] = Math.random() * 30 + 20;
          sprayPos[i * 3] = (Math.random() - 0.5) * 200;
          sprayPos[i * 3 + 2] = (Math.random() - 0.5) * 100 + 30;
        }
      }
      spray.geometry.attributes.position.needsUpdate = true;

      // Subtle camera movement
      camera.position.x = Math.sin(elapsedTime * 0.1) * 5;
      camera.position.y = 15 + Math.sin(elapsedTime * 0.2) * 3;
      camera.lookAt(0, 15 + Math.sin(elapsedTime * 0.15) * 5, 0);

      // Animate point light
      pointLight.position.x = Math.sin(elapsedTime * 0.3) * 30;
      pointLight.intensity = 1 + Math.sin(elapsedTime) * 0.3;

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
      frontWaveGeometry.dispose();
      frontWaveMaterial.dispose();
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
      style={{ background: 'linear-gradient(to bottom, #0a1628 0%, #061422 100%)' }}
    />
  );
}
