/**
 * Universe Scene
 *
 * The root React Three Fiber scene that composes all 3D elements:
 * - Background starfield (30k instanced stars)
 * - Galaxy nebulae (per service/module)
 * - Developer suns (per developer with multi-layer glow + point lights)
 * - Orbital rings (visible orbit paths around suns)
 * - Commit planets (per file, procedural GLSL shaders + atmosphere rim)
 * - Collaboration edges (bezier curves between devs)
 * - Camera controller (zoom levels + smooth transitions + auto-orbit)
 * - Post-processing (bloom, ambient light)
 */

"use client";

import React, { useMemo, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

import Starfield from "./Starfield";
import DeveloperSun from "./DeveloperSun";
import CommitPlanets from "./CommitPlanets";
import CollaborationEdges from "./CollaborationEdges";
import GalaxyNebula from "./GalaxyNebula";
import OrbitalRings from "./OrbitalRings";
import CameraController from "./CameraController";
import { useUniverseStore } from "@/stores/universe-store";
import { SpatialDeveloper } from "@/utils/spatial-layout";

function SceneContent() {
    const {
        spatialData,
        showEdges,
        showPlanets,
        showNebulae,
    } = useUniverseStore();

    // Build developer lookup map
    const developerMap = useMemo(() => {
        if (!spatialData) return new Map<string, SpatialDeveloper>();
        return new Map(spatialData.developers.map((d) => [d.id, d]));
    }, [spatialData]);

    if (!spatialData) return null;

    return (
        <>
            {/* Ambient fill light */}
            <ambientLight intensity={0.04} color="#b0c4de" />

            {/* Directional key light (distant star) */}
            <directionalLight
                position={[100, 80, 50]}
                intensity={0.1}
                color="#e8f4ff"
            />

            {/* Background starfield */}
            <Starfield />

            {/* Galaxy nebulae */}
            {showNebulae &&
                spatialData.galaxies.map((galaxy) => (
                    <GalaxyNebula key={galaxy.id} galaxy={galaxy} />
                ))}

            {/* Developer suns (multi-layer glow + point lights) */}
            {spatialData.developers.map((developer) => (
                <DeveloperSun key={developer.id} developer={developer} />
            ))}

            {/* Orbital rings (visible orbit paths) */}
            {showPlanets && spatialData.planets.length > 0 && (
                <OrbitalRings
                    planets={spatialData.planets}
                    developers={developerMap}
                />
            )}

            {/* Commit planets (instanced for performance) */}
            {showPlanets && spatialData.planets.length > 0 && (
                <CommitPlanets
                    planets={spatialData.planets}
                    developers={developerMap}
                />
            )}

            {/* Collaboration edges */}
            {showEdges && spatialData.edges.length > 0 && (
                <CollaborationEdges
                    edges={spatialData.edges}
                    developers={developerMap}
                />
            )}

            {/* Camera system */}
            <CameraController />

            {/* Post-processing: Bloom for sun glow + additive blending visuals */}
            <EffectComposer multisampling={0}>
                <Bloom
                    luminanceThreshold={0.3}
                    luminanceSmoothing={0.9}
                    intensity={1.0}
                    mipmapBlur
                />
            </EffectComposer>
        </>
    );
}

interface UniverseSceneProps {
    className?: string;
}

export default function UniverseScene({ className }: UniverseSceneProps) {
    return (
        <div
            className={className}
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                background: "#000000",
            }}
        >
            <Canvas
                gl={{
                    antialias: true,
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: 1.0,
                    powerPreference: "high-performance",
                }}
                camera={{
                    fov: 60,
                    near: 0.1,
                    far: 3000,
                    position: [0, 30, 200],
                }}
                dpr={[1, 2]}
                performance={{ min: 0.5 }}
                onCreated={({ gl }) => {
                    gl.setClearColor("#000000");
                }}
            >
                <Suspense fallback={null}>
                    <SceneContent />
                </Suspense>
            </Canvas>
        </div>
    );
}
