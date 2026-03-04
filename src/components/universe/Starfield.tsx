/**
 * Background Starfield
 *
 * 8,000 instanced background stars across 3 parallax layers.
 * Uses InstancedMesh for a single draw call.
 * Subtle, gentle twinkle — not distracting.
 */

"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const STAR_COUNT = 8000;
const STAR_SPREAD = 900;

// Pre-create geometry + material
const starGeometry = new THREE.SphereGeometry(1, 4, 4);

// Seeded PRNG for deterministic star generation (avoids React strict mode warnings)
function mulberry32(seed: number) {
    return () => {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// Pre-compute star data outside of React render cycle
function generateStarData() {
    const rng = mulberry32(42);
    const data: Array<{
        x: number; y: number; z: number;
        size: number; speed: number; layer: number; baseOpacity: number;
    }> = [];

    for (let i = 0; i < STAR_COUNT; i++) {
        const layer = i < STAR_COUNT * 0.5 ? 0 : i < STAR_COUNT * 0.8 ? 1 : 2;
        const spread = STAR_SPREAD * (1 + layer * 0.5);
        data.push({
            x: (rng() - 0.5) * spread,
            y: (rng() - 0.5) * spread,
            z: (rng() - 0.5) * spread,
            size: rng() * 0.3 + 0.05 + layer * 0.05,
            speed: rng() * 2 + 0.5,
            layer,
            baseOpacity: rng() * 0.6 + 0.2,
        });
    }
    return data;
}

function generateStarColors() {
    const rng = mulberry32(123);
    const arr = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
        const v = rng();
        if (v > 0.92) {
            arr[i * 3] = 0.6 + rng() * 0.3;
            arr[i * 3 + 1] = 0.7 + rng() * 0.3;
            arr[i * 3 + 2] = 1.0;
        } else if (v > 0.85) {
            arr[i * 3] = 1.0;
            arr[i * 3 + 1] = 0.85 + rng() * 0.15;
            arr[i * 3 + 2] = 0.5 + rng() * 0.3;
        } else {
            const brightness = 0.8 + rng() * 0.2;
            arr[i * 3] = brightness;
            arr[i * 3 + 1] = brightness;
            arr[i * 3 + 2] = brightness;
        }
    }
    return arr;
}

const PRECOMPUTED_STARS = generateStarData();
const PRECOMPUTED_COLORS = generateStarColors();

export default function Starfield() {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const stars = PRECOMPUTED_STARS;
    const colors = PRECOMPUTED_COLORS;

    // Static stars — no twinkling, just set positions once
    const initRef = useRef(false);
    useFrame(() => {
        if (!meshRef.current || initRef.current) return;
        const mesh = meshRef.current;

        // Initialize all positions once — no animation
        initRef.current = true;
        for (let i = 0; i < STAR_COUNT; i++) {
            const star = stars[i];
            dummy.position.set(star.x, star.y, star.z);
            dummy.scale.setScalar(star.size * 0.6);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh
            ref={meshRef}
            args={[starGeometry, undefined, STAR_COUNT]}
            frustumCulled={false}
        >
            <meshBasicMaterial
                vertexColors
                transparent
                opacity={0.5}
                depthWrite={false}
            />
            <instancedBufferAttribute
                attach="geometry-attributes-color"
                args={[colors, 3]}
            />
        </instancedMesh>
    );
}
