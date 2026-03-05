/**
 * Background Starfield — Cinematic Rewrite
 *
 * Creates a deep-space background with:
 * 1. 15,000 point-sprite stars with proper color distribution (O/B/A/F/G/K/M classes)
 * 2. Multi-layer parallax for depth
 * 3. Realistic twinkle (scintillation) based on atmospheric seeing
 * 4. Subtle nebula dust clouds using large soft-edged billboards
 * 5. Milky Way band — concentrated stellar density along the galactic plane
 */

"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ─── Configuration ──────────────────────────────────────────────────────────

const LAYER_CONFIG = [
    { count: 6000, spread: 900, sizeMin: 0.8, sizeMax: 2.0, twinkleSpeed: 0.5, opacity: 0.7, name: "far" },
    { count: 5000, spread: 1200, sizeMin: 1.2, sizeMax: 3.0, twinkleSpeed: 0.7, opacity: 0.85, name: "mid" },
    { count: 4000, spread: 1500, sizeMin: 1.5, sizeMax: 4.0, twinkleSpeed: 0.9, opacity: 1.0, name: "near" },
];

// ─── Seeded RNG ─────────────────────────────────────────────────────────────

function mulberry32(seed: number) {
    return () => {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// ─── Point Star Material (Custom Shader) ────────────────────────────────────

const STAR_POINT_VERTEX = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute float aFreq;
attribute float aBrightness;

varying vec3 vColor;
varying float vBrightness;

uniform float uTime;
uniform float uPixelRatio;

void main() {
    vColor = color;

    // Scintillation (twinkling)
    float twinkle = sin(uTime * aFreq + aPhase) * 0.3 + 0.7;
    twinkle *= sin(uTime * aFreq * 1.7 + aPhase * 2.3) * 0.15 + 0.85;
    vBrightness = aBrightness * twinkle;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float dist = length(mvPosition.xyz);

    // Size attenuation — closer stars look bigger
    gl_PointSize = aSize * uPixelRatio * (250.0 / dist);
    gl_PointSize = clamp(gl_PointSize, 1.0, 12.0);

    gl_Position = projectionMatrix * mvPosition;
}
`;

const STAR_POINT_FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vBrightness;

void main() {
    // Soft circular point with bright core + diffuse halo
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);

    // Sharp bright core
    float core = exp(-dist * dist * 40.0);
    // Softer halo
    float halo = exp(-dist * dist * 8.0) * 0.4;
    // Very subtle diffraction spikes
    float spike = 0.0;
    float angle = atan(center.y, center.x);
    spike += pow(abs(cos(angle * 2.0)), 60.0) * exp(-dist * 6.0) * 0.15;

    float intensity = (core + halo + spike) * vBrightness;

    if (intensity < 0.01) discard;

    gl_FragColor = vec4(vColor * intensity, intensity);
}
`;

// ─── Star Layer Component ───────────────────────────────────────────────────

interface StarLayerProps {
    layerIndex: number;
}

function StarLayer({ layerIndex }: StarLayerProps) {
    const pointsRef = useRef<THREE.Points>(null);
    const config = LAYER_CONFIG[layerIndex];

    const { geometry, material } = useMemo(() => {
        const rng = mulberry32(42 + layerIndex * 1000);
        const rngColor = mulberry32(123 + layerIndex * 500);

        const positions = new Float32Array(config.count * 3);
        const colors = new Float32Array(config.count * 3);
        const sizes = new Float32Array(config.count);
        const phases = new Float32Array(config.count);
        const freqs = new Float32Array(config.count);
        const brightness = new Float32Array(config.count);

        for (let i = 0; i < config.count; i++) {
            // Position — slightly concentrated toward galactic plane (y ≈ 0)
            const x = (rng() - 0.5) * config.spread;
            const yRaw = (rng() - 0.5);
            const y = yRaw * config.spread * (0.5 + Math.abs(yRaw) * 0.5); // flatten toward plane
            const z = (rng() - 0.5) * config.spread;

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            // Realistic star color distribution (spectral classes)
            const v = rngColor();
            let r: number, g: number, b: number;

            if (v > 0.95) {
                // O/B class — blue-white (hot, rare)
                r = 0.6 + rngColor() * 0.2;
                g = 0.7 + rngColor() * 0.25;
                b = 1.0;
            } else if (v > 0.88) {
                // A class — white with blue tint
                r = 0.85 + rngColor() * 0.15;
                g = 0.88 + rngColor() * 0.12;
                b = 1.0;
            } else if (v > 0.78) {
                // F class — yellow-white
                r = 1.0;
                g = 0.95 + rngColor() * 0.05;
                b = 0.8 + rngColor() * 0.15;
            } else if (v > 0.60) {
                // G class — yellow (sun-like)
                r = 1.0;
                g = 0.9 + rngColor() * 0.1;
                b = 0.6 + rngColor() * 0.2;
            } else if (v > 0.40) {
                // K class — orange
                r = 1.0;
                g = 0.7 + rngColor() * 0.15;
                b = 0.35 + rngColor() * 0.15;
            } else if (v > 0.20) {
                // M class — red (most common)
                r = 1.0;
                g = 0.5 + rngColor() * 0.15;
                b = 0.3 + rngColor() * 0.1;
            } else {
                // Standard white
                const bright = 0.8 + rngColor() * 0.2;
                r = bright;
                g = bright;
                b = bright;
            }

            colors[i * 3] = r;
            colors[i * 3 + 1] = g;
            colors[i * 3 + 2] = b;

            sizes[i] = config.sizeMin + rng() * (config.sizeMax - config.sizeMin);
            phases[i] = rng() * Math.PI * 2;
            freqs[i] = config.twinkleSpeed * (0.3 + rng() * 1.5);
            brightness[i] = config.opacity * (0.5 + rng() * 0.5);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
        geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
        geo.setAttribute("aFreq", new THREE.BufferAttribute(freqs, 1));
        geo.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));

        const mat = new THREE.ShaderMaterial({
            vertexShader: STAR_POINT_VERTEX,
            fragmentShader: STAR_POINT_FRAGMENT,
            uniforms: {
                uTime: { value: 0 },
                uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
            },
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });

        return { geometry: geo, material: mat };
    }, [config, layerIndex]);

    useFrame(({ clock }) => {
        if (material.uniforms) {
            material.uniforms.uTime.value = clock.getElapsedTime();
        }
    });

    return (
        <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
    );
}

// ─── Nebula Dust Cloud ──────────────────────────────────────────────────────

function NebulaCloud() {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const count = 20;

    const { positions, colors, scales } = useMemo(() => {
        const rng = mulberry32(777);
        const pos: THREE.Vector3[] = [];
        const col: THREE.Color[] = [];
        const scl: number[] = [];

        const nebulaColors = [
            new THREE.Color("#1a0a30"),
            new THREE.Color("#0a1a2a"),
            new THREE.Color("#2a0a1a"),
            new THREE.Color("#0a2a2a"),
            new THREE.Color("#1a1a30"),
            new THREE.Color("#200a10"),
        ];

        for (let i = 0; i < count; i++) {
            pos.push(new THREE.Vector3(
                (rng() - 0.5) * 1000,
                (rng() - 0.5) * 400,
                (rng() - 0.5) * 1000
            ));
            col.push(nebulaColors[Math.floor(rng() * nebulaColors.length)]);
            scl.push(80 + rng() * 200);
        }

        return { positions: pos, colors: col, scales: scl };
    }, []);

    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        const mesh = meshRef.current;
        const time = clock.getElapsedTime();

        for (let i = 0; i < count; i++) {
            // Gentle individual drift so nebula clouds slowly wander
            const seed = i * 137.5;
            dummy.position.set(
                positions[i].x + Math.sin(time * 0.015 + seed) * 8,
                positions[i].y + Math.cos(time * 0.01 + seed * 0.7) * 4,
                positions[i].z + Math.sin(time * 0.012 + seed * 1.3) * 8
            );
            const breathe = Math.sin(time * 0.08 + seed) * 0.06 + 1.0;
            dummy.scale.setScalar(scales[i] * breathe);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    });

    const colorArray = useMemo(() => {
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            arr[i * 3] = colors[i].r;
            arr[i * 3 + 1] = colors[i].g;
            arr[i * 3 + 2] = colors[i].b;
        }
        return arr;
    }, [colors]);

    return (
        <instancedMesh
            ref={meshRef}
            args={[undefined, undefined, count]}
            frustumCulled={false}
        >
            <sphereGeometry args={[1, 8, 8]} />
            <meshBasicMaterial
                vertexColors
                transparent
                opacity={0.04}
                depthWrite={false}
                side={THREE.BackSide}
                blending={THREE.AdditiveBlending}
            />
            <instancedBufferAttribute
                attach="geometry-attributes-color"
                args={[colorArray, 3]}
            />
        </instancedMesh>
    );
}

// ─── Main Starfield ─────────────────────────────────────────────────────────

export default function Starfield() {
    const starfieldRef = useRef<THREE.Group>(null);

    // Very slow cosmic drift rotation so the whole background feels alive
    useFrame(({ clock }) => {
        if (starfieldRef.current) {
            const t = clock.getElapsedTime();
            starfieldRef.current.rotation.y = t * 0.012;
            starfieldRef.current.rotation.x = Math.sin(t * 0.006) * 0.004;
        }
    });

    return (
        <group ref={starfieldRef}>
            {LAYER_CONFIG.map((_, i) => (
                <StarLayer key={i} layerIndex={i} />
            ))}
            <NebulaCloud />
        </group>
    );
}
