/**
 * Universe Scene
 *
 * Root scene composition with refined visual balance.
 *
 * Key design choices:
 * - Bloom at lower intensity (0.6) with higher threshold (0.5) so only
 *   the brightest star cores glow, not everything.
 * - Very dim ambient light — space should be DARK.
 * - No directional light — stars provide their own illumination via point lights.
 * - ACES filmic tone mapping for cinematic, natural color response.
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
import EventParticles from "./EventParticles";
import CameraController from "./CameraController";
import { useUniverseStore } from "@/stores/universe-store";
import { SpatialDeveloper } from "@/utils/spatial-layout";

function SceneContent() {
    const {
        spatialData,
        showEdges,
        showPlanets,
        showNebulae,
        temporalEvents,
    } = useUniverseStore();

    const developerMap = useMemo(() => {
        if (!spatialData) return new Map<string, SpatialDeveloper>();
        return new Map(spatialData.developers.map((d) => [d.id, d]));
    }, [spatialData]);

    if (!spatialData) return null;

    return (
        <>
            {/* Extremely dim ambient — space is dark */}
            <ambientLight intensity={0.015} color="#6080a0" />

            {/* Background starfield */}
            <Starfield />

            {/* Galaxy nebulae — faint wisps */}
            {showNebulae &&
                spatialData.galaxies.map((galaxy) => (
                    <GalaxyNebula key={galaxy.id} galaxy={galaxy} />
                ))}

            {/* Developer suns */}
            {spatialData.developers.map((developer) => (
                <DeveloperSun key={developer.id} developer={developer} />
            ))}

            {/* Orbital rings */}
            {showPlanets && spatialData.planets.length > 0 && (
                <OrbitalRings
                    planets={spatialData.planets}
                    developers={developerMap}
                />
            )}

            {/* Commit planets */}
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

            {/* Event particles */}
            {temporalEvents.length > 0 && (
                <EventParticles
                    events={temporalEvents}
                    developers={developerMap}
                />
            )}

            {/* Camera system */}
            <CameraController />

            {/* Post-processing: selective bloom
                - Higher threshold = only bright star cores glow
                - Lower intensity = natural light scatter, not neon  */}
            <EffectComposer multisampling={0}>
                <Bloom
                    luminanceThreshold={0.5}
                    luminanceSmoothing={0.6}
                    intensity={0.6}
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
                background: "#020108",
            }}
        >
            <Canvas
                gl={{
                    antialias: true,
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: 0.9,
                    powerPreference: "high-performance",
                }}
                camera={{
                    fov: 55,
                    near: 0.1,
                    far: 3000,
                    position: [0, 25, 150],
                }}
                dpr={[1, 2]}
                performance={{ min: 0.5 }}
                onCreated={({ gl }) => {
                    gl.setClearColor("#020108");
                }}
            >
                <Suspense fallback={null}>
                    <SceneContent />
                </Suspense>
            </Canvas>
        </div>
    );
}
