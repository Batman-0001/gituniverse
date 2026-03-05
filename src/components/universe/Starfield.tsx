/**
 * Background Starfield
 *
 * 12,000 instanced background stars across 3 parallax layers.
 * Uses InstancedMesh for a single draw call per layer.
 * Subtle twinkle effect — stars gently pulse at different frequencies.
 * Three depth layers create a convincing parallax effect.
 */

"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const LAYER_CONFIG = [
    { count: 5000, spread: 600, sizeMin: 0.04, sizeMax: 0.20, twinkleSpeed: 0.6, name: "far" },
    { count: 4000, spread: 800, sizeMin: 0.06, sizeMax: 0.28, twinkleSpeed: 0.8, name: "mid" },
    { count: 3000, spread: 1100, sizeMin: 0.08, sizeMax: 0.40, twinkleSpeed: 1.0, name: "near" },
];

const starGeometry = new THREE.SphereGeometry(1, 4, 4);

function mulberry32(seed: number) {
    return () => {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

interface StarData {
    x: number; y: number; z: number;
    size: number; twinklePhase: number; twinkleFreq: number;
}

function generateLayerStars(layerIndex: number): StarData[] {
    const config = LAYER_CONFIG[layerIndex];
    const rng = mulberry32(42 + layerIndex * 1000);
    const data: StarData[] = [];

    for (let i = 0; i < config.count; i++) {
        data.push({
            x: (rng() - 0.5) * config.spread,
            y: (rng() - 0.5) * config.spread,
            z: (rng() - 0.5) * config.spread,
            size: config.sizeMin + rng() * (config.sizeMax - config.sizeMin),
            twinklePhase: rng() * Math.PI * 2,
            twinkleFreq: config.twinkleSpeed * (0.5 + rng() * 1.0),
        });
    }
    return data;
}

function generateLayerColors(layerIndex: number): Float32Array {
    const config = LAYER_CONFIG[layerIndex];
    const rng = mulberry32(123 + layerIndex * 500);
    const arr = new Float32Array(config.count * 3);

    for (let i = 0; i < config.count; i++) {
        const v = rng();
        if (v > 0.90) {
            // Blue-white stars
            arr[i * 3] = 0.6 + rng() * 0.3;
            arr[i * 3 + 1] = 0.7 + rng() * 0.3;
            arr[i * 3 + 2] = 1.0;
        } else if (v > 0.82) {
            // Warm yellow-orange stars
            arr[i * 3] = 1.0;
            arr[i * 3 + 1] = 0.85 + rng() * 0.15;
            arr[i * 3 + 2] = 0.5 + rng() * 0.3;
        } else if (v > 0.78) {
            // Faint pink-red stars
            arr[i * 3] = 0.9 + rng() * 0.1;
            arr[i * 3 + 1] = 0.5 + rng() * 0.2;
            arr[i * 3 + 2] = 0.5 + rng() * 0.2;
        } else {
            // Standard white stars (majority)
            const brightness = 0.75 + rng() * 0.25;
            arr[i * 3] = brightness;
            arr[i * 3 + 1] = brightness;
            arr[i * 3 + 2] = brightness;
        }
    }
    return arr;
}

// Pre-compute all data
const PRECOMPUTED_LAYERS = LAYER_CONFIG.map((_, i) => ({
    stars: generateLayerStars(i),
    colors: generateLayerColors(i),
}));

interface StarLayerProps {
    layerIndex: number;
}

function StarLayer({ layerIndex }: StarLayerProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const config = LAYER_CONFIG[layerIndex];
    const { stars } = PRECOMPUTED_LAYERS[layerIndex];
    const initRef = useRef(false);

    // Store original scales for twinkle
    const originalScales = useMemo(() => {
        return stars.map((s) => s.size * 0.6);
    }, [stars]);

    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        const mesh = meshRef.current;
        const time = clock.getElapsedTime();

        if (!initRef.current) {
            // First frame — set positions
            initRef.current = true;
            for (let i = 0; i < config.count; i++) {
                const star = stars[i];
                dummy.position.set(star.x, star.y, star.z);
                dummy.scale.setScalar(originalScales[i]);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            }
            mesh.instanceMatrix.needsUpdate = true;
            return;
        }

        // Twinkle animation — only update a subset each frame for performance
        const batchSize = Math.ceil(config.count / 8);
        const batchIndex = Math.floor(time * 4) % 8;
        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, config.count);

        for (let i = start; i < end; i++) {
            const star = stars[i];
            const twinkle = Math.sin(time * star.twinkleFreq + star.twinklePhase) * 0.25 + 0.85;
            dummy.position.set(star.x, star.y, star.z);
            dummy.scale.setScalar(originalScales[i] * twinkle);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh
            ref={meshRef}
            args={[starGeometry, undefined, config.count]}
            frustumCulled={false}
        >
            <meshBasicMaterial
                vertexColors
                transparent
                opacity={layerIndex === 0 ? 0.35 : layerIndex === 1 ? 0.5 : 0.7}
                depthWrite={false}
            />
            <instancedBufferAttribute
                attach="geometry-attributes-color"
                args={[PRECOMPUTED_LAYERS[layerIndex].colors, 3]}
            />
        </instancedMesh>
    );
}

export default function Starfield() {
    return (
        <group>
            {LAYER_CONFIG.map((_, i) => (
                <StarLayer key={i} layerIndex={i} />
            ))}
        </group>
    );
}
