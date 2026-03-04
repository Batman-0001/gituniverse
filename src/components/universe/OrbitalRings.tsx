/**
 * Orbital Rings Component
 *
 * Renders visible orbital paths (ellipses) around each developer sun.
 * When the camera zooms into a solar-system view, orbit rings become
 * prominent with a subtle animated glow and dashed-line style.
 *
 * Each ring corresponds to a distinct orbit radius where planets travel.
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

// Generate points for an inclined elliptical orbit
function generateOrbitPoints(
    radius: number,
    inclination: number,
    segments: number = 128
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
    // Group planets by owner and deduce distinct orbit radii + inclinations
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

            // Collect unique orbit radii (quantized to reduce ring count)
            const radiusSet = new Map<number, number>(); // quantized radius -> inclination
            for (const p of ownerPlanets_) {
                const quantized = Math.round(p.orbitRadius * 4) / 4; // 0.25 step
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
                const stellarColor = getStellarColor(ring.stellarType as StellarType);
                const isOwnerSelected = selectedDeveloperId === ring.ownerId;
                const isSolarView = viewLevel === "solar-system";

                const baseOpacity = isOwnerSelected && isSolarView ? 0.5 : 0.12;
                const color = isOwnerSelected
                    ? stellarColor.coreThree
                    : new THREE.Color(0.4, 0.5, 0.7);

                return (
                    <group key={`${ring.ownerId}-${ring.orbitRadius}-${i}`} position={ring.ownerPosition}>
                        <Line
                            points={ring.points}
                            color={color}
                            lineWidth={isOwnerSelected && isSolarView ? 1.2 : 0.5}
                            transparent
                            opacity={baseOpacity}
                            depthWrite={false}
                        />
                    </group>
                );
            })}
        </group>
    );
}
