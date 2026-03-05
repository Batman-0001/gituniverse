/**
 * Galaxy Nebula Component — Cinematic Rewrite
 *
 * Renders each galaxy/service as a beautiful cosmic nebula:
 * 1. Spiral arm particle pattern (not random scatter)
 * 2. Glowing volumetric shell with animated rotation
 * 3. Dense star cluster particles in the core
 * 4. Subtle color-shifting dust
 * 5. Clear, readable labels
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

// ─── Spiral Arm Particle Generator ──────────────────────────────────────────

function generateSpiralParticles(
    galaxy: SpatialGalaxy,
    count: number,
    seed: number
) {
    const rng = seededRandom(seed);
    const particles: Array<{
        x: number; y: number; z: number;
        size: number; speed: number; phase: number;
        brightness: number;
    }> = [];

    const numArms = 2 + Math.floor(rng() * 2); // 2-3 arms
    const armWidth = 0.4;

    for (let i = 0; i < count; i++) {
        const armIndex = i % numArms;
        const armAngle = (armIndex / numArms) * Math.PI * 2;

        // Spiral parameter
        const t = rng() * 3.0; // distance from center along arm
        const spiralAngle = armAngle + t * 1.2; // spiral twist
        const dist = (0.15 + t * 0.28) * galaxy.radius;

        // Scatter around arm
        const scatter = (rng() - 0.5) * armWidth * dist * 0.5;
        const yScatter = (rng() - 0.5) * galaxy.radius * 0.15;

        const x = Math.cos(spiralAngle) * dist + scatter * Math.sin(spiralAngle);
        const z = Math.sin(spiralAngle) * dist - scatter * Math.cos(spiralAngle);
        const y = yScatter;

        // Core particles are brighter and larger
        const coreWeight = Math.exp(-t * 1.5);

        particles.push({
            x, y, z,
            size: (0.06 + rng() * 0.12) * (1 + coreWeight),
            speed: 0.02 + rng() * 0.08,
            phase: rng() * Math.PI * 2,
            brightness: 0.3 + coreWeight * 0.7,
        });
    }

    return particles;
}

const DUST_PER_GALAXY = 60;
const dustGeo = new THREE.SphereGeometry(1, 4, 4);

export default function GalaxyNebula({ galaxy }: GalaxyNebulaProps) {
    const shellRef = useRef<THREE.Mesh>(null);
    const coreRef = useRef<THREE.Mesh>(null);
    const dustMeshRef = useRef<THREE.InstancedMesh>(null);

    const { selectedGalaxyId, selectGalaxy, showLabels } = useUniverseStore();
    const isSelected = selectedGalaxyId === galaxy.id;

    const color = useMemo(
        () => new THREE.Color().setHSL(galaxy.colorHue / 360, 0.4, 0.4),
        [galaxy.colorHue]
    );

    const coreColor = useMemo(
        () => new THREE.Color().setHSL(galaxy.colorHue / 360, 0.5, 0.6),
        [galaxy.colorHue]
    );

    const hashSeed = galaxy.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

    // Generate spiral dust particles
    const dustParticles = useMemo(() => {
        return generateSpiralParticles(galaxy, DUST_PER_GALAXY, hashSeed);
    }, [galaxy, hashSeed]);

    const dustColors = useMemo(() => {
        const arr = new Float32Array(DUST_PER_GALAXY * 3);
        const rng = seededRandom(hashSeed * 42);
        for (let i = 0; i < DUST_PER_GALAXY; i++) {
            const t = rng();
            const brightness = dustParticles[i].brightness;
            const c = new THREE.Color().setHSL(
                (galaxy.colorHue + (t - 0.5) * 30) / 360,
                0.3 + t * 0.2,
                0.3 + brightness * 0.4
            );
            arr[i * 3] = c.r;
            arr[i * 3 + 1] = c.g;
            arr[i * 3 + 2] = c.b;
        }
        return arr;
    }, [galaxy.colorHue, hashSeed, dustParticles]);

    const dummy = useMemo(() => new THREE.Object3D(), []);

    useFrame(({ clock }) => {
        const time = clock.getElapsedTime();

        // Shell: gentle rotation
        if (shellRef.current) {
            shellRef.current.rotation.y = time * 0.008;
            shellRef.current.rotation.x = Math.sin(time * 0.003) * 0.02;
        }

        // Core: slow pulsing glow
        if (coreRef.current) {
            const pulse = Math.sin(time * 0.3) * 0.1 + 1.0;
            coreRef.current.scale.setScalar(galaxy.radius * 0.4 * pulse);
            const mat = coreRef.current.material as THREE.MeshBasicMaterial;
            mat.opacity = (isSelected ? 0.08 : 0.04) * pulse;
        }

        // Dust particles: orbit around galaxy center
        if (dustMeshRef.current) {
            const mesh = dustMeshRef.current;
            for (let i = 0; i < dustParticles.length; i++) {
                const p = dustParticles[i];
                const angle = time * p.speed + p.phase;

                // Rotate particles around galaxy center
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);
                const rx = p.x * cosA - p.z * sinA;
                const rz = p.x * sinA + p.z * cosA;

                dummy.position.set(
                    rx,
                    p.y + Math.sin(time * 0.2 + p.phase) * 0.1,
                    rz
                );

                const twinkle = Math.sin(time * 0.8 + p.phase * 3.0) * 0.3 + 0.7;
                dummy.scale.setScalar(p.size * twinkle);
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
            {/* Outer shell — volumetric boundary */}
            <mesh ref={shellRef} onClick={handleClick}>
                <sphereGeometry args={[galaxy.radius, 24, 24]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={isSelected ? 0.06 : 0.025}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Bright core glow */}
            <mesh ref={coreRef}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial
                    color={coreColor}
                    transparent
                    opacity={0.04}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>

            {/* Spiral dust particles */}
            <instancedMesh
                ref={dustMeshRef}
                args={[dustGeo, undefined, DUST_PER_GALAXY]}
                frustumCulled={false}
            >
                <meshBasicMaterial
                    vertexColors
                    transparent
                    opacity={0.45}
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
                    <ringGeometry args={[galaxy.radius * 1.05, galaxy.radius * 1.1, 64]} />
                    <meshBasicMaterial
                        color={coreColor}
                        transparent
                        opacity={0.2}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                        blending={THREE.AdditiveBlending}
                    />
                </mesh>
            )}

            {/* Label — clear and readable */}
            {showLabels && (
                <Billboard follow lockX={false} lockY={false} lockZ={false}>
                    <Text
                        position={[0, galaxy.radius + 2.0, 0]}
                        fontSize={1.0}
                        color={`hsl(${galaxy.colorHue}, 45%, 65%)`}
                        anchorX="center"
                        anchorY="bottom"
                        outlineWidth={0.04}
                        outlineColor="#000000"
                        fillOpacity={isSelected ? 0.9 : 0.4}
                        letterSpacing={0.1}
                    >
                        {galaxy.name.toUpperCase()}
                    </Text>
                    {isSelected && (
                        <Text
                            position={[0, galaxy.radius + 1.0, 0]}
                            fontSize={0.5}
                            color="rgba(255,255,255,0.4)"
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
