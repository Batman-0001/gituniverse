/**
 * Camera Controller — Cinematic Rewrite
 *
 * Features:
 * 1. Cinematic intro — camera swoops in, visits each developer solar system, then settles
 * 2. Smooth cubic-bezier transitions between view levels
 * 3. Gentle idle auto-orbit that never feels disorienting
 * 4. Proper orbit controls with damping
 * 5. Default focus on universe content with nice framing
 */

"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useUniverseStore } from "@/stores/universe-store";

// Easing functions
function easeOutExpo(t: number): number {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function easeInOutCubic(t: number): number {
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Intro phase types — visit each developer solar system then pull back
type IntroPhase =
    | "far"
    | "approach_overview"
    | "zoom_dev1"
    | "hold_dev1"
    | "zoom_dev2"
    | "hold_dev2"
    | "pullback"
    | "done";

// Developer names to spotlight on load
const SPOTLIGHT_NAMES = ["menoom", "batman"];

export default function CameraController() {
    const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);
    const { camera } = useThree();

    const {
        cameraTarget,
        cameraDistance,
        viewLevel,
        spatialData,
    } = useUniverseStore();

    // Animation state
    const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
    const targetPosition = useRef(new THREE.Vector3(0, 30, 200));
    const isAnimating = useRef(false);
    const animationProgress = useRef(1);
    const introComplete = useRef(false);
    const introPhase = useRef<IntroPhase>("far");
    const introTimer = useRef(0);
    const idleTime = useRef(0);

    // Start / end positions for the intro phases
    const introStartPos = useRef(new THREE.Vector3());
    const introEndPos = useRef(new THREE.Vector3());
    const introEndLookAt = useRef(new THREE.Vector3());

    // Per-phase origin & destination so we can lerp cleanly between waypoints
    const phaseFromPos = useRef(new THREE.Vector3());
    const phaseToPos = useRef(new THREE.Vector3());
    const phaseFromLookAt = useRef(new THREE.Vector3());
    const phaseToLookAt = useRef(new THREE.Vector3());

    // Resolved developer positions for the two spotlight devs
    const dev1Pos = useRef<THREE.Vector3 | null>(null);
    const dev2Pos = useRef<THREE.Vector3 | null>(null);

    // Initialize cinematic intro
    useEffect(() => {
        if (spatialData && !introComplete.current) {
            const center = spatialData.bounds.center;
            const dist = spatialData.bounds.radius * 2.2;

            // Resolve the two spotlight developers by name (case-insensitive)
            const devs = spatialData.developers;
            const find = (name: string) =>
                devs.find((d) => d.name.toLowerCase().includes(name.toLowerCase()));

            const spotlight1 = find(SPOTLIGHT_NAMES[0]);
            const spotlight2 = find(SPOTLIGHT_NAMES[1]);

            dev1Pos.current = spotlight1 ? spotlight1.position.clone() : null;
            dev2Pos.current = spotlight2 ? spotlight2.position.clone() : null;

            // Camera starts very far away, looking at center
            introStartPos.current.set(
                center.x + dist * 2.5,
                center.y + dist * 1.5,
                center.z + dist * 2.5
            );

            // Final settled position — nice overview angle
            introEndPos.current.set(
                center.x + dist * 0.4,
                center.y + dist * 0.3,
                center.z + dist * 0.7
            );

            introEndLookAt.current.copy(center);

            // Set initial camera position
            camera.position.copy(introStartPos.current);
            camera.lookAt(introEndLookAt.current);

            introPhase.current = "approach_overview";
            introTimer.current = 0;
        }
    }, [spatialData, camera]);

    // Handle target changes (user clicks star/galaxy)
    useEffect(() => {
        if (!introComplete.current) return;

        if (cameraTarget) {
            targetLookAt.current.set(cameraTarget.x, cameraTarget.y, cameraTarget.z);

            let offsetMultiplier = 1;
            let elevationMultiplier = 0.3;

            if (viewLevel === "solar-system") {
                offsetMultiplier = 0.5;
                elevationMultiplier = 0.35;
            } else if (viewLevel === "galaxy") {
                offsetMultiplier = 0.7;
                elevationMultiplier = 0.3;
            }

            const offset = new THREE.Vector3(
                cameraDistance * 0.4 * offsetMultiplier,
                cameraDistance * elevationMultiplier,
                cameraDistance * 0.6 * offsetMultiplier
            );
            targetPosition.current.copy(targetLookAt.current).add(offset);

            isAnimating.current = true;
            animationProgress.current = 0;
            idleTime.current = 0;
        } else if (spatialData) {
            // Reset to universe overview
            targetLookAt.current.copy(spatialData.bounds.center);
            const dist = spatialData.bounds.radius * 2;
            targetPosition.current.set(
                spatialData.bounds.center.x + dist * 0.4,
                spatialData.bounds.center.y + dist * 0.3,
                spatialData.bounds.center.z + dist * 0.7
            );
            isAnimating.current = true;
            animationProgress.current = 0;
            idleTime.current = 0;
        }
    }, [cameraTarget, cameraDistance, spatialData, viewLevel]);

    // Per-frame animation
    useFrame((_, delta) => {
        if (!controlsRef.current) return;
        const controls = controlsRef.current;

        // Helper: get the controls.target safely
        const getTarget = (): THREE.Vector3 | null => {
            if ("target" in controls && controls.target instanceof THREE.Vector3) {
                return controls.target;
            }
            return null;
        };

        // ─── Cinematic Intro — multi-waypoint ─────────────────
        if (!introComplete.current && introPhase.current !== "far") {
            introTimer.current += delta;
            const target = getTarget();

            // Phase 1: Quick approach from far to overview (1.5s)
            if (introPhase.current === "approach_overview") {
                const duration = 1.5;
                const t = Math.min(introTimer.current / duration, 1.0);
                const eased = easeOutExpo(t);

                camera.position.lerpVectors(
                    introStartPos.current,
                    introEndPos.current,
                    eased
                );
                if (target) target.lerp(introEndLookAt.current, eased * 0.1 + 0.03);
                controls.update();

                if (t >= 1.0) {
                    introTimer.current = 0;
                    // Capture current camera state as the start of the next phase
                    phaseFromPos.current.copy(camera.position);
                    phaseFromLookAt.current.copy(target ?? introEndLookAt.current);

                    if (dev1Pos.current) {
                        // Compute a close-up camera position offset from dev1
                        phaseToPos.current.set(
                            dev1Pos.current.x + 8,
                            dev1Pos.current.y + 5,
                            dev1Pos.current.z + 12
                        );
                        phaseToLookAt.current.copy(dev1Pos.current);
                        introPhase.current = "zoom_dev1";
                    } else if (dev2Pos.current) {
                        phaseToPos.current.set(
                            dev2Pos.current.x + 8,
                            dev2Pos.current.y + 5,
                            dev2Pos.current.z + 12
                        );
                        phaseToLookAt.current.copy(dev2Pos.current);
                        introPhase.current = "zoom_dev2";
                    } else {
                        introPhase.current = "done";
                        introComplete.current = true;
                    }
                }
                return;
            }

            // Phase 2: Fast zoom to developer 1 (1.2s)
            if (introPhase.current === "zoom_dev1") {
                const duration = 1.2;
                const t = Math.min(introTimer.current / duration, 1.0);
                const eased = easeOutExpo(t);

                camera.position.lerpVectors(phaseFromPos.current, phaseToPos.current, eased);
                if (target) target.lerpVectors(phaseFromLookAt.current, phaseToLookAt.current, eased);
                controls.update();

                if (t >= 1.0) {
                    introTimer.current = 0;
                    introPhase.current = "hold_dev1";
                }
                return;
            }

            // Phase 3: Brief orbit/hold on developer 1 (0.7s)
            if (introPhase.current === "hold_dev1") {
                const duration = 0.7;
                const t = Math.min(introTimer.current / duration, 1.0);

                // Gentle orbit around the developer
                if (dev1Pos.current) {
                    const angle = t * Math.PI * 0.2; // ~36° sweep
                    const radius = 14;
                    camera.position.set(
                        dev1Pos.current.x + Math.cos(angle) * radius,
                        dev1Pos.current.y + 5 - t * 1,
                        dev1Pos.current.z + Math.sin(angle) * radius
                    );
                    if (target) target.lerp(dev1Pos.current, 0.1);
                }
                controls.update();

                if (t >= 1.0) {
                    introTimer.current = 0;
                    phaseFromPos.current.copy(camera.position);
                    phaseFromLookAt.current.copy(target ?? introEndLookAt.current);

                    if (dev2Pos.current) {
                        phaseToPos.current.set(
                            dev2Pos.current.x + 8,
                            dev2Pos.current.y + 5,
                            dev2Pos.current.z + 12
                        );
                        phaseToLookAt.current.copy(dev2Pos.current);
                        introPhase.current = "zoom_dev2";
                    } else {
                        introPhase.current = "pullback";
                        phaseFromPos.current.copy(camera.position);
                        phaseFromLookAt.current.copy(target ?? introEndLookAt.current);
                    }
                }
                return;
            }

            // Phase 4: Fast zoom to developer 2 (1.2s)
            if (introPhase.current === "zoom_dev2") {
                const duration = 1.2;
                const t = Math.min(introTimer.current / duration, 1.0);
                const eased = easeOutExpo(t);

                camera.position.lerpVectors(phaseFromPos.current, phaseToPos.current, eased);
                if (target) target.lerpVectors(phaseFromLookAt.current, phaseToLookAt.current, eased);
                controls.update();

                if (t >= 1.0) {
                    introTimer.current = 0;
                    introPhase.current = "hold_dev2";
                }
                return;
            }

            // Phase 5: Brief orbit/hold on developer 2 (0.7s)
            if (introPhase.current === "hold_dev2") {
                const duration = 0.7;
                const t = Math.min(introTimer.current / duration, 1.0);

                if (dev2Pos.current) {
                    const angle = t * Math.PI * 0.2;
                    const radius = 14;
                    camera.position.set(
                        dev2Pos.current.x + Math.cos(angle) * radius,
                        dev2Pos.current.y + 5 - t * 1,
                        dev2Pos.current.z + Math.sin(angle) * radius
                    );
                    if (target) target.lerp(dev2Pos.current, 0.1);
                }
                controls.update();

                if (t >= 1.0) {
                    introTimer.current = 0;
                    phaseFromPos.current.copy(camera.position);
                    phaseFromLookAt.current.copy(target ?? introEndLookAt.current);
                    introPhase.current = "pullback";
                }
                return;
            }

            // Phase 6: Pull back to universe overview (2.0s)
            if (introPhase.current === "pullback") {
                const duration = 2.0;
                const t = Math.min(introTimer.current / duration, 1.0);
                const eased = easeInOutCubic(t);

                camera.position.lerpVectors(phaseFromPos.current, introEndPos.current, eased);
                if (target) target.lerpVectors(phaseFromLookAt.current, introEndLookAt.current, eased);
                controls.update();

                if (t >= 1.0) {
                    introPhase.current = "done";
                    introComplete.current = true;
                    idleTime.current = 0;
                }
                return;
            }
        }

        // ─── Navigation Transitions ─────────────────────────────
        if (isAnimating.current && animationProgress.current < 1) {
            animationProgress.current = Math.min(
                1,
                animationProgress.current + delta * 0.8
            );

            const t = easeInOutCubic(animationProgress.current);

            camera.position.lerp(targetPosition.current, t * 0.04 + 0.01);

            if ("target" in controls && controls.target instanceof THREE.Vector3) {
                controls.target.lerp(targetLookAt.current, t * 0.04 + 0.01);
            }

            controls.update();

            if (animationProgress.current >= 1) {
                isAnimating.current = false;
                idleTime.current = 0;
            }
        }

        // ─── Idle Auto-Orbit ─────────────────────────────────────
        if (!isAnimating.current && introComplete.current) {
            idleTime.current += delta;

            if (viewLevel === "universe" && idleTime.current > 2.0) {
                // Start gentle orbit after 2s idle
                controls.autoRotate = true;
                controls.autoRotateSpeed = 0.12;
            } else if (viewLevel === "solar-system" && idleTime.current > 3.0) {
                controls.autoRotate = true;
                controls.autoRotateSpeed = 0.2;
            } else {
                controls.autoRotate = false;
            }
        } else {
            controls.autoRotate = false;
        }
    });

    // Reset idle on user interaction
    const handleChange = useCallback(() => {
        idleTime.current = 0;
    }, []);

    return (
        <OrbitControls
            ref={controlsRef}
            makeDefault
            enablePan
            enableZoom
            enableRotate
            minDistance={2}
            maxDistance={1000}
            zoomSpeed={0.6}
            rotateSpeed={0.4}
            panSpeed={0.6}
            dampingFactor={0.06}
            enableDamping
            onChange={handleChange}
        />
    );
}
