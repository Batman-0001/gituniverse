/**
 * Camera Controller
 *
 * Manages camera transitions between view levels:
 * - Universe view: full universe, all galaxies visible, slow auto-rotate
 * - Galaxy view: camera glides to galaxy, individual stars visible
 * - Solar system view: camera orbits around developer sun, showing planets + orbits
 *
 * Smooth cubic ease-out on all transitions. Auto-orbit when idle.
 */

"use client";

import React, { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useUniverseStore } from "@/stores/universe-store";

export default function CameraController() {
    const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);
    const { camera } = useThree();

    const {
        cameraTarget,
        cameraDistance,
        viewLevel,
        spatialData,
    } = useUniverseStore();

    // Target position for smooth interpolation
    const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
    const targetPosition = useRef(new THREE.Vector3(0, 30, 200));
    const isAnimating = useRef(false);
    const animationProgress = useRef(1);

    // Update target when cameraTarget changes
    useEffect(() => {
        if (cameraTarget) {
            targetLookAt.current.set(cameraTarget.x, cameraTarget.y, cameraTarget.z);

            // Position camera relative to target based on view level
            let offsetMultiplier = 1;
            let elevationMultiplier = 0.3;

            if (viewLevel === "solar-system") {
                offsetMultiplier = 0.6;
                elevationMultiplier = 0.4;
            } else if (viewLevel === "galaxy") {
                offsetMultiplier = 0.8;
                elevationMultiplier = 0.35;
            }

            const offset = new THREE.Vector3(
                cameraDistance * 0.5 * offsetMultiplier,
                cameraDistance * elevationMultiplier,
                cameraDistance * 0.7 * offsetMultiplier
            );
            targetPosition.current.copy(targetLookAt.current).add(offset);

            isAnimating.current = true;
            animationProgress.current = 0;
        } else if (spatialData) {
            // Reset to overview
            targetLookAt.current.copy(spatialData.bounds.center);
            const dist = spatialData.bounds.radius * 2;
            targetPosition.current.set(
                spatialData.bounds.center.x,
                spatialData.bounds.center.y + dist * 0.3,
                spatialData.bounds.center.z + dist
            );
            isAnimating.current = true;
            animationProgress.current = 0;
        }
    }, [cameraTarget, cameraDistance, spatialData, viewLevel]);

    // Set initial camera position
    useEffect(() => {
        if (spatialData) {
            const dist = spatialData.bounds.radius * 2;
            camera.position.set(
                spatialData.bounds.center.x,
                spatialData.bounds.center.y + dist * 0.3,
                spatialData.bounds.center.z + dist
            );
            camera.lookAt(spatialData.bounds.center);
        }
    }, [spatialData, camera]);

    // Smooth camera animation
    useFrame((_, delta) => {
        if (!controlsRef.current) return;
        const controls = controlsRef.current;

        if (isAnimating.current && animationProgress.current < 1) {
            // Advance progress
            animationProgress.current = Math.min(
                1,
                animationProgress.current + delta * 1.2
            );

            // Ease out cubic for smooth deceleration
            const t = 1 - Math.pow(1 - animationProgress.current, 3);

            // Smoothly interpolate camera position
            camera.position.lerp(targetPosition.current, t * 0.06);

            // Smoothly interpolate look-at target
            if ("target" in controls && controls.target instanceof THREE.Vector3) {
                controls.target.lerp(targetLookAt.current, t * 0.06);
            }

            controls.update();

            if (animationProgress.current >= 1) {
                isAnimating.current = false;
            }
        }

        // Auto-rotate gently in universe view when not animating
        if (!isAnimating.current && viewLevel === "universe") {
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.15;
        } else {
            controls.autoRotate = false;
        }
    });

    return (
        <OrbitControls
            ref={controlsRef}
            makeDefault
            enablePan
            enableZoom
            enableRotate
            minDistance={3}
            maxDistance={800}
            zoomSpeed={0.8}
            rotateSpeed={0.5}
            panSpeed={0.8}
            dampingFactor={0.08}
            enableDamping
        />
    );
}
