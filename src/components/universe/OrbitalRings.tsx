/**
 * Orbital Rings Component
 *
 * Renders visible orbital paths around developer suns.
 * These are faint dotted circles that suggest orbital mechanics
 * without being visually dominant.
 */

"use client";

import React, { useMemo, useRef } from "react";
import { Line } from "@react-three/drei";
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
    segments: number = 96
): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const cosInc = Math.cos(inclination);
        const x = radius * Math.cos(angle) * cosInc;
        const y = radius * Math.sin(inclination) * Math.sin(angle * 0.7);
        const z = radius * Math.sin(angle) * cosInc;
        points.push(new THREE.Vector3(x, y, z));
    }
    return points;
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

        const rings: Array<{
            ownerId: string;
            ownerPosition: THREE.Vector3;
            orbitRadius: number;
            inclination: number;
            stellarType: string;
            points: THREE.Vector3[];
        }> = [];

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
                    points: generateOrbitPoints(radius, inclination),
                });
            }
        }

        return rings;
    }, [planets, developers]);

    if (ringData.length === 0) return null;

    return (
        <group ref={groupRef}>
            {ringData.map((ring, i) => {
                const isOwnerSelected = selectedDeveloperId === ring.ownerId;
                const isSolarView = viewLevel === "solar-system";

                // Very faint by default, slightly brighter when focused
                const opacity = isOwnerSelected && isSolarView ? 0.15 : 0.04;
                const color = isOwnerSelected
                    ? getStellarColor(ring.stellarType as StellarType).coronaThree
                    : new THREE.Color(0.3, 0.35, 0.45);

                return (
                    <group key={`${ring.ownerId}-${ring.orbitRadius}-${i}`} position={ring.ownerPosition}>
                        <Line
                            points={ring.points}
                            color={color}
                            lineWidth={0.3}
                            transparent
                            opacity={opacity}
                            depthWrite={false}
                        />
                    </group>
                );
            })}
        </group>
    );
}
