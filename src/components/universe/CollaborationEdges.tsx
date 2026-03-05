/**
 * Collaboration Edge Renderer
 *
 * Renders connections between collaborating developers.
 *
 * Design philosophy:
 * - Edges should be barely visible threads — not thick neon lines.
 * - They suggest connections, not demand attention.
 * - Binary star edges are slightly more visible but still subtle.
 * - No particle flow (it was adding visual noise). Instead, edges
 *   have a gentle opacity pulse to suggest energy flow.
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

    const edgeData = useMemo(() => {
        return edges.map((edge) => {
            const source = developers.get(edge.sourceId);
            const target = developers.get(edge.targetId);
            if (!source || !target) return null;

            // Gentle upward arc
            const mid = new THREE.Vector3()
                .addVectors(edge.sourcePosition, edge.targetPosition)
                .multiplyScalar(0.5);
            const direction = new THREE.Vector3()
                .subVectors(edge.targetPosition, edge.sourcePosition);
            const lift = Math.min(direction.length() * 0.12, 4);
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

            const points = curve.getPoints(24);

            return {
                edge,
                color,
                isBinary: edge.isBinaryStar,
                points,
            };
        }).filter(Boolean) as Array<{
            edge: SpatialEdge;
            color: THREE.Color;
            isBinary: boolean;
            points: THREE.Vector3[];
        }>;
    }, [edges, developers]);

    // Gentle opacity pulse
    useFrame(({ clock }) => {
        if (!groupRef.current) return;
        const time = clock.getElapsedTime();

        groupRef.current.children.forEach((child, i) => {
            if (i >= edgeData.length) return;
            const data = edgeData[i];
            const line = child as unknown as { material?: THREE.Material };
            if (line.material && "opacity" in line.material) {
                const mat = line.material as THREE.Material;
                const baseOpacity = data.isBinary ? 0.18 : 0.07;
                const pulse = Math.sin(time * 0.4 + i * 0.8) * 0.03 + baseOpacity;
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
                    lineWidth={data.isBinary ? 1.0 : 0.5}
                    transparent
                    opacity={data.isBinary ? 0.18 : 0.07}
                    depthWrite={false}
                />
            ))}
        </group>
    );
}
