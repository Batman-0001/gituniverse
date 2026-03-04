/**
 * Developer Sun Component
 *
 * Renders a developer as a multi-layered glowing star in 3D space.
 *
 * Visual layers:
 * 1. Inner white-hot core (bright, small)
 * 2. Mid surface sphere (stellar color, emissive)
 * 3. Outer corona (translucent, pulsing, bloom-target)
 * 4. Point light (illuminates nearby planets)
 *
 * Size: cube root of normalizedMass × scale factor
 * Color: based on stellarType (blue_giant, yellow_sun, etc.)
 * Pulse: active developers pulse faster (heartbeat metaphor)
 * White dwarfs: dim, small, no pulse
 */

"use client";

import React, { useRef, useMemo } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { getStellarColor, StellarType } from "@/utils/color-utils";
import { useUniverseStore } from "@/stores/universe-store";
import { SpatialDeveloper } from "@/utils/spatial-layout";

interface DeveloperSunProps {
    developer: SpatialDeveloper;
}

export default function DeveloperSun({ developer }: DeveloperSunProps) {
    const coreRef = useRef<THREE.Mesh>(null);
    const surfaceRef = useRef<THREE.Mesh>(null);
    const coronaRef = useRef<THREE.Mesh>(null);
    const glowRef = useRef<THREE.Mesh>(null);
    const lightRef = useRef<THREE.PointLight>(null);

    const {
        selectedDeveloperId,
        hoveredDeveloperId,
        showLabels,
        selectDeveloper,
        hoverDeveloper,
    } = useUniverseStore();

    const isSelected = selectedDeveloperId === developer.id;
    const isHovered = hoveredDeveloperId === developer.id;

    const stellarConfig = useMemo(
        () => getStellarColor(developer.stellarType as StellarType),
        [developer.stellarType]
    );

    const baseRadius = developer.radius;

    // Animate all layers with multiple pulse frequencies
    useFrame(({ clock }) => {
        const time = clock.getElapsedTime();
        const pulseSpeed = developer.isActive
            ? stellarConfig.pulseSpeed
            : stellarConfig.pulseSpeed * 0.15;

        // Core: fast, subtle pulse
        if (coreRef.current) {
            const corePulse = Math.sin(time * pulseSpeed * 1.5) * 0.05 + 1.0;
            coreRef.current.scale.setScalar(baseRadius * 0.55 * corePulse);
            coreRef.current.rotation.y = time * 0.2;
        }

        // Surface: main pulse
        if (surfaceRef.current) {
            const surfacePulse = Math.sin(time * pulseSpeed) * 0.08 + 1.0;
            const hoverScale = isHovered ? 1.12 : 1.0;
            surfaceRef.current.scale.setScalar(baseRadius * surfacePulse * hoverScale);
            surfaceRef.current.rotation.y = time * 0.08;
            surfaceRef.current.rotation.z = Math.sin(time * 0.3) * 0.02;
        }

        // Corona: slow breathe
        if (coronaRef.current) {
            const coronaPulse = Math.sin(time * 0.6 + 0.5) * 0.1 + 1.0;
            coronaRef.current.scale.setScalar(baseRadius * 1.3 * coronaPulse);
            const mat = coronaRef.current.material as THREE.MeshBasicMaterial;
            mat.opacity = (isHovered || isSelected ? 0.1 : 0.04) * coronaPulse;
        }

        // Outer glow: soft radiant halo around the sun
        if (glowRef.current) {
            const glowPulse = Math.sin(time * 0.4 + 1.0) * 0.08 + 1.0;
            glowRef.current.scale.setScalar(baseRadius * 2.5 * glowPulse);
            const mat = glowRef.current.material as THREE.MeshBasicMaterial;
            mat.opacity = (isHovered || isSelected ? 0.2 : 0.12) * glowPulse;
        }

        // Point light intensity follows pulse
        if (lightRef.current) {
            const lightPulse = Math.sin(time * pulseSpeed) * 0.3 + 1.0;
            lightRef.current.intensity = (developer.normalizedMass * 0.02 + 0.5) * lightPulse;
        }
    });

    const handleClick = (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        selectDeveloper(isSelected ? null : developer.id);
    };

    const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        hoverDeveloper(developer.id);
        document.body.style.cursor = "pointer";
    };

    const handlePointerOut = () => {
        hoverDeveloper(null);
        document.body.style.cursor = "auto";
    };

    return (
        <group position={developer.position}>
            {/* Layer 4: Outer glow (large, soft, additive radiance) */}
            <mesh ref={glowRef}>
                <sphereGeometry args={[1, 24, 24]} />
                <meshBasicMaterial
                    color={stellarConfig.coronaThree}
                    transparent
                    opacity={0.12}
                    depthWrite={false}
                    side={THREE.BackSide}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>

            {/* Layer 3: Corona (medium, translucent, bloom target) */}
            <mesh ref={coronaRef}>
                <sphereGeometry args={[1, 20, 20]} />
                <meshBasicMaterial
                    color={stellarConfig.coronaThree}
                    transparent
                    opacity={0.1}
                    depthWrite={false}
                    side={THREE.BackSide}
                />
            </mesh>

            {/* Layer 2: Surface (main star body, emissive) */}
            <mesh
                ref={surfaceRef}
                onClick={handleClick}
                onPointerOver={handlePointerOver}
                onPointerOut={handlePointerOut}
            >
                <sphereGeometry args={[1, 32, 32]} />
                <meshStandardMaterial
                    color={stellarConfig.coreThree}
                    emissive={stellarConfig.coreThree}
                    emissiveIntensity={stellarConfig.emissiveIntensity}
                    roughness={0.3}
                    metalness={0.0}
                    toneMapped={false}
                />
            </mesh>

            {/* Layer 1: White-hot inner core */}
            <mesh ref={coreRef}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial
                    color="#ffffff"
                    toneMapped={false}
                />
            </mesh>

            {/* Point light to illuminate nearby planets */}
            <pointLight
                ref={lightRef}
                color={stellarConfig.coreThree}
                intensity={developer.normalizedMass * 0.03 + 0.6}
                distance={30}
                decay={2}
            />

            {/* Selection ring */}
            {isSelected && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[baseRadius * 2.2, baseRadius * 2.5, 64]} />
                    <meshBasicMaterial
                        color={stellarConfig.coreThree}
                        transparent
                        opacity={0.7}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                        blending={THREE.AdditiveBlending}
                    />
                </mesh>
            )}

            {/* Developer Name Label */}
            {showLabels && (
                <Billboard follow lockX={false} lockY={false} lockZ={false}>
                    <Text
                        position={[0, baseRadius + 1.5, 0]}
                        fontSize={0.8}
                        color="#ffffff"
                        anchorX="center"
                        anchorY="bottom"
                        outlineWidth={0.04}
                        outlineColor="#000000"
                        fillOpacity={isHovered || isSelected ? 1.0 : 0.55}
                    >
                        {developer.name}
                    </Text>
                    {(isHovered || isSelected) && (
                        <>
                            <Text
                                position={[0, baseRadius + 0.6, 0]}
                                fontSize={0.45}
                                color={stellarConfig.core}
                                anchorX="center"
                                anchorY="bottom"
                                outlineWidth={0.02}
                                outlineColor="#000000"
                            >
                                {`⭐ Mass ${developer.normalizedMass.toFixed(1)} · ${developer.totalCommits} commits`}
                            </Text>
                            <Text
                                position={[0, baseRadius + 0.1, 0]}
                                fontSize={0.35}
                                color="rgba(255,255,255,0.4)"
                                anchorX="center"
                                anchorY="bottom"
                                outlineWidth={0.02}
                                outlineColor="#000000"
                            >
                                {`${developer.totalFilesOwned} files · ${developer.totalLinesAuthored} lines`}
                            </Text>
                        </>
                    )}
                </Billboard>
            )}
        </group>
    );
}
