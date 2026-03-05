/**
 * Galaxy Nebula Component
 *
 * Renders each galaxy/service as a SUBTLE volumetric hint — not a solid ball.
 *
 * Design philosophy:
 * - Nebulae should be barely visible at the universe level — they're "background context"
 * - They should be translucent wisps of color, not opaque solids
 * - The dust particles are the main visual; the shell is just a faint tint
 * - Labels are minimal and don't compete with developer stars
 */

"use client";

import React, { useRef, useMemo } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { SpatialGalaxy } from "@/utils/spatial-layout";
import { useUniverseStore } from "@/stores/universe-store";

interface GalaxyNebulaProps {
    galaxy: SpatialGalaxy;
}

function seededRandom(seed: number) {
    return () => {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

const dustGeo = new THREE.SphereGeometry(1, 3, 3);
const DUST_PER_GALAXY = 25;

export default function GalaxyNebula({ galaxy }: GalaxyNebulaProps) {
    const shellRef = useRef<THREE.Mesh>(null);
    const dustMeshRef = useRef<THREE.InstancedMesh>(null);

    const { selectedGalaxyId, selectGalaxy, showLabels } = useUniverseStore();
    const isSelected = selectedGalaxyId === galaxy.id;

    const color = useMemo(
        () => new THREE.Color().setHSL(galaxy.colorHue / 360, 0.25, 0.3),
        [galaxy.colorHue]
    );

    // Dust particles — sparse, small, translucent
    const dustParticles = useMemo(() => {
        const hashSeed = galaxy.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
        const rng = seededRandom(hashSeed);
        const particles: Array<{
            x: number; y: number; z: number;
            size: number; speed: number; phase: number;
        }> = [];

        for (let i = 0; i < DUST_PER_GALAXY; i++) {
            const angle = rng() * Math.PI * 2;
            const elevation = (rng() - 0.5) * Math.PI * 0.4;
            const dist = galaxy.radius * (0.3 + rng() * 0.8);

            particles.push({
                x: Math.cos(angle) * Math.cos(elevation) * dist,
                y: Math.sin(elevation) * dist * 0.25,
                z: Math.sin(angle) * Math.cos(elevation) * dist,
                size: 0.03 + rng() * 0.06,
                speed: 0.02 + rng() * 0.06,
                phase: rng() * Math.PI * 2,
            });
        }
        return particles;
    }, [galaxy.name, galaxy.radius]);

    const dustColors = useMemo(() => {
        const arr = new Float32Array(DUST_PER_GALAXY * 3);
        const rng = seededRandom(galaxy.name.length * 42);
        for (let i = 0; i < DUST_PER_GALAXY; i++) {
            const t = rng();
            const c = new THREE.Color().setHSL(
                (galaxy.colorHue + (t - 0.5) * 20) / 360,
                0.2 + t * 0.15,
                0.4 + t * 0.2
            );
            arr[i * 3] = c.r;
            arr[i * 3 + 1] = c.g;
            arr[i * 3 + 2] = c.b;
        }
        return arr;
    }, [galaxy.colorHue, galaxy.name]);

    const dummy = useMemo(() => new THREE.Object3D(), []);

    useFrame(({ clock }) => {
        const time = clock.getElapsedTime();

        // Shell: very slow rotation, subtle
        if (shellRef.current) {
            shellRef.current.rotation.y = time * 0.005;
        }

        // Dust: gentle drift
        if (dustMeshRef.current) {
            const mesh = dustMeshRef.current;
            for (let i = 0; i < dustParticles.length; i++) {
                const p = dustParticles[i];
                const angle = time * p.speed + p.phase;

                dummy.position.set(
                    p.x + Math.sin(angle * 0.5) * 0.2,
                    p.y + Math.sin(angle * 0.8 + p.phase) * 0.1,
                    p.z + Math.cos(angle * 0.3) * 0.15
                );
                dummy.scale.setScalar(p.size);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            }
            mesh.instanceMatrix.needsUpdate = true;
        }
    });

    const handleClick = (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        selectGalaxy(isSelected ? null : galaxy.id);
    };

    return (
        <group position={galaxy.position}>
            {/* Single very faint shell — just a tint, not a solid */}
            <mesh ref={shellRef} onClick={handleClick}>
                <sphereGeometry args={[galaxy.radius, 16, 16]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={isSelected ? 0.04 : 0.015}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Sparse dust field */}
            <instancedMesh
                ref={dustMeshRef}
                args={[dustGeo, undefined, DUST_PER_GALAXY]}
                frustumCulled={false}
            >
                <meshBasicMaterial
                    vertexColors
                    transparent
                    opacity={0.25}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                    toneMapped={false}
                />
                <instancedBufferAttribute
                    attach="geometry-attributes-color"
                    args={[dustColors, 3]}
                />
            </instancedMesh>

            {/* Selection ring */}
            {isSelected && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[galaxy.radius * 1.05, galaxy.radius * 1.08, 48]} />
                    <meshBasicMaterial
                        color={color}
                        transparent
                        opacity={0.15}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                    />
                </mesh>
            )}

            {/* Label — minimal, unobtrusive */}
            {showLabels && (
                <Billboard follow lockX={false} lockY={false} lockZ={false}>
                    <Text
                        position={[0, galaxy.radius + 1.5, 0]}
                        fontSize={0.8}
                        color={`hsl(${galaxy.colorHue}, 30%, 55%)`}
                        anchorX="center"
                        anchorY="bottom"
                        outlineWidth={0.03}
                        outlineColor="#000000"
                        fillOpacity={isSelected ? 0.8 : 0.3}
                        letterSpacing={0.08}
                    >
                        {galaxy.name.toUpperCase()}
                    </Text>
                    {isSelected && (
                        <Text
                            position={[0, galaxy.radius + 0.8, 0]}
                            fontSize={0.4}
                            color="rgba(255,255,255,0.3)"
                            anchorX="center"
                            anchorY="bottom"
                        >
                            {`${galaxy.totalFiles} files · ${galaxy.totalDevelopers} devs`}
                        </Text>
                    )}
                </Billboard>
            )}
        </group>
    );
}
