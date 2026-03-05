/**
 * Collaboration Edge Renderer — Cinematic Rewrite
 *
 * Renders connections between collaborating developers:
 * 1. Elegant curved bezier paths (slightly brighter)
 * 2. Animated energy particles flowing along edges
 * 3. Binary star connections have a stronger glow
 * 4. Gentle opacity pulse for life-like feel
 */

"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { SpatialEdge, SpatialDeveloper } from "@/utils/spatial-layout";
import { StellarType, getEdgeColor } from "@/utils/color-utils";

interface CollaborationEdgesProps {
    edges: SpatialEdge[];
    developers: Map<string, SpatialDeveloper>;
}

// ─── Edge Particle Flow ─────────────────────────────────────────────────────

const PARTICLE_GEO = new THREE.SphereGeometry(1, 4, 4);
const PARTICLES_PER_EDGE = 3;

export default function CollaborationEdges({
    edges,
    developers,
}: CollaborationEdgesProps) {
    const groupRef = useRef<THREE.Group>(null);
    const particleMeshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    const edgeData = useMemo(() => {
        return edges.map((edge) => {
            const source = developers.get(edge.sourceId);
            const target = developers.get(edge.targetId);
            if (!source || !target) return null;

            // Curved path
            const mid = new THREE.Vector3()
                .addVectors(edge.sourcePosition, edge.targetPosition)
                .multiplyScalar(0.5);
            const direction = new THREE.Vector3()
                .subVectors(edge.targetPosition, edge.sourcePosition);
            const lift = Math.min(direction.length() * 0.15, 5);
            mid.y += lift;

            const curve = new THREE.QuadraticBezierCurve3(
                edge.sourcePosition,
                mid,
                edge.targetPosition
            );

            const color = getEdgeColor(
                source.stellarType as StellarType,
                target.stellarType as StellarType,
                edge.isBinaryStar
            );

            const points = curve.getPoints(32);

            return {
                edge,
                curve,
                color,
                isBinary: edge.isBinaryStar,
                points,
            };
        }).filter(Boolean) as Array<{
            edge: SpatialEdge;
            curve: THREE.QuadraticBezierCurve3;
            color: THREE.Color;
            isBinary: boolean;
            points: THREE.Vector3[];
        }>;
    }, [edges, developers]);

    const totalParticles = edgeData.length * PARTICLES_PER_EDGE;

    // Particle colors
    const particleColors = useMemo(() => {
        const arr = new Float32Array(totalParticles * 3);
        for (let i = 0; i < edgeData.length; i++) {
            const c = edgeData[i].color;
            for (let j = 0; j < PARTICLES_PER_EDGE; j++) {
                const idx = (i * PARTICLES_PER_EDGE + j) * 3;
                arr[idx] = c.r * 1.5;
                arr[idx + 1] = c.g * 1.5;
                arr[idx + 2] = c.b * 1.5;
            }
        }
        return arr;
    }, [edgeData, totalParticles]);

    // Animate particles along edges + opacity pulse
    useFrame(({ clock }) => {
        if (!groupRef.current) return;
        const time = clock.getElapsedTime();

        // Opacity pulse on lines
        groupRef.current.children.forEach((child, i) => {
            if (i >= edgeData.length) return;
            const data = edgeData[i];
            const line = child as unknown as { material?: THREE.Material };
            if (line.material && "opacity" in line.material) {
                const mat = line.material as THREE.Material;
                const baseOpacity = data.isBinary ? 0.25 : 0.1;
                const pulse = Math.sin(time * 0.5 + i * 0.6) * 0.04 + baseOpacity;
                mat.opacity = pulse;
            }
        });

        // Animate particles
        if (particleMeshRef.current && totalParticles > 0) {
            const mesh = particleMeshRef.current;
            for (let i = 0; i < edgeData.length; i++) {
                const { curve, isBinary } = edgeData[i];
                for (let j = 0; j < PARTICLES_PER_EDGE; j++) {
                    const idx = i * PARTICLES_PER_EDGE + j;
                    const speed = 0.35 + j * 0.1;
                    const t = ((time * speed + j * 0.33) % 1.0);
                    const point = curve.getPoint(t);

                    dummy.position.copy(point);
                    dummy.scale.setScalar(isBinary ? 0.06 : 0.04);
                    dummy.updateMatrix();
                    mesh.setMatrixAt(idx, dummy.matrix);
                }
            }
            mesh.instanceMatrix.needsUpdate = true;
        }
    });

    if (edgeData.length === 0) return null;

    return (
        <>
            <group ref={groupRef}>
                {edgeData.map((data) => (
                    <Line
                        key={data.edge.id}
                        points={data.points}
                        color={data.color}
                        lineWidth={data.isBinary ? 1.5 : 0.7}
                        transparent
                        opacity={data.isBinary ? 0.25 : 0.1}
                        depthWrite={false}
                    />
                ))}
            </group>

            {/* Energy particles flowing along edges */}
            {totalParticles > 0 && (
                <instancedMesh
                    ref={particleMeshRef}
                    args={[PARTICLE_GEO, undefined, totalParticles]}
                    frustumCulled={false}
                >
                    <meshBasicMaterial
                        vertexColors
                        transparent
                        opacity={0.7}
                        depthWrite={false}
                        blending={THREE.AdditiveBlending}
                        toneMapped={false}
                    />
                    {particleColors.length > 0 && (
                        <instancedBufferAttribute
                            attach="geometry-attributes-color"
                            args={[particleColors, 3]}
                        />
                    )}
                </instancedMesh>
            )}
        </>
    );
}
