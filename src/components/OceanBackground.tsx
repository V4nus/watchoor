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

    // Sky dome with photorealistic gradient
    const skyGeometry = new THREE.SphereGeometry(2000, 64, 64);
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uSunPosition: { value: new THREE.Vector3(0.3, 0.15, -1.0).normalize() },
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

        vec3 getSkyColor(vec3 direction, vec3 sunDir) {
          float y = direction.y;

          // Rayleigh scattering approximation
          vec3 skyColorZenith = vec3(0.25, 0.55, 0.92);
          vec3 skyColorHorizon = vec3(0.7, 0.82, 0.92);
          vec3 groundColor = vec3(0.02, 0.08, 0.15);

          vec3 skyColor;
          if (y > 0.0) {
            float t = pow(max(y, 0.0), 0.5);
            skyColor = mix(skyColorHorizon, skyColorZenith, t);

            // Atmospheric haze near horizon
            float haze = exp(-y * 4.0) * 0.3;
            skyColor = mix(skyColor, vec3(0.85, 0.9, 0.95), haze);
          } else {
            skyColor = groundColor;
          }

          // Sun disc and glow
          float sunAngle = max(dot(direction, sunDir), 0.0);
          float sunDisc = smoothstep(0.9995, 0.9999, sunAngle);
          float sunGlow = pow(sunAngle, 8.0) * 0.4;
          float sunHalo = pow(sunAngle, 2.0) * 0.15;

          vec3 sunColor = vec3(1.0, 0.98, 0.92);
          skyColor += sunColor * (sunDisc * 2.0 + sunGlow + sunHalo);

          return skyColor;
        }

        void main() {
          vec3 direction = normalize(vWorldPosition);
          vec3 sunDir = normalize(uSunPosition);
          vec3 color = getSkyColor(direction, sunDir);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);

    // Camera - cinematic ocean view
    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      5000
    );
    camera.position.set(0, 6, 25);
    camera.lookAt(0, 1, -50);

    // High-quality renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // Generate procedural normal map for micro-detail
    const normalMapSize = 1024;
    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = normalMapSize;
    normalCanvas.height = normalMapSize;
    const normalCtx = normalCanvas.getContext('2d')!;
    const normalImageData = normalCtx.createImageData(normalMapSize, normalMapSize);

    // Perlin-like noise for normal map
    const noise = (x: number, y: number, seed: number) => {
      const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
      return n - Math.floor(n);
    };

    const smoothNoise = (x: number, y: number, scale: number, seed: number) => {
      const i = Math.floor(x * scale);
      const j = Math.floor(y * scale);
      const fx = x * scale - i;
      const fy = y * scale - j;

      const a = noise(i, j, seed);
      const b = noise(i + 1, j, seed);
      const c = noise(i, j + 1, seed);
      const d = noise(i + 1, j + 1, seed);

      const ux = fx * fx * (3 - 2 * fx);
      const uy = fy * fy * (3 - 2 * fy);

      return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
    };

    for (let y = 0; y < normalMapSize; y++) {
      for (let x = 0; x < normalMapSize; x++) {
        const u = x / normalMapSize;
        const v = y / normalMapSize;

        // Multi-octave noise
        let height = 0;
        height += smoothNoise(u, v, 8, 0) * 0.5;
        height += smoothNoise(u, v, 16, 1) * 0.25;
        height += smoothNoise(u, v, 32, 2) * 0.125;
        height += smoothNoise(u, v, 64, 3) * 0.0625;

        // Calculate normal from height differences
        const delta = 1 / normalMapSize;
        const hL = smoothNoise(u - delta, v, 8, 0) * 0.5 + smoothNoise(u - delta, v, 16, 1) * 0.25;
        const hR = smoothNoise(u + delta, v, 8, 0) * 0.5 + smoothNoise(u + delta, v, 16, 1) * 0.25;
        const hD = smoothNoise(u, v - delta, 8, 0) * 0.5 + smoothNoise(u, v - delta, 16, 1) * 0.25;
        const hU = smoothNoise(u, v + delta, 8, 0) * 0.5 + smoothNoise(u, v + delta, 16, 1) * 0.25;

        const nx = (hL - hR) * 2;
        const ny = (hD - hU) * 2;
        const nz = 1;

        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

        const idx = (y * normalMapSize + x) * 4;
        normalImageData.data[idx] = ((nx / len) * 0.5 + 0.5) * 255;
        normalImageData.data[idx + 1] = ((ny / len) * 0.5 + 0.5) * 255;
        normalImageData.data[idx + 2] = ((nz / len) * 0.5 + 0.5) * 255;
        normalImageData.data[idx + 3] = 255;
      }
    }
    normalCtx.putImageData(normalImageData, 0, 0);

    const normalTexture = new THREE.CanvasTexture(normalCanvas);
    normalTexture.wrapS = THREE.RepeatWrapping;
    normalTexture.wrapT = THREE.RepeatWrapping;
    normalTexture.repeat.set(20, 20);

    // Generate foam texture
    const foamSize = 512;
    const foamCanvas = document.createElement('canvas');
    foamCanvas.width = foamSize;
    foamCanvas.height = foamSize;
    const foamCtx = foamCanvas.getContext('2d')!;
    const foamImageData = foamCtx.createImageData(foamSize, foamSize);

    for (let y = 0; y < foamSize; y++) {
      for (let x = 0; x < foamSize; x++) {
        const u = x / foamSize;
        const v = y / foamSize;

        let foam = 0;
        foam += smoothNoise(u, v, 12, 10) * 0.4;
        foam += smoothNoise(u, v, 24, 11) * 0.3;
        foam += smoothNoise(u, v, 48, 12) * 0.2;
        foam += smoothNoise(u, v, 96, 13) * 0.1;

        foam = Math.pow(foam, 1.5);
        foam = foam > 0.35 ? 1.0 : 0.0;

        const idx = (y * foamSize + x) * 4;
        foamImageData.data[idx] = foam * 255;
        foamImageData.data[idx + 1] = foam * 255;
        foamImageData.data[idx + 2] = foam * 255;
        foamImageData.data[idx + 3] = 255;
      }
    }
    foamCtx.putImageData(foamImageData, 0, 0);

    const foamTexture = new THREE.CanvasTexture(foamCanvas);
    foamTexture.wrapS = THREE.RepeatWrapping;
    foamTexture.wrapT = THREE.RepeatWrapping;
    foamTexture.repeat.set(30, 30);

    // Ultra-realistic ocean shader
    const oceanMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uNormalMap: { value: normalTexture },
        uFoamTexture: { value: foamTexture },
        uSunPosition: { value: new THREE.Vector3(0.3, 0.15, -1.0).normalize() },
        uSunColor: { value: new THREE.Color(1.0, 0.98, 0.92) },
        uOceanColorDeep: { value: new THREE.Color(0x001520) },
        uOceanColorMid: { value: new THREE.Color(0x004858) },
        uOceanColorShallow: { value: new THREE.Color(0x007088) },
        uSkyColor: { value: new THREE.Color(0x87CEEB) },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      },
      vertexShader: `
        uniform float uTime;

        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying float vWaveHeight;
        varying vec3 vTangent;
        varying vec3 vBitangent;

        #define PI 3.14159265359

        // Gerstner wave with improved parameters
        vec3 gerstnerWave(vec2 coord, float steepness, float wavelength, vec2 direction, float time, out vec3 tangent, out vec3 binormal) {
          float k = 2.0 * PI / wavelength;
          float c = sqrt(9.81 / k);
          float a = steepness / k;
          vec2 d = normalize(direction);
          float f = k * (dot(d, coord) - c * time);
          float cosF = cos(f);
          float sinF = sin(f);

          tangent = vec3(
            1.0 - d.x * d.x * steepness * sinF,
            d.x * steepness * cosF,
            -d.x * d.y * steepness * sinF
          );

          binormal = vec3(
            -d.x * d.y * steepness * sinF,
            d.y * steepness * cosF,
            1.0 - d.y * d.y * steepness * sinF
          );

          return vec3(
            d.x * a * cosF,
            a * sinF,
            d.y * a * cosF
          );
        }

        void main() {
          vUv = uv * 40.0;
          vec3 pos = position;
          float t = uTime * 0.6;

          vec3 tangent = vec3(1.0, 0.0, 0.0);
          vec3 binormal = vec3(0.0, 0.0, 1.0);
          vec3 tempTangent, tempBinormal;

          // Large ocean swells - slow and powerful
          vec3 wave1 = gerstnerWave(pos.xz, 0.15, 120.0, vec2(1.0, 0.2), t * 0.7, tempTangent, tempBinormal);
          tangent += tempTangent - vec3(1,0,0); binormal += tempBinormal - vec3(0,0,1);

          vec3 wave2 = gerstnerWave(pos.xz, 0.12, 90.0, vec2(0.85, 0.52), t * 0.8, tempTangent, tempBinormal);
          tangent += tempTangent - vec3(1,0,0); binormal += tempBinormal - vec3(0,0,1);

          vec3 wave3 = gerstnerWave(pos.xz, 0.1, 70.0, vec2(0.5, 0.87), t * 0.75, tempTangent, tempBinormal);
          tangent += tempTangent - vec3(1,0,0); binormal += tempBinormal - vec3(0,0,1);

          // Medium waves
          vec3 wave4 = gerstnerWave(pos.xz, 0.08, 40.0, vec2(-0.4, 0.9), t * 1.0, tempTangent, tempBinormal);
          tangent += tempTangent - vec3(1,0,0); binormal += tempBinormal - vec3(0,0,1);

          vec3 wave5 = gerstnerWave(pos.xz, 0.07, 30.0, vec2(0.7, -0.3), t * 1.1, tempTangent, tempBinormal);
          tangent += tempTangent - vec3(1,0,0); binormal += tempBinormal - vec3(0,0,1);

          vec3 wave6 = gerstnerWave(pos.xz, 0.06, 22.0, vec2(-0.6, -0.5), t * 1.2, tempTangent, tempBinormal);
          tangent += tempTangent - vec3(1,0,0); binormal += tempBinormal - vec3(0,0,1);

          // Small waves and chop
          vec3 wave7 = gerstnerWave(pos.xz, 0.04, 12.0, vec2(1.0, 0.1), t * 1.5, tempTangent, tempBinormal);
          tangent += tempTangent - vec3(1,0,0); binormal += tempBinormal - vec3(0,0,1);

          vec3 wave8 = gerstnerWave(pos.xz, 0.035, 8.0, vec2(0.1, 1.0), t * 1.6, tempTangent, tempBinormal);
          tangent += tempTangent - vec3(1,0,0); binormal += tempBinormal - vec3(0,0,1);

          vec3 wave9 = gerstnerWave(pos.xz, 0.025, 5.0, vec2(0.7, 0.7), t * 2.0, tempTangent, tempBinormal);
          tangent += tempTangent - vec3(1,0,0); binormal += tempBinormal - vec3(0,0,1);

          vec3 wave10 = gerstnerWave(pos.xz, 0.02, 3.5, vec2(-0.7, 0.7), t * 2.2, tempTangent, tempBinormal);
          tangent += tempTangent - vec3(1,0,0); binormal += tempBinormal - vec3(0,0,1);

          vec3 wave11 = gerstnerWave(pos.xz, 0.015, 2.5, vec2(0.9, -0.4), t * 2.5, tempTangent, tempBinormal);
          tangent += tempTangent - vec3(1,0,0); binormal += tempBinormal - vec3(0,0,1);

          vec3 wave12 = gerstnerWave(pos.xz, 0.01, 1.8, vec2(-0.3, 0.95), t * 2.8, tempTangent, tempBinormal);
          tangent += tempTangent - vec3(1,0,0); binormal += tempBinormal - vec3(0,0,1);

          vec3 totalWave = wave1 + wave2 + wave3 + wave4 + wave5 + wave6 +
                           wave7 + wave8 + wave9 + wave10 + wave11 + wave12;

          pos += totalWave;
          vWaveHeight = totalWave.y;

          vec3 normal = normalize(cross(binormal, tangent));

          vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
          vWorldPosition = worldPosition.xyz;
          vNormal = normalize(normalMatrix * normal);
          vTangent = normalize(normalMatrix * tangent);
          vBitangent = normalize(normalMatrix * binormal);

          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform sampler2D uNormalMap;
        uniform sampler2D uFoamTexture;
        uniform vec3 uSunPosition;
        uniform vec3 uSunColor;
        uniform vec3 uOceanColorDeep;
        uniform vec3 uOceanColorMid;
        uniform vec3 uOceanColorShallow;
        uniform vec3 uSkyColor;
        uniform vec2 uResolution;

        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying float vWaveHeight;
        varying vec3 vTangent;
        varying vec3 vBitangent;

        #define PI 3.14159265359

        // Schlick Fresnel approximation
        float fresnelSchlick(float cosTheta, float F0) {
          return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
        }

        // GGX/Trowbridge-Reitz distribution
        float distributionGGX(vec3 N, vec3 H, float roughness) {
          float a = roughness * roughness;
          float a2 = a * a;
          float NdotH = max(dot(N, H), 0.0);
          float NdotH2 = NdotH * NdotH;
          float nom = a2;
          float denom = (NdotH2 * (a2 - 1.0) + 1.0);
          denom = PI * denom * denom;
          return nom / denom;
        }

        vec3 getSkyReflection(vec3 reflectDir) {
          float y = reflectDir.y;
          vec3 skyZenith = vec3(0.25, 0.55, 0.92);
          vec3 skyHorizon = vec3(0.7, 0.82, 0.92);
          vec3 horizonHaze = vec3(0.85, 0.9, 0.95);

          if (y > 0.0) {
            float t = pow(y, 0.5);
            vec3 sky = mix(skyHorizon, skyZenith, t);
            float haze = exp(-y * 4.0) * 0.3;
            sky = mix(sky, horizonHaze, haze);

            // Sun reflection in sky
            float sunAngle = max(dot(reflectDir, uSunPosition), 0.0);
            float sunGlow = pow(sunAngle, 8.0) * 0.4;
            sky += uSunColor * sunGlow;

            return sky;
          }
          return uOceanColorDeep;
        }

        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          vec3 sunDir = normalize(uSunPosition);

          // Sample normal maps at multiple scales with animation
          vec2 uv1 = vUv * 0.5 + uTime * vec2(0.02, 0.01);
          vec2 uv2 = vUv * 1.0 + uTime * vec2(-0.015, 0.02);
          vec2 uv3 = vUv * 2.0 + uTime * vec2(0.01, -0.015);
          vec2 uv4 = vUv * 4.0 + uTime * vec2(-0.02, -0.01);

          vec3 normal1 = texture2D(uNormalMap, uv1).rgb * 2.0 - 1.0;
          vec3 normal2 = texture2D(uNormalMap, uv2).rgb * 2.0 - 1.0;
          vec3 normal3 = texture2D(uNormalMap, uv3).rgb * 2.0 - 1.0;
          vec3 normal4 = texture2D(uNormalMap, uv4).rgb * 2.0 - 1.0;

          vec3 detailNormal = normalize(normal1 * 0.4 + normal2 * 0.3 + normal3 * 0.2 + normal4 * 0.1);
          detailNormal.xy *= 0.3;
          detailNormal = normalize(detailNormal);

          // Combine macro and micro normals using TBN matrix
          mat3 TBN = mat3(vTangent, vBitangent, vNormal);
          vec3 normal = normalize(TBN * detailNormal);

          // Fresnel - water F0 ≈ 0.02
          float NdotV = max(dot(normal, viewDir), 0.0);
          float fresnel = fresnelSchlick(NdotV, 0.02);

          // Water color with depth variation
          float depthFactor = smoothstep(-3.0, 4.0, vWaveHeight);
          vec3 waterColor = mix(uOceanColorDeep, uOceanColorMid, depthFactor * 0.7);
          waterColor = mix(waterColor, uOceanColorShallow, pow(depthFactor, 2.0) * 0.5);

          // Sky reflection
          vec3 reflectDir = reflect(-viewDir, normal);
          vec3 skyReflection = getSkyReflection(reflectDir);

          // Sun specular - multiple lobes for realistic sun reflection
          vec3 H = normalize(sunDir + viewDir);
          float NdotH = max(dot(normal, H), 0.0);

          // Sharp sun disc reflection
          float specPower1 = pow(NdotH, 1024.0) * 4.0;
          // Medium glow
          float specPower2 = pow(NdotH, 256.0) * 1.5;
          // Soft halo
          float specPower3 = pow(NdotH, 64.0) * 0.5;
          // Very soft bloom
          float specPower4 = pow(NdotH, 16.0) * 0.15;

          vec3 sunSpec = uSunColor * (specPower1 + specPower2 + specPower3 + specPower4);

          // Subsurface scattering
          float sss = pow(max(dot(viewDir, -sunDir), 0.0), 4.0);
          float waveTranslucency = smoothstep(-1.0, 3.0, vWaveHeight);
          vec3 sssColor = vec3(0.0, 0.15, 0.12) * sss * waveTranslucency * 0.8;

          // Combine colors
          vec3 oceanColor = mix(waterColor + sssColor, skyReflection, fresnel * 0.85);
          oceanColor += sunSpec;

          // Foam
          float foam = smoothstep(2.5, 4.5, vWaveHeight);
          vec2 foamUV = vWorldPosition.xz * 0.15 + uTime * vec2(0.02, 0.015);
          float foamTex = texture2D(uFoamTexture, foamUV).r;
          foam *= foamTex;
          foam = smoothstep(0.2, 0.8, foam);
          oceanColor = mix(oceanColor, vec3(0.95, 0.98, 1.0), foam * 0.9);

          // Distance fog
          float dist = length(vWorldPosition - cameraPosition);
          float fogFactor = 1.0 - exp(-dist * 0.0015);
          vec3 fogColor = vec3(0.75, 0.85, 0.92);
          oceanColor = mix(oceanColor, fogColor, fogFactor * 0.5);

          // Color grading
          oceanColor = pow(oceanColor, vec3(0.97));

          gl_FragColor = vec4(oceanColor, 1.0);
        }
      `,
      side: THREE.FrontSide,
    });

    // Very high resolution ocean mesh
    const oceanGeometry = new THREE.PlaneGeometry(1200, 1200, 512, 512);
    oceanGeometry.rotateX(-Math.PI / 2);
    const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
    ocean.position.y = 0;
    scene.add(ocean);

    // Lighting
    const sunLight = new THREE.DirectionalLight(0xfff8f0, 2.5);
    sunLight.position.set(60, 30, -200);
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x004455, 0.6);
    scene.add(hemiLight);

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      oceanMaterial.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop
    const clock = new THREE.Clock();
    let animationFrame: number;

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      // Update shader time
      oceanMaterial.uniforms.uTime.value = elapsedTime;

      // Gentle camera bob
      const bobY = Math.sin(elapsedTime * 0.3) * 0.8 + Math.sin(elapsedTime * 0.5) * 0.4;
      const bobX = Math.sin(elapsedTime * 0.2) * 1.5;
      camera.position.y = 6 + bobY;
      camera.position.x = bobX;
      camera.rotation.z = Math.sin(elapsedTime * 0.25) * 0.01;

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
      normalTexture.dispose();
      foamTexture.dispose();
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
