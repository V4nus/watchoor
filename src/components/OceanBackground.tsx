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

    // Create HDR-like environment map for realistic reflections
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256);
    cubeRenderTarget.texture.type = THREE.HalfFloatType;

    // Sky dome with realistic gradient
    const skyGeometry = new THREE.SphereGeometry(1000, 32, 32);
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uSunPosition: { value: new THREE.Vector3(100, 50, -200) },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uSunPosition;
        varying vec3 vWorldPosition;

        void main() {
          vec3 direction = normalize(vWorldPosition);
          float y = direction.y;

          // Sky gradient
          vec3 skyHigh = vec3(0.4, 0.65, 0.9);      // Deep blue
          vec3 skyLow = vec3(0.7, 0.85, 0.95);       // Light blue near horizon
          vec3 horizonColor = vec3(0.85, 0.92, 0.98); // Almost white at horizon

          vec3 skyColor;
          if (y > 0.0) {
            float t = pow(y, 0.4);
            skyColor = mix(horizonColor, mix(skyLow, skyHigh, t), t);
          } else {
            // Below horizon - ocean color
            skyColor = vec3(0.05, 0.15, 0.25);
          }

          // Sun glow
          vec3 sunDir = normalize(uSunPosition);
          float sunAngle = max(dot(direction, sunDir), 0.0);
          float sunGlow = pow(sunAngle, 64.0) * 1.5;
          float sunHalo = pow(sunAngle, 8.0) * 0.3;

          vec3 sunColor = vec3(1.0, 0.95, 0.8);
          skyColor += sunColor * (sunGlow + sunHalo);

          gl_FragColor = vec4(skyColor, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);

    // Camera setup - positioned above water looking at waves
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    camera.position.set(0, 8, 40);
    camera.lookAt(0, 0, -20);

    // Renderer with realistic settings
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // Gerstner waves ocean shader - industry standard for realistic ocean
    const oceanMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSunPosition: { value: new THREE.Vector3(100, 50, -200) },
        uSunColor: { value: new THREE.Color(1.0, 0.95, 0.8) },
        uOceanColorDeep: { value: new THREE.Color(0x004455) },
        uOceanColorShallow: { value: new THREE.Color(0x0099aa) },
        uFoamColor: { value: new THREE.Color(0xffffff) },
        uSkyColor: { value: new THREE.Color(0x88bbcc) },
      },
      vertexShader: `
        uniform float uTime;

        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying float vFoam;
        varying vec3 vViewPosition;

        // Gerstner wave function - physically accurate ocean waves
        vec3 gerstnerWave(vec2 coord, float steepness, float wavelength, vec2 direction, float time) {
          float k = 2.0 * 3.14159 / wavelength;
          float c = sqrt(9.8 / k); // Phase speed based on physics
          float a = steepness / k;
          vec2 d = normalize(direction);
          float f = k * (dot(d, coord) - c * time);

          return vec3(
            d.x * a * cos(f),
            a * sin(f),
            d.y * a * cos(f)
          );
        }

        void main() {
          vec3 pos = position;
          float t = uTime * 0.8;

          // Multiple Gerstner waves for complex, realistic motion
          // Large swells
          vec3 wave1 = gerstnerWave(pos.xz, 0.25, 60.0, vec2(1.0, 0.3), t);
          vec3 wave2 = gerstnerWave(pos.xz, 0.2, 45.0, vec2(0.8, 0.6), t * 1.1);
          vec3 wave3 = gerstnerWave(pos.xz, 0.15, 35.0, vec2(0.3, 1.0), t * 0.9);

          // Medium waves
          vec3 wave4 = gerstnerWave(pos.xz, 0.12, 20.0, vec2(-0.5, 0.7), t * 1.3);
          vec3 wave5 = gerstnerWave(pos.xz, 0.1, 15.0, vec2(0.6, -0.4), t * 1.5);

          // Small chop
          vec3 wave6 = gerstnerWave(pos.xz, 0.06, 8.0, vec2(1.0, 0.0), t * 2.0);
          vec3 wave7 = gerstnerWave(pos.xz, 0.04, 5.0, vec2(0.0, 1.0), t * 2.2);
          vec3 wave8 = gerstnerWave(pos.xz, 0.03, 3.0, vec2(0.7, 0.7), t * 2.5);

          vec3 totalWave = wave1 + wave2 + wave3 + wave4 + wave5 + wave6 + wave7 + wave8;
          pos += totalWave;

          // Calculate foam based on wave steepness
          float waveHeight = totalWave.y;
          vFoam = smoothstep(1.5, 3.5, waveHeight);

          // Calculate normal from wave derivatives
          float delta = 0.5;
          vec3 posL = position + vec3(-delta, 0.0, 0.0);
          vec3 posR = position + vec3(delta, 0.0, 0.0);
          vec3 posD = position + vec3(0.0, 0.0, -delta);
          vec3 posU = position + vec3(0.0, 0.0, delta);

          vec3 waveL = gerstnerWave(posL.xz, 0.25, 60.0, vec2(1.0, 0.3), t) +
                       gerstnerWave(posL.xz, 0.2, 45.0, vec2(0.8, 0.6), t * 1.1) +
                       gerstnerWave(posL.xz, 0.15, 35.0, vec2(0.3, 1.0), t * 0.9);
          vec3 waveR = gerstnerWave(posR.xz, 0.25, 60.0, vec2(1.0, 0.3), t) +
                       gerstnerWave(posR.xz, 0.2, 45.0, vec2(0.8, 0.6), t * 1.1) +
                       gerstnerWave(posR.xz, 0.15, 35.0, vec2(0.3, 1.0), t * 0.9);
          vec3 waveD = gerstnerWave(posD.xz, 0.25, 60.0, vec2(1.0, 0.3), t) +
                       gerstnerWave(posD.xz, 0.2, 45.0, vec2(0.8, 0.6), t * 1.1) +
                       gerstnerWave(posD.xz, 0.15, 35.0, vec2(0.3, 1.0), t * 0.9);
          vec3 waveU = gerstnerWave(posU.xz, 0.25, 60.0, vec2(1.0, 0.3), t) +
                       gerstnerWave(posU.xz, 0.2, 45.0, vec2(0.8, 0.6), t * 1.1) +
                       gerstnerWave(posU.xz, 0.15, 35.0, vec2(0.3, 1.0), t * 0.9);

          vec3 tangent = normalize(vec3(2.0 * delta, waveR.y - waveL.y, 0.0));
          vec3 bitangent = normalize(vec3(0.0, waveU.y - waveD.y, 2.0 * delta));
          vec3 normal = normalize(cross(bitangent, tangent));

          vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
          vec4 viewPosition = viewMatrix * worldPosition;

          vWorldPosition = worldPosition.xyz;
          vNormal = normalize(normalMatrix * normal);
          vViewPosition = viewPosition.xyz;

          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uSunPosition;
        uniform vec3 uSunColor;
        uniform vec3 uOceanColorDeep;
        uniform vec3 uOceanColorShallow;
        uniform vec3 uFoamColor;
        uniform vec3 uSkyColor;

        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying float vFoam;
        varying vec3 vViewPosition;

        // Fresnel equation for realistic reflections
        float fresnel(vec3 viewDir, vec3 normal, float ior) {
          float cosTheta = clamp(dot(viewDir, normal), 0.0, 1.0);
          float r0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
          return r0 + (1.0 - r0) * pow(1.0 - cosTheta, 5.0);
        }

        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          vec3 normal = normalize(vNormal);
          vec3 sunDir = normalize(uSunPosition);

          // Fresnel reflection (water IOR ≈ 1.33)
          float fresnelFactor = fresnel(viewDir, normal, 1.33);
          fresnelFactor = clamp(fresnelFactor, 0.02, 0.98);

          // Base water color with depth variation
          float depth = smoothstep(-5.0, 5.0, vWorldPosition.y);
          vec3 waterColor = mix(uOceanColorDeep, uOceanColorShallow, depth);

          // Sky reflection
          vec3 reflectDir = reflect(-viewDir, normal);
          float skyGradient = smoothstep(-0.2, 0.5, reflectDir.y);
          vec3 reflectedSky = mix(vec3(0.7, 0.85, 0.95), uSkyColor, skyGradient);

          // Sun reflection (specular)
          vec3 halfVector = normalize(sunDir + viewDir);
          float specular = pow(max(dot(normal, halfVector), 0.0), 512.0);
          specular += pow(max(dot(normal, halfVector), 0.0), 128.0) * 0.5;
          specular += pow(max(dot(normal, halfVector), 0.0), 32.0) * 0.25;
          vec3 sunReflection = uSunColor * specular * 3.0;

          // Subsurface scattering - light through waves
          float sss = pow(max(dot(viewDir, -sunDir), 0.0), 3.0);
          float waveThickness = smoothstep(0.0, 2.0, vWorldPosition.y + 2.0);
          vec3 sssColor = vec3(0.1, 0.4, 0.35) * sss * waveThickness * 0.6;

          // Combine reflection and refraction
          vec3 oceanColor = mix(waterColor, reflectedSky, fresnelFactor);
          oceanColor += sunReflection;
          oceanColor += sssColor;

          // Add foam on wave crests
          float foam = vFoam;
          // Add noise to foam
          float foamNoise = fract(sin(dot(vWorldPosition.xz * 2.0 + uTime * 0.5, vec2(12.9898, 78.233))) * 43758.5453);
          foam *= smoothstep(0.3, 0.7, foamNoise);
          oceanColor = mix(oceanColor, uFoamColor * 0.95, foam * 0.85);

          // Atmospheric fog for distance
          float dist = length(vViewPosition);
          float fogFactor = 1.0 - exp(-dist * 0.002);
          vec3 fogColor = vec3(0.75, 0.85, 0.92);
          oceanColor = mix(oceanColor, fogColor, fogFactor * 0.4);

          // Tone adjustment for realism
          oceanColor = pow(oceanColor, vec3(0.95));

          gl_FragColor = vec4(oceanColor, 1.0);
        }
      `,
      side: THREE.FrontSide,
    });

    // Create high-resolution ocean mesh
    const oceanGeometry = new THREE.PlaneGeometry(800, 800, 256, 256);
    oceanGeometry.rotateX(-Math.PI / 2);
    const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
    ocean.position.y = 0;
    scene.add(ocean);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x446688, 0.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e0, 2.0);
    sunLight.position.set(100, 50, -200);
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x88bbdd, 0x004455, 0.5);
    scene.add(hemiLight);

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop
    const clock = new THREE.Clock();
    let animationFrame: number;

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      // Update shader time
      oceanMaterial.uniforms.uTime.value = elapsedTime;

      // Gentle camera movement - floating on the water
      camera.position.y = 8 + Math.sin(elapsedTime * 0.4) * 1.0 + Math.sin(elapsedTime * 0.7) * 0.5;
      camera.position.x = Math.sin(elapsedTime * 0.15) * 3;
      camera.rotation.z = Math.sin(elapsedTime * 0.25) * 0.015;
      camera.rotation.x = -0.15 + Math.sin(elapsedTime * 0.3) * 0.02;

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
      skyGeometry.dispose();
      skyMaterial.dispose();
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
