/**
 * Developer Sun Component
 *
 * Renders a developer as a realistic star with soft light scattering.
 *
 * Design philosophy:
 * - Stars should look like distant, glowing spheres of plasma — NOT flat circles.
 * - The core is small and bright, surrounded by layers of gradually fading glow.
 * - Pulse effects are SUBTLE (2-5% scale variation), not cartoonish bouncing.
 * - Colors are desaturated and natural, not neon.
 * - Bus factor warning is a gentle indicator, not an alarm.
 *
 * Visual layers:
 * 1. Compact bright core (white-hot)
 * 2. Surface sphere (stellar color, emissive but moderated)
 * 3. Soft inner glow (additive, very transparent)
 * 4. Point light (illuminates nearby planets naturally)
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
    const isBusFactorRisk = developer.stellarType === "red_giant";

    useFrame(({ clock }) => {
        const time = clock.getElapsedTime();
        const pulseSpeed = developer.isActive
            ? stellarConfig.pulseSpeed
            : stellarConfig.pulseSpeed * 0.15;

        // Core: very subtle pulse (2-3%)
        if (coreRef.current) {
            const corePulse = Math.sin(time * pulseSpeed * 1.3) * 0.02 + 1.0;
            coreRef.current.scale.setScalar(baseRadius * 0.4 * corePulse);
        }

        // Surface: gentle breath (3-4%)
        if (surfaceRef.current) {
            const surfacePulse = Math.sin(time * pulseSpeed * 0.7) * 0.03 + 1.0;
            const hoverScale = isHovered ? 1.06 : 1.0;
            surfaceRef.current.scale.setScalar(baseRadius * surfacePulse * hoverScale);
            surfaceRef.current.rotation.y = time * 0.04;
        }

        // Glow: very slow breathing
        if (glowRef.current) {
            const glowPulse = Math.sin(time * 0.3) * 0.04 + 1.0;
            glowRef.current.scale.setScalar(baseRadius * 1.8 * glowPulse);
            const mat = glowRef.current.material as THREE.MeshBasicMaterial;
            mat.opacity = (isHovered || isSelected ? 0.08 : 0.04) * glowPulse;
        }

        // Light intensity follows pulse gently
        if (lightRef.current) {
            const lightPulse = Math.sin(time * pulseSpeed * 0.5) * 0.1 + 1.0;
            lightRef.current.intensity = (developer.normalizedMass * 0.008 + 0.15) * lightPulse;
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
            {/* Soft outer glow (very transparent, additive) */}
            <mesh ref={glowRef}>
                <sphereGeometry args={[1, 20, 20]} />
                <meshBasicMaterial
                    color={stellarConfig.coronaThree}
                    transparent
                    opacity={0.04}
                    depthWrite={false}
                    side={THREE.BackSide}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>

            {/* Surface: main visible star body */}
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
                    roughness={0.6}
                    metalness={0.0}
                    toneMapped={false}
                />
            </mesh>

            {/* Bright core center */}
            <mesh ref={coreRef}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial
                    color="#fffaf0"
                    toneMapped={false}
                />
            </mesh>

            {/* Subtle point light */}
            <pointLight
                ref={lightRef}
                color={stellarConfig.coronaThree}
                intensity={developer.normalizedMass * 0.01 + 0.2}
                distance={25}
                decay={2}
            />

            {/* Selection indicator: thin ring */}
            {isSelected && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[baseRadius * 1.8, baseRadius * 1.9, 64]} />
                    <meshBasicMaterial
                        color={stellarConfig.coronaThree}
                        transparent
                        opacity={0.3}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                    />
                </mesh>
            )}

            {/* Bus factor: subtle red tint ring (not flashy) */}
            {isBusFactorRisk && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[baseRadius * 2.2, baseRadius * 2.35, 48]} />
                    <meshBasicMaterial
                        color="#cc3333"
                        transparent
                        opacity={0.12}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                    />
                </mesh>
            )}

            {/* Labels */}
            {showLabels && (
                <Billboard follow lockX={false} lockY={false} lockZ={false}>
                    <Text
                        position={[0, baseRadius + 0.8, 0]}
                        fontSize={0.5}
                        color="#ffffff"
                        anchorX="center"
                        anchorY="bottom"
                        outlineWidth={0.03}
                        outlineColor="#000000"
                        fillOpacity={isHovered || isSelected ? 0.9 : 0.4}
                    >
                        {developer.name}
                    </Text>
                    {(isHovered || isSelected) && (
                        <Text
                            position={[0, baseRadius + 0.3, 0]}
                            fontSize={0.3}
                            color="rgba(255,255,255,0.45)"
                            anchorX="center"
                            anchorY="bottom"
                            outlineWidth={0.02}
                            outlineColor="#000000"
                        >
                            {`${developer.totalCommits} commits · ${developer.totalFilesOwned} files`}
                        </Text>
                    )}
                </Billboard>
            )}
        </group>
    );
}
