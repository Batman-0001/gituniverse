/**
 * Commit Planets Component
 *
 * Renders files as proper 3D planets orbiting their developer suns.
 * Each planet is an individual mesh with procedural GLSL shaders,
 * atmosphere rim glow, and optional Saturn-like rings.
 *
 * Orbital animation is handled by this wrapper component which
 * computes each planet's position per frame via group refs.
 */

"use client";

import React, { useRef, useMemo, useState, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { SpatialPlanet, SpatialDeveloper } from "@/utils/spatial-layout";
import Planet from "./Planet";

interface CommitPlanetsProps {
    planets: SpatialPlanet[];
    developers: Map<string, SpatialDeveloper>;
}

interface HoverInfo {
    fileName: string;
    fileType: string;
    totalModifications: number;
    totalLinesOfCode: number;
    position: THREE.Vector3;
}

// Reusable vector for orbital position computation
const _orbitVec = new THREE.Vector3();

export default function CommitPlanets({ planets, developers }: CommitPlanetsProps) {
    const groupRef = useRef<THREE.Group>(null);
    const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

    // Store refs to each orbiting group so we can move them per frame
    const orbitRefs = useRef<Map<number, THREE.Group>>(new Map());

    // Filter to planets whose owner exists in the dev map
    const validPlanets = useMemo(() => {
        return planets.filter((p) => developers.has(p.ownerId));
    }, [planets, developers]);

    const handleHover = useCallback((info: HoverInfo | null) => {
        setHoverInfo(info);
    }, []);

    // Animate orbital positions each frame
    useFrame(({ clock }) => {
        const time = clock.getElapsedTime();

        for (let i = 0; i < validPlanets.length; i++) {
            const planet = validPlanets[i];
            const owner = developers.get(planet.ownerId);
            const ref = orbitRefs.current.get(i);
            if (!owner || !ref) continue;

            const angle = planet.orbitAngle + time * planet.orbitSpeed * 0.8;
            const cosAngle = Math.cos(angle);
            const sinAngle = Math.sin(angle);
            const cosInc = Math.cos(planet.orbitInclination);

            _orbitVec.set(
                owner.position.x + planet.orbitRadius * cosAngle * cosInc,
                owner.position.y +
                planet.orbitRadius *
                Math.sin(planet.orbitInclination) *
                Math.sin(angle * 0.7),
                owner.position.z + planet.orbitRadius * sinAngle * cosInc
            );

            ref.position.copy(_orbitVec);
        }
    });

    if (validPlanets.length === 0) return null;

    return (
        <group ref={groupRef}>
            {validPlanets.map((planet, i) => (
                <group
                    key={planet.id}
                    ref={(el) => {
                        if (el) orbitRefs.current.set(i, el);
                        else orbitRefs.current.delete(i);
                    }}
                >
                    <Planet
                        position={[0, 0, 0]}
                        radius={planet.radius}
                        fileType={planet.fileType}
                        fileName={planet.fileName}
                        path={planet.path}
                        totalModifications={planet.totalModifications}
                        totalLinesOfCode={planet.totalLinesOfCode}
                        hasRings={planet.hasRings}
                        planetId={planet.id}
                        onHover={handleHover}
                    />
                </group>
            ))}

            {/* Floating hover tooltip */}
            {hoverInfo && (
                <Billboard
                    follow
                    lockX={false}
                    lockY={false}
                    lockZ={false}
                    position={[
                        hoverInfo.position.x,
                        hoverInfo.position.y + 1.2,
                        hoverInfo.position.z,
                    ]}
                >
                    <Text
                        fontSize={0.4}
                        color="#ffffff"
                        anchorX="center"
                        anchorY="bottom"
                        outlineWidth={0.03}
                        outlineColor="#000000"
                        maxWidth={6}
                    >
                        {hoverInfo.fileName}
                    </Text>
                    <Text
                        position={[0, -0.4, 0]}
                        fontSize={0.25}
                        color="rgba(255,255,255,0.5)"
                        anchorX="center"
                        anchorY="bottom"
                        outlineWidth={0.02}
                        outlineColor="#000000"
                    >
                        {`${hoverInfo.fileType} · ${hoverInfo.totalModifications} mods · ${hoverInfo.totalLinesOfCode} lines`}
                    </Text>
                </Billboard>
            )}
        </group>
    );
}
