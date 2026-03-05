/**
 * Universe Scene — Cinematic Rewrite
 *
 * Root scene composition with cinematic visual quality:
 * - Multi-pass bloom (selective luminance threshold)
 * - Chromatic aberration for lens realism
 * - Vignette for cinematic framing
 * - ACES filmic tone mapping for natural colors
 * - Enhanced scene lighting (warm side + cool fill)
 */

"use client";

import React, { useMemo, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import {
    EffectComposer,
    Bloom,
    ChromaticAberration,
    Vignette,
    ToneMapping,
} from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
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
            {/* Deep space — very dim ambient (space is dark!) */}
            <ambientLight intensity={0.008} color="#4060a0" />

            {/* Background starfield */}
            <Starfield />

            {/* Galaxy nebulae */}
            {showNebulae &&
                spatialData.galaxies.map((galaxy) => (
                    <GalaxyNebula key={galaxy.id} galaxy={galaxy} />
                ))}

            {/* Developer suns (plasma shader stars) */}
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

            {/* ─── Post-processing pipeline ─── */}
            <EffectComposer multisampling={0}>
                {/* Bloom: two-pass for realistic star glow */}
                <Bloom
                    luminanceThreshold={0.3}
                    luminanceSmoothing={0.9}
                    intensity={0.8}
                    mipmapBlur
                />

                {/* Subtle chromatic aberration for lens realism */}
                <ChromaticAberration
                    blendFunction={BlendFunction.NORMAL}
                    offset={new THREE.Vector2(0.0004, 0.0004)}
                    radialModulation={true}
                    modulationOffset={0.3}
                />

                {/* Cinematic vignette */}
                <Vignette
                    offset={0.3}
                    darkness={0.6}
                    blendFunction={BlendFunction.NORMAL}
                />

                {/* ACES filmic tone mapping */}
                <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
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
                background: "#010008",
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
                    fov: 50,
                    near: 0.1,
                    far: 5000,
                    position: [0, 100, 500],
                }}
                dpr={[1, 2]}
                performance={{ min: 0.5 }}
                onCreated={({ gl }) => {
                    gl.setClearColor("#010008");
                }}
            >
                <Suspense fallback={null}>
                    <SceneContent />
                </Suspense>
            </Canvas>
        </div>
    );
}
