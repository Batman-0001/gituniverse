/**
 * Orbital Rings Component — Cinematic Rewrite
 *
 * Renders orbital paths with:
 * 1. Animated dashed lines (flowing energy feel)
 * 2. Subtle glow on selection
 * 3. Proper 3D elliptical orbits
 * 4. More visible default state
 */

"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SpatialDeveloper, SpatialPlanet } from "@/utils/spatial-layout";
import { getStellarColor, StellarType } from "@/utils/color-utils";
import { useUniverseStore } from "@/stores/universe-store";

interface OrbitalRingsProps {
    planets: SpatialPlanet[];
    developers: Map<string, SpatialDeveloper>;
}

function generateOrbitPoints(
    radius: number,
    inclination: number,
    segments: number = 128
): Float32Array {
    const points = new Float32Array((segments + 1) * 3);
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const cosInc = Math.cos(inclination);
        const x = radius * Math.cos(angle) * cosInc;
        const y = radius * Math.sin(inclination) * Math.sin(angle * 0.7);
        const z = radius * Math.sin(angle) * cosInc;
        points[i * 3] = x;
        points[i * 3 + 1] = y;
        points[i * 3 + 2] = z;
    }
    return points;
}

// Custom orbit ring shader
const ORBIT_VERTEX = /* glsl */ `
attribute float aProgress;
varying float vProgress;
varying float vDist;

void main() {
    vProgress = aProgress;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vDist = length(mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const ORBIT_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
uniform float uDashScale;

varying float vProgress;
varying float vDist;

void main() {
    // Animated dashes
    float dash = sin((vProgress * uDashScale + uTime * 0.3) * 3.14159 * 2.0);
    dash = smoothstep(-0.2, 0.2, dash);

    // Fade with distance for depth
    float distFade = clamp(200.0 / vDist, 0.3, 1.0);

    float alpha = dash * uOpacity * distFade;
    if (alpha < 0.01) discard;

    gl_FragColor = vec4(uColor, alpha);
}
`;

interface RingData {
    ownerId: string;
    ownerPosition: THREE.Vector3;
    orbitRadius: number;
    inclination: number;
    stellarType: string;
}

export default function OrbitalRings({ planets, developers }: OrbitalRingsProps) {
    const groupRef = useRef<THREE.Group>(null);
    const { selectedDeveloperId, viewLevel } = useUniverseStore();

    const ringData = useMemo(() => {
        const ownerPlanets = new Map<string, SpatialPlanet[]>();
        for (const p of planets) {
            if (!ownerPlanets.has(p.ownerId)) ownerPlanets.set(p.ownerId, []);
            ownerPlanets.get(p.ownerId)!.push(p);
        }

        const rings: RingData[] = [];

        for (const [ownerId, ownerPlanets_] of ownerPlanets) {
            const dev = developers.get(ownerId);
            if (!dev) continue;

            const radiusSet = new Map<number, number>();
            for (const p of ownerPlanets_) {
                const quantized = Math.round(p.orbitRadius * 4) / 4;
                if (!radiusSet.has(quantized)) {
                    radiusSet.set(quantized, p.orbitInclination);
                }
            }

            for (const [radius, inclination] of radiusSet) {
                rings.push({
                    ownerId,
                    ownerPosition: dev.position,
                    orbitRadius: radius,
                    inclination,
                    stellarType: dev.stellarType,
                });
            }
        }

        return rings;
    }, [planets, developers]);

    // Create line geometries and materials
    const ringMeshes = useMemo(() => {
        return ringData.map((ring) => {
            const segments = 128;
            const positions = generateOrbitPoints(ring.orbitRadius, ring.inclination, segments);

            // Progress attribute for dash animation
            const progress = new Float32Array(segments + 1);
            for (let i = 0; i <= segments; i++) {
                progress[i] = i / segments;
            }

            const geo = new THREE.BufferGeometry();
            geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            geo.setAttribute("aProgress", new THREE.BufferAttribute(progress, 1));

            const isOwnerSelected = selectedDeveloperId === ring.ownerId;
            const isSolarView = viewLevel === "solar-system";

            const stellarColor = isOwnerSelected
                ? getStellarColor(ring.stellarType as StellarType).coronaThree
                : new THREE.Color(0.35, 0.4, 0.55);

            const mat = new THREE.ShaderMaterial({
                vertexShader: ORBIT_VERTEX,
                fragmentShader: ORBIT_FRAGMENT,
                uniforms: {
                    uColor: { value: stellarColor },
                    uOpacity: { value: isOwnerSelected && isSolarView ? 0.3 : 0.08 },
                    uTime: { value: 0 },
                    uDashScale: { value: 20 + ring.orbitRadius * 2 },
                },
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            });

            return { geometry: geo, material: mat, ring };
        });
    }, [ringData, selectedDeveloperId, viewLevel]);

    useFrame(({ clock }) => {
        const time = clock.getElapsedTime();
        for (const { material } of ringMeshes) {
            material.uniforms.uTime.value = time;
        }
    });

    if (ringMeshes.length === 0) return null;

    return (
        <group ref={groupRef}>
            {ringMeshes.map(({ geometry, material, ring }, i) => (
                <lineLoop
                    key={`${ring.ownerId}-${ring.orbitRadius}-${i}`}
                    geometry={geometry}
                    material={material}
                    position={ring.ownerPosition}
                />
            ))}
        </group>
    );
}
