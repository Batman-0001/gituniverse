/**
 * Temporal Effects — Cinematic Stellar Life Cycle Animations
 *
 * Renders physically-inspired 3D effects with custom GLSL shaders:
 *
 * 1. Star Birth     — Volumetric accretion nebula with swirling noise, spiraling
 *                      particle disk, central protostar ignition pulse
 * 2. Supernova      — Multi-layer expanding shockwave (Fresnel), volumetric ejecta
 *                      shell, debris filaments, central flash with god-ray spikes
 * 3. White Dwarf    — Planetary nebula shell expanding, dim pulsing remnant,
 *                      concentric fading halos
 * 4. Binary Form.   — Roche-lobe energy stream, shared accretion torus,
 *                      gravitational wave ripple
 * 5. Debt Clearance — Ascending purification column, green healing wave
 * 6. Bus Factor     — Pulsing danger aura, concentric warning shockwaves
 *
 * All animations are epoch-reactive via useTemporalStore.
 */

"use client";

import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SpatialDeveloper } from "@/utils/spatial-layout";
import { useTemporalStore } from "@/stores/temporal-store";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TemporalEffectsProps {
  developers: Map<string, SpatialDeveloper>;
}

interface ActiveEffect {
  eventId: string;
  eventType: string;
  position: THREE.Vector3;
  magnitude: number;
  progress: number;
  developerBPosition?: THREE.Vector3;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_EFFECTS = 8;
const EVENT_ANIMATION_WINDOW_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

// ─── Shared Geometries ──────────────────────────────────────────────────────

const lowSphere = new THREE.SphereGeometry(1, 8, 8);
const midSphere = new THREE.SphereGeometry(1, 24, 24);
const hiRing = new THREE.RingGeometry(0.85, 1.0, 96);
const thinRing = new THREE.RingGeometry(0.92, 1.0, 96);
const torusGeo = new THREE.TorusGeometry(1, 0.12, 16, 64);

// ─── Seeded RNG ──────────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// ─── Shared GLSL Simplex Noise (3D) ─────────────────────────────────────────

const SIMPLEX_NOISE_GLSL = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x / 289.0) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x / 289.0) * 289.0; }
  vec4 permute(vec4 x) { return mod289((x * 34.0 + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g, l.zxy);
    vec3 i2 = max(g, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - 0.5;
    i = mod289(i);
    vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    vec4 j = p - 49.0 * floor(p / 49.0);
    vec4 x_ = floor(j / 7.0);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 ox = (x_ * 2.0 + 0.5) / 7.0 - 1.0;
    vec4 oy = (y_ * 2.0 + 0.5) / 7.0 - 1.0;
    vec4 gz = vec4(0.5) - abs(ox) - abs(oy);
    vec4 sz = step(gz, vec4(0.0));
    ox -= sz * (step(vec4(0.0), ox) - 0.5);
    oy -= sz * (step(vec4(0.0), oy) - 0.5);
    vec3 g0 = vec3(ox.x, oy.x, gz.x);
    vec3 g1 = vec3(ox.y, oy.y, gz.y);
    vec3 g2 = vec3(ox.z, oy.z, gz.z);
    vec3 g3 = vec3(ox.w, oy.w, gz.w);
    vec4 norm = taylorInvSqrt(vec4(dot(g0,g0),dot(g1,g1),dot(g2,g2),dot(g3,g3)));
    g0 *= norm.x; g1 *= norm.y; g2 *= norm.z; g3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(g0,x0),dot(g1,x1),dot(g2,x2),dot(g3,x3)));
  }

  float fbm(vec3 p, int octaves) {
    float val = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 6; i++) {
      if (i >= octaves) break;
      val += amp * snoise(p * freq);
      freq *= 2.0;
      amp *= 0.5;
    }
    return val;
  }
`;

// ─── Smooth easing helpers ───────────────────────────────────────────────────

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  1. STAR BIRTH — Volumetric accretion nebula + spiraling particle disk
// ═══════════════════════════════════════════════════════════════════════════════

const starBirthNebulaVert = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  uniform float uProgress;
  uniform float uTime;
  ${SIMPLEX_NOISE_GLSL}
  void main() {
    vNormal = normalize(normalMatrix * normal);
    // Breathe: sphere inflates then collapses
    float collapse = 1.0 - uProgress;
    float breathe = 1.0 + collapse * 0.4 * sin(uTime * 1.5);
    float radius = mix(0.2, 1.0, collapse) * breathe;
    // Add noise displacement for gaseous look
    float disp = fbm(position * 2.0 + uTime * 0.15, 4) * 0.4 * collapse;
    vec3 displaced = position * radius + normal * disp;
    vWorldPos = (modelMatrix * vec4(displaced, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const starBirthNebulaFrag = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  uniform float uProgress;
  uniform float uTime;
  ${SIMPLEX_NOISE_GLSL}
  void main() {
    float collapse = 1.0 - uProgress;
    // Nebula density from noise
    float noise = fbm(vWorldPos * 1.5 + uTime * 0.08, 5);
    float density = smoothstep(-0.2, 0.6, noise) * collapse;
    // Color: deep blue/purple → warm gold as star ignites
    vec3 coolColor = vec3(0.15, 0.08, 0.45);
    vec3 warmColor = vec3(1.0, 0.75, 0.2);
    vec3 hotColor  = vec3(1.0, 0.95, 0.8);
    vec3 col = mix(coolColor, warmColor, uProgress);
    col = mix(col, hotColor, smoothstep(0.7, 1.0, uProgress));
    // Fresnel rim glow
    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.5);
    col += fresnel * vec3(0.3, 0.15, 0.6) * collapse;
    // Central glow intensifies as star forms
    float centerGlow = smoothstep(0.5, 1.0, uProgress) * 1.5;
    float alpha = density * 0.65 + centerGlow * 0.3;
    gl_FragColor = vec4(col * (1.0 + centerGlow), clamp(alpha, 0.0, 1.0));
  }
`;

function StarBirthEffect({
  position,
  progress,
  magnitude,
}: {
  position: THREE.Vector3;
  progress: number;
  magnitude: number;
}) {
  const nebulaRef = useRef<THREE.Mesh>(null);
  const diskRef = useRef<THREE.InstancedMesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const spikesRef = useRef<THREE.Group>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const nebulaMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starBirthNebulaVert,
        fragmentShader: starBirthNebulaFrag,
        uniforms: {
          uProgress: { value: 0 },
          uTime: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );

  // Spiraling accretion disk particles
  const diskCount = 80;
  const diskParticles = useMemo(() => {
    const rng = mulberry32(hashStr(position.toArray().join(",")));
    return Array.from({ length: diskCount }, (_, i) => ({
      angle: (i / diskCount) * Math.PI * 2 + rng() * 0.5,
      radius: 1.5 + rng() * 4.5,
      speed: 0.8 + rng() * 1.2,
      y: (rng() - 0.5) * 0.3,
      size: 0.04 + rng() * 0.08,
      bright: 0.4 + rng() * 0.6,
    }));
  }, [position, diskCount]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const collapse = 1 - progress;
    const scale = (2 + magnitude) * (0.3 + collapse * 0.7);

    // Nebula envelope
    if (nebulaRef.current) {
      nebulaRef.current.scale.setScalar(Math.max(0.01, scale));
      nebulaMat.uniforms.uProgress.value = progress;
      nebulaMat.uniforms.uTime.value = t;
    }

    // Spiraling accretion disk
    if (diskRef.current) {
      for (let i = 0; i < diskCount; i++) {
        const p = diskParticles[i];
        const r = p.radius * collapse * (magnitude * 0.3 + 1);
        const a = p.angle + t * p.speed * (1 + progress * 2);

        dummy.position.set(
          position.x + Math.cos(a) * r,
          position.y + p.y + Math.sin(t * 3 + i) * 0.08 * collapse,
          position.z + Math.sin(a) * r,
        );
        const fadeIn = Math.min(1, progress * 3);
        const swirlShrink = 0.5 + collapse * 0.5;
        dummy.scale.setScalar(p.size * fadeIn * swirlShrink);
        dummy.updateMatrix();
        diskRef.current.setMatrixAt(i, dummy.matrix);
      }
      diskRef.current.instanceMatrix.needsUpdate = true;
    }

    // Central protostar core — ignites at progress > 0.5
    if (coreRef.current) {
      const ignition = Math.max(0, (progress - 0.4) / 0.6);
      const pulse = 1 + Math.sin(t * 6) * 0.15 * ignition;
      const coreScale = ignition * (0.8 + magnitude * 0.3) * pulse;
      coreRef.current.scale.setScalar(Math.max(0.001, coreScale));
      (coreRef.current.material as THREE.MeshBasicMaterial).opacity =
        ignition * 0.9;
    }

    // God-ray spikes emerge at ignition
    if (spikesRef.current) {
      const ignition = Math.max(0, (progress - 0.6) / 0.4);
      spikesRef.current.visible = ignition > 0.01;
      spikesRef.current.rotation.z = t * 0.3;
      spikesRef.current.scale.setScalar(ignition * (3 + magnitude));
      spikesRef.current.children.forEach((child, i) => {
        const m = child as THREE.Mesh;
        (m.material as THREE.MeshBasicMaterial).opacity =
          ignition * 0.35 * (0.7 + Math.sin(t * 4 + i * 1.5) * 0.3);
      });
    }
  });

  return (
    <group>
      {/* Volumetric nebula cloud */}
      <mesh ref={nebulaRef} position={position} material={nebulaMat}>
        <sphereGeometry args={[1, 32, 32]} />
      </mesh>

      {/* Spiraling accretion disk */}
      <instancedMesh
        ref={diskRef}
        args={[lowSphere, undefined, diskCount]}
        frustumCulled={false}
      >
        <meshBasicMaterial
          color="#ffcc44"
          transparent
          opacity={0.7}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Central protostar ignition */}
      <mesh ref={coreRef} position={position}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial
          color="#fff4d0"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* God-ray spikes (4 emanating planes) */}
      <group ref={spikesRef} position={position}>
        {[0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4].map((rot, i) => (
          <mesh key={i} rotation={[0, 0, rot]}>
            <planeGeometry args={[0.06, 2]} />
            <meshBasicMaterial
              color="#fff8dd"
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  2. SUPERNOVA — Multi-layer shockwave + ejecta shell + debris filaments
// ═══════════════════════════════════════════════════════════════════════════════

const shockwaveVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const shockwaveFrag = /* glsl */ `
  varying vec2 vUv;
  uniform float uProgress;
  uniform float uTime;
  void main() {
    vec2 center = vec2(0.5);
    float dist = distance(vUv, center) * 2.0;
    // Ring that expands and thins
    float ringPos = uProgress;
    float ringWidth = 0.08 * (1.0 - uProgress * 0.6);
    float ring = smoothstep(ringPos - ringWidth, ringPos, dist)
               * smoothstep(ringPos + ringWidth, ringPos, dist);
    // Fresnel-like edge brightening
    float edge = pow(ring, 0.5);
    // Color: white center → orange → red at edges
    vec3 col = mix(vec3(1.0, 0.4, 0.1), vec3(1.0, 0.9, 0.7), ring);
    // Secondary inner ring (reflected shock)
    float innerRing = smoothstep(ringPos * 0.6 - 0.03, ringPos * 0.6, dist)
                    * smoothstep(ringPos * 0.6 + 0.03, ringPos * 0.6, dist);
    col += vec3(0.8, 0.3, 0.1) * innerRing * 0.5;
    float alpha = (edge + innerRing * 0.3) * (1.0 - uProgress * 0.7);
    // Flicker
    alpha *= 0.8 + 0.2 * sin(uTime * 12.0 + dist * 20.0);
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

const ejectaShellVert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  uniform float uProgress;
  uniform float uTime;
  ${SIMPLEX_NOISE_GLSL}
  void main() {
    vNormal = normalize(normalMatrix * normal);
    // Lumpy expanding shell
    float expand = uProgress;
    float noise = snoise(position * 3.0 + uTime * 0.2) * 0.3;
    vec3 displaced = position * (expand + noise * expand);
    vPos = displaced;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const ejectaShellFrag = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  uniform float uProgress;
  uniform float uTime;
  ${SIMPLEX_NOISE_GLSL}
  void main() {
    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
    // Filamentary structure from noise
    float filaments = fbm(vPos * 4.0 - uTime * 0.1, 4);
    float structure = smoothstep(0.0, 0.5, filaments);
    // Color: hot white core → orange filaments → red outer
    float radialDist = length(vPos);
    vec3 hotCore  = vec3(1.0, 0.95, 0.85);
    vec3 midOrange= vec3(1.0, 0.45, 0.1);
    vec3 outerRed = vec3(0.8, 0.12, 0.05);
    float t = clamp(radialDist / max(uProgress, 0.01), 0.0, 1.0);
    vec3 col = mix(hotCore, midOrange, smoothstep(0.0, 0.5, t));
    col = mix(col, outerRed, smoothstep(0.5, 1.0, t));
    col += fresnel * vec3(1.0, 0.6, 0.2) * 0.5;
    float alpha = (fresnel * 0.6 + structure * 0.3) * (1.0 - uProgress * 0.6);
    gl_FragColor = vec4(col * 1.5, clamp(alpha, 0.0, 1.0));
  }
`;

function SupernovaEffect({
  position,
  progress,
  magnitude,
}: {
  position: THREE.Vector3;
  progress: number;
  magnitude: number;
}) {
  const shockRef = useRef<THREE.Mesh>(null);
  const shockRef2 = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const debrisRef = useRef<THREE.InstancedMesh>(null);
  const spikeRef = useRef<THREE.Group>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const shockMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: shockwaveVert,
        fragmentShader: shockwaveFrag,
        uniforms: {
          uProgress: { value: 0 },
          uTime: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );

  const ejectaMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: ejectaShellVert,
        fragmentShader: ejectaShellFrag,
        uniforms: {
          uProgress: { value: 0 },
          uTime: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );

  const debrisCount = 48;
  const debris = useMemo(() => {
    const rng = mulberry32(hashStr(position.toArray().join(",")));
    return Array.from({ length: debrisCount }, () => {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      return {
        dir: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.sin(phi) * Math.sin(theta),
          Math.cos(phi),
        ),
        speed: 0.5 + rng() * 3.5,
        size: 0.04 + rng() * 0.12,
        rotSpeed: (rng() - 0.5) * 6,
        colorMix: rng(), // 0 = orange, 1 = blue-white (hot)
        trail: 0.5 + rng() * 0.5,
      };
    });
  }, [position, debrisCount]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const scale = magnitude + 1.5;

    // Shockwave rings (two at different angles for 3D feel)
    shockMat.uniforms.uProgress.value = progress;
    shockMat.uniforms.uTime.value = t;

    if (shockRef.current) {
      const ringScale = easeOutExpo(progress) * 25 * scale;
      shockRef.current.scale.setScalar(Math.max(0.01, ringScale));
    }
    if (shockRef2.current) {
      const ringScale2 = easeOutExpo(Math.max(0, progress - 0.05)) * 20 * scale;
      shockRef2.current.scale.setScalar(Math.max(0.01, ringScale2));
    }

    // Volumetric ejecta shell
    if (shellRef.current) {
      const shellScale = easeOutExpo(progress) * 8 * scale;
      shellRef.current.scale.setScalar(Math.max(0.01, shellScale));
      ejectaMat.uniforms.uProgress.value = progress;
      ejectaMat.uniforms.uTime.value = t;
    }

    // Central flash — blinding burst that fades
    if (flashRef.current) {
      const flashPhase =
        progress < 0.12 ?
          easeOutExpo(progress / 0.12)
        : Math.max(0, 1 - (progress - 0.12) / 0.25);
      const flashScale = (0.5 + flashPhase * 6) * scale * 0.5;
      flashRef.current.scale.setScalar(Math.max(0.01, flashScale));
      (flashRef.current.material as THREE.MeshBasicMaterial).opacity =
        flashPhase * 1.0;
    }

    // Light spikes (god-rays from the flash)
    if (spikeRef.current) {
      const spikePhase =
        progress < 0.15 ?
          progress / 0.15
        : Math.max(0, 1 - (progress - 0.15) / 0.3);
      spikeRef.current.visible = spikePhase > 0.01;
      spikeRef.current.rotation.z = t * 0.2;
      spikeRef.current.children.forEach((child, i) => {
        const m = child as THREE.Mesh;
        const flicker = 0.7 + Math.sin(t * 8 + i * 2.1) * 0.3;
        (m.material as THREE.MeshBasicMaterial).opacity =
          spikePhase * 0.5 * flicker;
        const spikeLen = spikePhase * (6 + magnitude * 2);
        m.scale.set(1, Math.max(0.01, spikeLen), 1);
      });
    }

    // Debris filaments
    if (debrisRef.current) {
      for (let i = 0; i < debrisCount; i++) {
        const d = debris[i];
        const eased = easeOutExpo(progress);
        const dist = eased * d.speed * 12 * scale;
        // Deceleration effect
        const decel = 1 - progress * 0.3;

        dummy.position.set(
          position.x + d.dir.x * dist * decel,
          position.y + d.dir.y * dist * decel,
          position.z + d.dir.z * dist * decel,
        );
        const fadeOut = Math.max(0, 1 - progress * 0.85);
        const stretch = 1 + d.trail * progress * 2; // elongate along travel direction
        dummy.scale.set(
          d.size * fadeOut,
          d.size * fadeOut * stretch,
          d.size * fadeOut,
        );
        dummy.lookAt(
          position.x + d.dir.x * 999,
          position.y + d.dir.y * 999,
          position.z + d.dir.z * 999,
        );
        dummy.rotateZ(t * d.rotSpeed);
        dummy.updateMatrix();
        debrisRef.current.setMatrixAt(i, dummy.matrix);
      }
      debrisRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Primary shockwave ring (equatorial) */}
      <mesh
        ref={shockRef}
        position={position}
        rotation={[Math.PI / 2, 0, 0]}
        material={shockMat}
      >
        <planeGeometry args={[2, 2, 1, 1]} />
      </mesh>

      {/* Secondary shockwave ring (tilted 60°) */}
      <mesh
        ref={shockRef2}
        position={position}
        rotation={[Math.PI / 2 + 1.05, 0.5, 0]}
        material={shockMat}
      >
        <planeGeometry args={[2, 2, 1, 1]} />
      </mesh>

      {/* Volumetric ejecta shell */}
      <mesh ref={shellRef} position={position} material={ejectaMat}>
        <sphereGeometry args={[1, 32, 32]} />
      </mesh>

      {/* Central blinding flash */}
      <mesh ref={flashRef} position={position}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* God-ray spikes (6 beams) */}
      <group ref={spikeRef} position={position}>
        {[
          0,
          Math.PI / 6,
          Math.PI / 3,
          Math.PI / 2,
          (2 * Math.PI) / 3,
          (5 * Math.PI) / 6,
        ].map((rot, i) => (
          <mesh key={i} rotation={[0, 0, rot]}>
            <planeGeometry args={[0.08, 1]} />
            <meshBasicMaterial
              color="#fff0cc"
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      {/* Debris filaments */}
      <instancedMesh
        ref={debrisRef}
        args={[lowSphere, undefined, debrisCount]}
        frustumCulled={false}
      >
        <meshBasicMaterial
          color="#ff7744"
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  3. WHITE DWARF — Planetary nebula shell + dim pulsating remnant
// ═══════════════════════════════════════════════════════════════════════════════

const planetaryNebulaVert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  uniform float uProgress;
  uniform float uTime;
  ${SIMPLEX_NOISE_GLSL}
  void main() {
    vNormal = normalize(normalMatrix * normal);
    // Expanding shell with turbulent surface
    float expand = 0.3 + uProgress * 0.7;
    float turb = snoise(position * 5.0 + uTime * 0.1) * 0.15 * (1.0 - uProgress * 0.5);
    vec3 displaced = position * expand + normal * turb;
    vPos = displaced;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const planetaryNebulaFrag = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  uniform float uProgress;
  uniform float uTime;
  ${SIMPLEX_NOISE_GLSL}
  void main() {
    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
    // Nebula colors: teal + magenta (like real planetary nebulae)
    float noise = fbm(vPos * 3.0 + uTime * 0.05, 4);
    vec3 teal    = vec3(0.1, 0.8, 0.7);
    vec3 magenta = vec3(0.7, 0.15, 0.5);
    vec3 white   = vec3(0.9, 0.92, 1.0);
    vec3 col = mix(teal, magenta, smoothstep(-0.3, 0.3, noise));
    col = mix(col, white, fresnel * 0.4);
    float alpha = fresnel * 0.5 * (1.0 - uProgress * 0.6) + smoothstep(0.1, 0.4, noise) * 0.2;
    gl_FragColor = vec4(col * 1.3, clamp(alpha, 0.0, 0.85));
  }
`;

function WhiteDwarfEffect({
  position,
  progress,
}: {
  position: THREE.Vector3;
  progress: number;
}) {
  const nebulaRef = useRef<THREE.Mesh>(null);
  const remnantRef = useRef<THREE.Mesh>(null);
  const haloRef1 = useRef<THREE.Mesh>(null);
  const haloRef2 = useRef<THREE.Mesh>(null);

  const nebulaMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: planetaryNebulaVert,
        fragmentShader: planetaryNebulaFrag,
        uniforms: {
          uProgress: { value: 0 },
          uTime: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Expanding planetary nebula shell
    if (nebulaRef.current) {
      const nebulaScale = 2 + progress * 6;
      nebulaRef.current.scale.setScalar(Math.max(0.01, nebulaScale));
      nebulaMat.uniforms.uProgress.value = progress;
      nebulaMat.uniforms.uTime.value = t;
    }

    // Dim pulsating remnant at center
    if (remnantRef.current) {
      const pulse = 0.8 + Math.sin(t * 2) * 0.1;
      const remnantScale = (1.5 - progress * 1.0) * pulse;
      remnantRef.current.scale.setScalar(Math.max(0.01, remnantScale));
      (remnantRef.current.material as THREE.MeshBasicMaterial).opacity =
        (0.6 - progress * 0.4) * pulse;
    }

    // Concentric fading halos
    if (haloRef1.current) {
      const h1Scale = 3 + progress * 4;
      haloRef1.current.scale.setScalar(Math.max(0.01, h1Scale));
      (haloRef1.current.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        0.25 - progress * 0.2,
      );
      haloRef1.current.rotation.z = t * 0.1;
    }
    if (haloRef2.current) {
      const h2Scale = 4 + progress * 6;
      haloRef2.current.scale.setScalar(Math.max(0.01, h2Scale));
      (haloRef2.current.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        0.15 - progress * 0.12,
      );
      haloRef2.current.rotation.z = -t * 0.08;
    }
  });

  return (
    <group>
      {/* Planetary nebula shell */}
      <mesh ref={nebulaRef} position={position} material={nebulaMat}>
        <sphereGeometry args={[1, 32, 32]} />
      </mesh>

      {/* Dim white dwarf remnant */}
      <mesh ref={remnantRef} position={position}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color="#c0d8f0"
          transparent
          opacity={0.6}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* Halo ring 1 */}
      <mesh
        ref={haloRef1}
        position={position}
        rotation={[Math.PI / 2 + 0.2, 0, 0]}
      >
        <ringGeometry args={[0.88, 1.0, 64]} />
        <meshBasicMaterial
          color="#80c0d0"
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* Halo ring 2 (wider, dimmer) */}
      <mesh
        ref={haloRef2}
        position={position}
        rotation={[Math.PI / 2 - 0.3, 0.4, 0]}
      >
        <ringGeometry args={[0.9, 1.0, 64]} />
        <meshBasicMaterial
          color="#9070a0"
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  4. BINARY FORMATION — Energy bridge + shared accretion torus + grav waves
// ═══════════════════════════════════════════════════════════════════════════════

function BinaryFormationEffect({
  positionA,
  positionB,
  progress,
}: {
  positionA: THREE.Vector3;
  positionB: THREE.Vector3;
  progress: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const streamRef = useRef<THREE.InstancedMesh>(null);
  const torusRef = useRef<THREE.Mesh>(null);
  const waveRef1 = useRef<THREE.Mesh>(null);
  const waveRef2 = useRef<THREE.Mesh>(null);
  const glowARef = useRef<THREE.Mesh>(null);
  const glowBRef = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const midpoint = useMemo(
    () => new THREE.Vector3().lerpVectors(positionA, positionB, 0.5),
    [positionA, positionB],
  );
  const dist = useMemo(
    () => positionA.distanceTo(positionB),
    [positionA, positionB],
  );

  // Particles flowing along Roche lobe from A to B
  const streamCount = 60;
  const streamParticles = useMemo(() => {
    const rng = mulberry32(
      hashStr(positionA.toArray().join(",") + positionB.toArray().join(",")),
    );
    return Array.from({ length: streamCount }, (_, i) => ({
      phase: i / streamCount,
      offset: (rng() - 0.5) * 0.4,
      offsetY: (rng() - 0.5) * 0.3,
      size: 0.03 + rng() * 0.06,
      speed: 0.6 + rng() * 0.4,
    }));
  }, [positionA, positionB, streamCount]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Mass transfer stream particles
    if (streamRef.current) {
      const dir = positionB.clone().sub(positionA).normalize();
      const perp = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
      const perpY = new THREE.Vector3(0, 1, 0);

      for (let i = 0; i < streamCount; i++) {
        const p = streamParticles[i];
        const flow = (p.phase + t * p.speed * 0.3) % 1;
        // Catenary-like curve between stars
        const sag = Math.sin(flow * Math.PI) * dist * 0.15;
        const pos = positionA.clone().lerp(positionB, flow);
        pos.add(perp.clone().multiplyScalar(p.offset * sag));
        pos.add(perpY.clone().multiplyScalar(sag * 0.3 + p.offsetY));

        dummy.position.copy(pos);
        const fade = Math.sin(flow * Math.PI) * progress;
        dummy.scale.setScalar(p.size * Math.max(0.001, fade));
        dummy.updateMatrix();
        streamRef.current.setMatrixAt(i, dummy.matrix);
      }
      streamRef.current.instanceMatrix.needsUpdate = true;
    }

    // Shared accretion torus at midpoint
    if (torusRef.current) {
      const torusScale = easeInOutCubic(progress) * dist * 0.3;
      torusRef.current.scale.setScalar(Math.max(0.01, torusScale));
      torusRef.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.5) * 0.1;
      torusRef.current.rotation.z = t * 0.4;
      (torusRef.current.material as THREE.MeshBasicMaterial).opacity =
        progress * 0.35;
    }

    // Gravitational wave ripples expanding from midpoint
    const wavePulse = (Math.sin(t * 3) + 1) * 0.5;
    if (waveRef1.current) {
      const w1 = (2 + wavePulse * 4) * progress;
      waveRef1.current.scale.setScalar(Math.max(0.01, w1));
      (waveRef1.current.material as THREE.MeshBasicMaterial).opacity =
        (1 - wavePulse) * 0.15 * progress;
    }
    if (waveRef2.current) {
      const w2 = (3 + (1 - wavePulse) * 5) * progress;
      waveRef2.current.scale.setScalar(Math.max(0.01, w2));
      (waveRef2.current.material as THREE.MeshBasicMaterial).opacity =
        wavePulse * 0.12 * progress;
    }

    // Roche glow around each star
    const pulse = 0.7 + Math.sin(t * 4) * 0.3;
    if (glowARef.current) {
      glowARef.current.scale.setScalar(Math.max(0.01, 1.5 * progress * pulse));
      (glowARef.current.material as THREE.MeshBasicMaterial).opacity =
        progress * 0.25 * pulse;
    }
    if (glowBRef.current) {
      glowBRef.current.scale.setScalar(
        Math.max(0.01, 1.5 * progress * (2 - pulse)),
      );
      (glowBRef.current.material as THREE.MeshBasicMaterial).opacity =
        progress * 0.25 * (2 - pulse);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Mass transfer stream */}
      <instancedMesh
        ref={streamRef}
        args={[lowSphere, undefined, streamCount]}
        frustumCulled={false}
      >
        <meshBasicMaterial
          color="#e080ff"
          transparent
          opacity={0.7}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Shared accretion torus */}
      <mesh ref={torusRef} position={midpoint}>
        <torusGeometry args={[1, 0.12, 16, 64]} />
        <meshBasicMaterial
          color="#d060f0"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* Gravitational wave ring 1 */}
      <mesh ref={waveRef1} position={midpoint} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.92, 1.0, 64]} />
        <meshBasicMaterial
          color="#c0a0ff"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* Gravitational wave ring 2 */}
      <mesh ref={waveRef2} position={midpoint} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.92, 1.0, 64]} />
        <meshBasicMaterial
          color="#a080e0"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* Roche lobe glow — Star A */}
      <mesh ref={glowARef} position={positionA}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color="#e040fb"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* Roche lobe glow — Star B */}
      <mesh ref={glowBRef} position={positionB}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color="#e040fb"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  5. DEBT CLEARANCE — Ascending purification column + healing wave
// ═══════════════════════════════════════════════════════════════════════════════

function DebtClearanceEffect({
  position,
  progress,
  magnitude,
}: {
  position: THREE.Vector3;
  progress: number;
  magnitude: number;
}) {
  const columnRef = useRef<THREE.InstancedMesh>(null);
  const waveRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particleCount = 48;
  const particles = useMemo(() => {
    const rng = mulberry32(hashStr(position.toArray().join(",")));
    return Array.from({ length: particleCount }, (_, i) => ({
      angle: (i / particleCount) * Math.PI * 2 + rng() * 0.3,
      radius: 0.1 + rng() * 1.2,
      speed: 1 + rng() * 2,
      ySpeed: 2 + rng() * 4,
      size: 0.03 + rng() * 0.06,
      phase: rng() * Math.PI * 2,
    }));
  }, [position, particleCount]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Ascending particle column (spiraling upward)
    if (columnRef.current) {
      for (let i = 0; i < particleCount; i++) {
        const p = particles[i];
        const yRise = progress * p.ySpeed * (magnitude + 1) * 3;
        const spiral = p.angle + t * p.speed * 0.5;
        const r = p.radius * (1 - progress * 0.5);
        const fade = Math.max(0, 1 - progress * 0.8);
        const breathe = 1 + Math.sin(t * 3 + p.phase) * 0.2;

        dummy.position.set(
          position.x + Math.cos(spiral) * r,
          position.y + yRise + Math.sin(t * 2 + i) * 0.2,
          position.z + Math.sin(spiral) * r,
        );
        dummy.scale.setScalar(p.size * fade * breathe);
        dummy.updateMatrix();
        columnRef.current.setMatrixAt(i, dummy.matrix);
      }
      columnRef.current.instanceMatrix.needsUpdate = true;
    }

    // Expanding healing wave (ground ring)
    if (waveRef.current) {
      const waveScale = easeOutExpo(progress) * 10 * (magnitude + 1);
      waveRef.current.scale.setScalar(Math.max(0.01, waveScale));
      (waveRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        (1 - progress) * 0.3,
      );
    }

    // Central healing core
    if (coreRef.current) {
      const pulse = 0.8 + Math.sin(t * 4) * 0.2;
      const coreScale = (1 - progress * 0.5) * pulse * (magnitude * 0.3 + 1);
      coreRef.current.scale.setScalar(Math.max(0.01, coreScale));
      (coreRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        (1 - progress * 0.7) * 0.5 * pulse,
      );
    }
  });

  return (
    <group>
      {/* Ascending particle column */}
      <instancedMesh
        ref={columnRef}
        args={[lowSphere, undefined, particleCount]}
        frustumCulled={false}
      >
        <meshBasicMaterial
          color="#44dd88"
          transparent
          opacity={0.65}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Ground healing wave */}
      <mesh ref={waveRef} position={position} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 1.0, 64]} />
        <meshBasicMaterial
          color="#22cc66"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* Healing core glow */}
      <mesh ref={coreRef} position={position}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color="#88ffbb"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  6. BUS FACTOR ALERT — Danger aura + concentric warning shockwaves
// ═══════════════════════════════════════════════════════════════════════════════

function BusFactorEffect({
  position,
  progress,
}: {
  position: THREE.Vector3;
  progress: number;
}) {
  const auraRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Pulsating danger aura
    if (auraRef.current) {
      const pulse = 0.6 + Math.sin(t * 5) * 0.25 + Math.sin(t * 7.3) * 0.15;
      const auraScale = 3 * progress * pulse;
      auraRef.current.scale.setScalar(Math.max(0.01, auraScale));
      (auraRef.current.material as THREE.MeshBasicMaterial).opacity =
        progress * 0.2 * pulse;
    }

    // Three concentric warning rings expanding with staggered timing
    const rings = [ring1Ref, ring2Ref, ring3Ref];
    rings.forEach((ref, i) => {
      if (!ref.current) return;
      const offset = i * 0.33;
      const phase = (t * 1.5 + offset) % 1;
      const ringScale = (2 + phase * 8) * progress;
      ref.current.scale.setScalar(Math.max(0.01, ringScale));
      (ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        (1 - phase) * 0.35 * progress,
      );
    });
  });

  return (
    <group>
      {/* Danger aura sphere */}
      <mesh ref={auraRef} position={position}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color="#ff2222"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* Warning ring 1 */}
      <mesh ref={ring1Ref} position={position} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.92, 1.0, 48]} />
        <meshBasicMaterial
          color="#ff4444"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* Warning ring 2 */}
      <mesh
        ref={ring2Ref}
        position={position}
        rotation={[Math.PI / 2 + 0.3, 0, 0.2]}
      >
        <ringGeometry args={[0.92, 1.0, 48]} />
        <meshBasicMaterial
          color="#ff3333"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* Warning ring 3 */}
      <mesh
        ref={ring3Ref}
        position={position}
        rotation={[Math.PI / 2 - 0.2, 0.3, 0]}
      >
        <ringGeometry args={[0.92, 1.0, 48]} />
        <meshBasicMaterial
          color="#ff5555"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function TemporalEffects({ developers }: TemporalEffectsProps) {
  const { isLiveMode, activeEventIds, timelineEvents, currentEpoch } =
    useTemporalStore();

  const activeEffects = useMemo((): ActiveEffect[] => {
    if (isLiveMode || activeEventIds.size === 0) return [];

    const effects: ActiveEffect[] = [];

    for (const eventId of activeEventIds) {
      if (effects.length >= MAX_EFFECTS) break;

      const evt = timelineEvents.find((e) => e.id === eventId);
      if (!evt || !evt.developerId) continue;

      const dev = developers.get(evt.developerId);
      if (!dev) continue;

      const evtTs = new Date(evt.timestamp).getTime();
      const delta = currentEpoch - evtTs;

      const halfWindow = EVENT_ANIMATION_WINDOW_MS / 2;
      const progress = Math.max(
        0,
        Math.min(1, (delta + halfWindow) / EVENT_ANIMATION_WINDOW_MS),
      );

      let devBPos: THREE.Vector3 | undefined;
      if (evt.developerBId) {
        const devB = developers.get(evt.developerBId);
        if (devB) devBPos = devB.position.clone();
      }

      effects.push({
        eventId: evt.id,
        eventType: evt.eventType,
        position: dev.position.clone(),
        magnitude: evt.magnitude,
        progress,
        developerBPosition: devBPos,
      });
    }

    return effects;
  }, [isLiveMode, activeEventIds, timelineEvents, currentEpoch, developers]);

  if (activeEffects.length === 0) return null;

  return (
    <group>
      {activeEffects.map((effect) => {
        switch (effect.eventType) {
          case "STAR_BIRTH":
            return (
              <StarBirthEffect
                key={effect.eventId}
                position={effect.position}
                progress={effect.progress}
                magnitude={effect.magnitude}
              />
            );
          case "SUPERNOVA":
            return (
              <SupernovaEffect
                key={effect.eventId}
                position={effect.position}
                progress={effect.progress}
                magnitude={effect.magnitude}
              />
            );
          case "WHITE_DWARF":
            return (
              <WhiteDwarfEffect
                key={effect.eventId}
                position={effect.position}
                progress={effect.progress}
              />
            );
          case "BINARY_FORMATION":
            if (effect.developerBPosition) {
              return (
                <BinaryFormationEffect
                  key={effect.eventId}
                  positionA={effect.position}
                  positionB={effect.developerBPosition}
                  progress={effect.progress}
                />
              );
            }
            return null;
          case "DEBT_CLEARANCE":
            return (
              <DebtClearanceEffect
                key={effect.eventId}
                position={effect.position}
                progress={effect.progress}
                magnitude={effect.magnitude}
              />
            );
          case "BUS_FACTOR_ALERT":
            return (
              <BusFactorEffect
                key={effect.eventId}
                position={effect.position}
                progress={effect.progress}
              />
            );
          default:
            return null;
        }
      })}
    </group>
  );
}
