/**
 * Galaxy Nebula Component
 *
 * Renders each galaxy/service as a volumetric nebula cloud.
 * Uses sprite-based rendering with custom opacity and color.
 * Each nebula:
 * - Color from galaxy's assigned hue
 * - Size proportional to file count
 * - Soft boundary with transparency falloff
 * - Galaxy name label in constellation-style text
 * - Subtle drift animation
 */

"use client";

import React, { useRef } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { SpatialGalaxy } from "@/utils/spatial-layout";
import { useUniverseStore } from "@/stores/universe-store";

interface GalaxyNebulaProps {
    galaxy: SpatialGalaxy;
}

export default function GalaxyNebula({ galaxy }: GalaxyNebulaProps) {
    const outerRef = useRef<THREE.Mesh>(null);
    const innerRef = useRef<THREE.Mesh>(null);

    const { selectedGalaxyId, selectGalaxy, showLabels } = useUniverseStore();
    const isSelected = selectedGalaxyId === galaxy.id;

    const color = new THREE.Color().setHSL(galaxy.colorHue / 360, 0.5, 0.4);
    const innerColor = new THREE.Color().setHSL(galaxy.colorHue / 360, 0.6, 0.55);

    useFrame(({ clock }) => {
        const time = clock.getElapsedTime();

        if (outerRef.current) {
            // Slow rotation + breathing
            outerRef.current.rotation.y = time * 0.02;
            outerRef.current.rotation.z = Math.sin(time * 0.1) * 0.05;
            const breathe = Math.sin(time * 0.3) * 0.03 + 1.0;
            outerRef.current.scale.setScalar(galaxy.radius * breathe);
        }

        if (innerRef.current) {
            innerRef.current.rotation.y = -time * 0.03;
            const breatheInner = Math.sin(time * 0.4 + 1) * 0.05 + 1.0;
            innerRef.current.scale.setScalar(galaxy.radius * 0.6 * breatheInner);
        }
    });

    const handleClick = (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        selectGalaxy(isSelected ? null : galaxy.id);
    };

    return (
        <group position={galaxy.position}>
            {/* Outer nebula cloud */}
            <mesh
                ref={outerRef}
                onClick={handleClick}
            >
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={isSelected ? 0.12 : 0.06}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                    wireframe={false}
                />
            </mesh>

            {/* Inner dense core */}
            <mesh ref={innerRef}>
                <sphereGeometry args={[1, 12, 12]} />
                <meshBasicMaterial
                    color={innerColor}
                    transparent
                    opacity={isSelected ? 0.15 : 0.08}
                    depthWrite={false}
                />
            </mesh>

            {/* Selection ring */}
            {isSelected && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[galaxy.radius * 1.1, galaxy.radius * 1.15, 48]} />
                    <meshBasicMaterial
                        color={innerColor}
                        transparent
                        opacity={0.4}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                    />
                </mesh>
            )}

            {/* Galaxy Label */}
            {showLabels && (
                <Billboard follow lockX={false} lockY={false} lockZ={false}>
                    <Text
                        position={[0, galaxy.radius + 3, 0]}
                        fontSize={1.5}
                        color={`hsl(${galaxy.colorHue}, 50%, 65%)`}
                        anchorX="center"
                        anchorY="bottom"
                        outlineWidth={0.05}
                        outlineColor="#000000"
                        fillOpacity={isSelected ? 1.0 : 0.5}
                        letterSpacing={0.15}
                    >
                        {galaxy.name.toUpperCase()}
                    </Text>
                    <Text
                        position={[0, galaxy.radius + 1.5, 0]}
                        fontSize={0.7}
                        color="rgba(255,255,255,0.4)"
                        anchorX="center"
                        anchorY="bottom"
                    >
                        {`${galaxy.totalFiles} files · ${galaxy.totalDevelopers} devs`}
                    </Text>
                </Billboard>
            )}
        </group>
    );
}
