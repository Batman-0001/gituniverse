/**
 * Event Particles Component
 *
 * Very subtle ambient particle markers at event locations.
 * These are tiny, sparse dots that hint at history — not fireworks.
 * Reduced count, smaller size, lower opacity.
 */

"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SpatialDeveloper } from "@/utils/spatial-layout";
import { TemporalEvent } from "@/stores/universe-store";

interface EventParticlesProps {
    events: TemporalEvent[];
    developers: Map<string, SpatialDeveloper>;
}

const PARTICLES_PER_EVENT = 8;
const particleGeometry = new THREE.SphereGeometry(1, 3, 3);

function mulberry32(seed: number) {
    return () => {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function hashStr(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) - hash) + s.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

const EVENT_COLORS: Record<string, { primary: string; secondary: string }> = {
    STAR_BIRTH: { primary: "#c9a84c", secondary: "#e8d5a0" },
    SUPERNOVA: { primary: "#a03030", secondary: "#cc6644" },
    WHITE_DWARF: { primary: "#6a7a88", secondary: "#8a9aaa" },
    BINARY_FORMATION: { primary: "#8a6a9a", secondary: "#b090c0" },
    GALAXY_SPLIT: { primary: "#4a8a8a", secondary: "#6aaa9a" },
    GALAXY_MERGE: { primary: "#5a4a8a", secondary: "#8a7aaa" },
    DEBT_CLEARANCE: { primary: "#5a8a5a", secondary: "#7aaa7a" },
    BUS_FACTOR_ALERT: { primary: "#a04040", secondary: "#cc6666" },
};

export default function EventParticles({ events, developers }: EventParticlesProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    const effects = useMemo(() => {
        const visible = events
            .filter((e) => e.developerId && developers.has(e.developerId))
            .slice(0, 15);

        return visible.map((event) => {
            const dev = developers.get(event.developerId!);
            const center = dev ? dev.position.clone() : new THREE.Vector3();
            const colors = EVENT_COLORS[event.eventType] || EVENT_COLORS.STAR_BIRTH;

            return {
                eventId: event.id,
                center,
                color: new THREE.Color(colors.primary),
                secondaryColor: new THREE.Color(colors.secondary),
                baseRadius: Math.min(event.magnitude * 0.8 + 1, 3),
                seed: hashStr(event.id),
            };
        });
    }, [events, developers]);

    const totalParticles = effects.length * PARTICLES_PER_EVENT;

    const particleData = useMemo(() => {
        const data: Array<{
            offset: THREE.Vector3;
            speed: number;
            phase: number;
            radius: number;
            effectIndex: number;
        }> = [];

        effects.forEach((effect, effectIndex) => {
            const rng = mulberry32(effect.seed);
            for (let i = 0; i < PARTICLES_PER_EVENT; i++) {
                const angle = rng() * Math.PI * 2;
                const elevation = (rng() - 0.5) * Math.PI * 0.4;
                const dist = effect.baseRadius * (0.4 + rng() * 0.6);

                data.push({
                    offset: new THREE.Vector3(
                        Math.cos(angle) * Math.cos(elevation) * dist,
                        Math.sin(elevation) * dist * 0.3,
                        Math.sin(angle) * Math.cos(elevation) * dist
                    ),
                    speed: 0.1 + rng() * 0.3,
                    phase: rng() * Math.PI * 2,
                    radius: 0.015 + rng() * 0.025,
                    effectIndex,
                });
            }
        });

        return data;
    }, [effects]);

    const colorArray = useMemo(() => {
        const arr = new Float32Array(totalParticles * 3);
        particleData.forEach((p, i) => {
            const effect = effects[p.effectIndex];
            const color = i % 2 === 0 ? effect.color : effect.secondaryColor;
            arr[i * 3] = color.r;
            arr[i * 3 + 1] = color.g;
            arr[i * 3 + 2] = color.b;
        });
        return arr;
    }, [particleData, effects, totalParticles]);

    useFrame(({ clock }) => {
        if (!meshRef.current || totalParticles === 0) return;
        const mesh = meshRef.current;
        const time = clock.getElapsedTime();

        for (let i = 0; i < particleData.length; i++) {
            const p = particleData[i];
            const effect = effects[p.effectIndex];

            const angle = time * p.speed + p.phase;
            const x = effect.center.x + p.offset.x * Math.cos(angle) - p.offset.z * Math.sin(angle);
            const y = effect.center.y + p.offset.y;
            const z = effect.center.z + p.offset.x * Math.sin(angle) + p.offset.z * Math.cos(angle);

            dummy.position.set(x, y, z);
            dummy.scale.setScalar(p.radius);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    });

    if (totalParticles === 0) return null;

    return (
        <instancedMesh
            ref={meshRef}
            args={[particleGeometry, undefined, totalParticles]}
            frustumCulled={false}
        >
            <meshBasicMaterial
                vertexColors
                transparent
                opacity={0.3}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                toneMapped={false}
            />
            {colorArray.length > 0 && (
                <instancedBufferAttribute
                    attach="geometry-attributes-color"
                    args={[colorArray, 3]}
                />
            )}
        </instancedMesh>
    );
}
