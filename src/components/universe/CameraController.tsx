/**
 * Camera Controller — Cinematic Rewrite
 *
 * Features:
 * 1. Cinematic intro — camera swoops in from distance, orbits, settles on universe center
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
    const introPhase = useRef<"far" | "approach" | "settle" | "done">("far");
    const introTimer = useRef(0);
    const idleTime = useRef(0);

    // Start position and end position for intro
    const introStartPos = useRef(new THREE.Vector3());
    const introEndPos = useRef(new THREE.Vector3());
    const introEndLookAt = useRef(new THREE.Vector3());

    // Initialize cinematic intro
    useEffect(() => {
        if (spatialData && !introComplete.current) {
            const center = spatialData.bounds.center;
            const dist = spatialData.bounds.radius * 2.2;

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

            introPhase.current = "approach";
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

        // ─── Cinematic Intro ───────────────────────────────────
        if (!introComplete.current && introPhase.current !== "far") {
            introTimer.current += delta;

            if (introPhase.current === "approach") {
                // 3-second approach: camera glides toward the scene
                const duration = 3.0;
                const t = Math.min(introTimer.current / duration, 1.0);
                const eased = easeOutExpo(t);

                camera.position.lerpVectors(
                    introStartPos.current,
                    introEndPos.current,
                    eased
                );

                if ("target" in controls && controls.target instanceof THREE.Vector3) {
                    controls.target.lerp(introEndLookAt.current, eased * 0.08 + 0.02);
                }

                controls.update();

                if (t >= 1.0) {
                    introPhase.current = "settle";
                    introTimer.current = 0;
                }
                return;
            }

            if (introPhase.current === "settle") {
                // 1-second settling with gentle rotation
                const duration = 1.5;
                const t = Math.min(introTimer.current / duration, 1.0);

                if ("target" in controls && controls.target instanceof THREE.Vector3) {
                    controls.target.lerp(introEndLookAt.current, 0.05);
                }
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
