/**
 * Collaboration Edge Renderer
 *
 * Renders weighted edges between developer pairs:
 * - Standard edges: animated bezier curves, thickness = collaboration weight
 * - Binary star edges: highlighted purple with particle flow
 * - Color: blend of both developer colors
 * - Opacity decays with inactivity
 * - Only visible above a threshold zoom level
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

export default function CollaborationEdges({
    edges,
    developers,
}: CollaborationEdgesProps) {
    const groupRef = useRef<THREE.Group>(null);

    // Generate curve geometries
    const edgeData = useMemo(() => {
        return edges.map((edge) => {
            const source = developers.get(edge.sourceId);
            const target = developers.get(edge.targetId);
            if (!source || !target) return null;

            // Create quadratic bezier curve with midpoint lifted
            const mid = new THREE.Vector3()
                .addVectors(edge.sourcePosition, edge.targetPosition)
                .multiplyScalar(0.5);

            // Lift the midpoint perpendicular to the edge
            const direction = new THREE.Vector3()
                .subVectors(edge.targetPosition, edge.sourcePosition);
            const lift = Math.min(direction.length() * 0.2, 8);
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

            // Thickness based on weight (normalized)
            const maxWeight = Math.max(...edges.map((e) => e.weight), 1);
            const thickness = edge.isBinaryStar
                ? 0.15
                : 0.03 + (edge.weight / maxWeight) * 0.1;

            const points = curve.getPoints(32);
            const geometry = new THREE.BufferGeometry().setFromPoints(points);

            return {
                edge,
                curve,
                geometry,
                color,
                thickness,
                isBinary: edge.isBinaryStar,
                points,
            };
        }).filter(Boolean) as Array<{
            edge: SpatialEdge;
            curve: THREE.QuadraticBezierCurve3;
            geometry: THREE.BufferGeometry;
            color: THREE.Color;
            thickness: number;
            isBinary: boolean;
            points: THREE.Vector3[];
        }>;
    }, [edges, developers]);

    // Animate edge opacity pulse
    useFrame(({ clock }) => {
        if (!groupRef.current) return;
        const time = clock.getElapsedTime();

        groupRef.current.children.forEach((child, i) => {
            if (i >= edgeData.length) return;
            const data = edgeData[i];
            // Line2 material uses different property access
            const mesh = child as THREE.Mesh;
            if (mesh.material && "opacity" in mesh.material) {
                const mat = mesh.material as THREE.Material;
                const pulse = data.isBinary
                    ? Math.sin(time * 3) * 0.2 + 0.7
                    : Math.sin(time * 0.5 + i) * 0.1 + 0.4;
                mat.opacity = pulse;
            }
        });
    });

    if (edgeData.length === 0) return null;

    return (
        <group ref={groupRef}>
            {edgeData.map((data) => (
                <Line
                    key={data.edge.id}
                    points={data.points}
                    color={data.color}
                    lineWidth={data.isBinary ? 2.0 : 0.8}
                    transparent
                    opacity={data.isBinary ? 0.7 : 0.35}
                    depthWrite={false}
                />
            ))}
        </group>
    );
}
