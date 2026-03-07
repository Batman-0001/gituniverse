/**
 * Archaeology Overlay — 3D Fossil & Era Visualization
 *
 * When archaeology mode is active, this component:
 * 1. Highlights "fossil code" — files unchanged for 2+ years with amber glow
 * 2. Shows era color-coding on planets (age-based hue shift)
 * 3. Marks white dwarf developers with ghostly halos
 * 4. Desaturation is handled via post-processing in the parent scene
 */

"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SpatialDeveloper, SpatialPlanet } from "@/utils/spatial-layout";
import { useTemporalStore } from "@/stores/temporal-store";

interface ArchaeologyOverlayProps {
  developers: Map<string, SpatialDeveloper>;
  planets: SpatialPlanet[];
}

const ringGeo = new THREE.RingGeometry(0.85, 1.0, 32);
const sphereGeo = new THREE.SphereGeometry(1, 8, 8);

export default function ArchaeologyOverlay({
  developers,
  planets,
}: ArchaeologyOverlayProps) {
  const {
    archaeologyMode,
    isFileFossil,
    isDeveloperWhiteDwarf,
    isLiveMode,
    currentEpoch,
    timelineEnd,
  } = useTemporalStore();

  // Identify fossil planets
  const fossilPlanets = useMemo(() => {
    if (!archaeologyMode) return [];
    return planets.filter((p) => isFileFossil(p.id));
  }, [archaeologyMode, planets, isFileFossil, currentEpoch]);

  // Identify white dwarf developers (at current epoch)
  const whiteDwarfDevs = useMemo(() => {
    if (!archaeologyMode) return [];
    const result: SpatialDeveloper[] = [];
    for (const [id, dev] of developers) {
      if (!dev.isActive || isDeveloperWhiteDwarf(id)) {
        result.push(dev);
      }
    }
    return result;
  }, [archaeologyMode, developers, isDeveloperWhiteDwarf, currentEpoch]);

  if (!archaeologyMode) return null;

  return (
    <group>
      {/* Fossil planet amber glow markers */}
      <FossilMarkers planets={fossilPlanets} />

      {/* White dwarf ghost halos */}
      <WhiteDwarfHalos developers={whiteDwarfDevs} />
    </group>
  );
}

// ─── Fossil Markers ──────────────────────────────────────────────────────────

function FossilMarkers({ planets }: { planets: SpatialPlanet[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    if (!meshRef.current || planets.length === 0) return;
    const t = clock.getElapsedTime();

    for (let i = 0; i < planets.length; i++) {
      const p = planets[i];
      const pulse = Math.sin(t * 1.5 + i * 0.5) * 0.15 + 0.85;
      const scale = (p.radius + 0.3) * pulse;

      dummy.position.copy(p.position);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (planets.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[sphereGeo, undefined, planets.length]}
      frustumCulled={false}
    >
      <meshBasicMaterial
        color="#ffb464"
        transparent
        opacity={0.15}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

// ─── White Dwarf Halos ───────────────────────────────────────────────────────

function WhiteDwarfHalos({ developers }: { developers: SpatialDeveloper[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    if (!meshRef.current || developers.length === 0) return;
    const t = clock.getElapsedTime();

    for (let i = 0; i < developers.length; i++) {
      const dev = developers[i];
      const pulse = Math.sin(t * 0.8 + i * 1.2) * 0.1 + 0.9;
      const scale = (dev.radius + 1.5) * pulse;

      dummy.position.copy(dev.position);
      dummy.scale.setScalar(scale);
      dummy.rotation.set(Math.PI / 2, 0, t * 0.1 + i);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (developers.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[ringGeo, undefined, developers.length]}
      frustumCulled={false}
    >
      <meshBasicMaterial
        color="#99bbdd"
        transparent
        opacity={0.25}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
