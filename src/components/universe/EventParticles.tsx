/**
 * Event Particles Component — Cinematic Rewrite
 *
 * Renders historical events as dramatic particle effects:
 * 1. More particles per event (15 instead of 8)
 * 2. Animated expanding/contracting motion
 * 3. Brighter, more visible with additive glow
 * 4. Color-coded by event type with stronger contrast
 * 5. Subtle orbital motion around event source
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

const PARTICLES_PER_EVENT = 15;
const particleGeometry = new THREE.SphereGeometry(1, 5, 5);

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
    STAR_BIRTH: { primary: "#ffd700", secondary: "#ffec80" },
    SUPERNOVA: { primary: "#ff3300", secondary: "#ff8855" },
    WHITE_DWARF: { primary: "#7799cc", secondary: "#aabbdd" },
    BINARY_FORMATION: { primary: "#bb66dd", secondary: "#dd99ff" },
    GALAXY_SPLIT: { primary: "#00ccaa", secondary: "#55eedd" },
    GALAXY_MERGE: { primary: "#7755cc", secondary: "#aa88ee" },
    DEBT_CLEARANCE: { primary: "#44cc44", secondary: "#88ee88" },
    BUS_FACTOR_ALERT: { primary: "#ff4444", secondary: "#ff8888" },
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
                baseRadius: Math.min(event.magnitude * 1.0 + 1.5, 4),
                seed: hashStr(event.id),
                eventType: event.eventType,
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
            orbitSpeed: number;
        }> = [];

        effects.forEach((effect, effectIndex) => {
            const rng = mulberry32(effect.seed);
            for (let i = 0; i < PARTICLES_PER_EVENT; i++) {
                const angle = rng() * Math.PI * 2;
                const elevation = (rng() - 0.5) * Math.PI * 0.5;
                const dist = effect.baseRadius * (0.3 + rng() * 0.7);

                data.push({
                    offset: new THREE.Vector3(
                        Math.cos(angle) * Math.cos(elevation) * dist,
                        Math.sin(elevation) * dist * 0.4,
                        Math.sin(angle) * Math.cos(elevation) * dist
                    ),
                    speed: 0.15 + rng() * 0.4,
                    phase: rng() * Math.PI * 2,
                    radius: 0.02 + rng() * 0.04,
                    effectIndex,
                    orbitSpeed: 0.3 + rng() * 0.5,
                });
            }
        });

        return data;
    }, [effects]);

    const colorArray = useMemo(() => {
        const arr = new Float32Array(totalParticles * 3);
        particleData.forEach((p, i) => {
            const effect = effects[p.effectIndex];
            const color = i % 3 === 0 ? effect.secondaryColor : effect.color;
            arr[i * 3] = color.r * 1.5;
            arr[i * 3 + 1] = color.g * 1.5;
            arr[i * 3 + 2] = color.b * 1.5;
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

            // Orbital motion + breathing expansion
            const orbit = time * p.orbitSpeed + p.phase;
            const breathe = Math.sin(time * 0.5 + p.phase) * 0.2 + 1.0;

            const ox = p.offset.x * breathe;
            const oy = p.offset.y;
            const oz = p.offset.z * breathe;

            const cosO = Math.cos(orbit);
            const sinO = Math.sin(orbit);

            const x = effect.center.x + ox * cosO - oz * sinO;
            const y = effect.center.y + oy + Math.sin(time * p.speed + p.phase) * 0.15;
            const z = effect.center.z + ox * sinO + oz * cosO;

            // Pulsing size
            const pulse = Math.sin(time * 1.5 + p.phase * 2.0) * 0.3 + 0.7;

            dummy.position.set(x, y, z);
            dummy.scale.setScalar(p.radius * pulse);
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
                opacity={0.6}
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
