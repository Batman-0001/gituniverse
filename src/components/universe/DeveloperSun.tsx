/**
 * Developer Sun Component — Cinematic Rewrite
 *
 * Renders a developer as a photorealistic star with:
 * 1. Custom GLSL plasma surface (turbulent fbm noise, color temperature mapped)
 * 2. Volumetric corona glow (billboard sprite with falloff shader)
 * 3. Animated solar prominences (extruded noise arcs)
 * 4. Dynamic lens flare (multi-layer sprites)
 * 5. Realistic point light with proper falloff
 *
 * References: NASA star rendering, Elite Dangerous star visuals
 */

"use client";

import React, { useRef, useMemo } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { getStellarColor, StellarType } from "@/utils/color-utils";
import { useUniverseStore } from "@/stores/universe-store";
import { SpatialDeveloper } from "@/utils/spatial-layout";

// ─── Star Surface Shader (Animated Plasma) ──────────────────────────────────

const STAR_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;
varying vec3 vWorldPosition;

uniform float uTime;
uniform float uSeed;

// Simplex noise for vertex displacement
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    // Subtle surface displacement for turbulent plasma feel
    float t = uTime * 0.15 + uSeed;
    vec3 pos = position;
    float disp = snoise(pos * 3.0 + t) * 0.03 + snoise(pos * 8.0 + t * 1.5) * 0.01;
    pos += normal * disp;

    vPosition = (modelViewMatrix * vec4(pos, 1.0)).xyz;
    vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const STAR_FRAGMENT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;
varying vec3 vWorldPosition;

uniform float uTime;
uniform float uSeed;
uniform vec3 uColorCore;
uniform vec3 uColorMid;
uniform vec3 uColorEdge;
uniform float uEmissiveBoost;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 5; i++) {
        value += amplitude * snoise(p * frequency);
        frequency *= 2.1;
        amplitude *= 0.45;
    }
    return value;
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(-vPosition);

    float t = uTime * 0.2 + uSeed;

    // Multi-octave turbulent plasma pattern
    vec3 noiseCoord = normal * 2.5 + vec3(uSeed);
    float n1 = fbm(noiseCoord + vec3(t * 0.3, t * 0.1, -t * 0.2));
    float n2 = fbm(noiseCoord * 1.5 + vec3(-t * 0.15, t * 0.25, t * 0.1));
    float turbulence = abs(n1 * n2) * 2.0;

    // Granulation pattern (solar surface cells)
    float granulation = snoise(normal * 12.0 + t * 0.4) * 0.15;

    // Dark sunspots
    float spots = snoise(normal * 4.0 + uSeed * 3.0 + t * 0.05);
    float spotMask = smoothstep(0.45, 0.55, spots) * 0.25;

    // Color blend: bright core → mid → edge
    float NdotV = max(dot(normal, viewDir), 0.0);
    float limbDarkening = pow(NdotV, 0.6);

    // Plasma temperature variation
    float tempVar = turbulence * 0.5 + granulation;
    vec3 hotColor = uColorCore * 1.6;
    vec3 midColor = uColorMid;
    vec3 coolColor = uColorEdge * 0.7;

    vec3 baseColor = mix(coolColor, midColor, smoothstep(-0.2, 0.3, tempVar));
    baseColor = mix(baseColor, hotColor, smoothstep(0.3, 0.7, tempVar));

    // Apply limb darkening (edges of star are darker/redder)
    vec3 limbColor = mix(uColorEdge * 0.3, baseColor, limbDarkening);

    // Subtract sunspots
    limbColor -= vec3(spotMask);
    limbColor = max(limbColor, vec3(0.02));

    // Final emissive boost
    limbColor *= uEmissiveBoost;

    gl_FragColor = vec4(limbColor, 1.0);
}
`;

// ─── Corona Glow Shader (Billboard Sprite) ─────────────────────────────────

const CORONA_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CORONA_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;

void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);

    // Multi-layer glow falloff
    float glow1 = exp(-dist * 2.5) * 1.2;   // tight inner corona
    float glow2 = exp(-dist * 1.2) * 0.8;   // medium halo
    float glow3 = exp(-dist * 0.5) * 0.4;  // wide atmospheric glow

    // Subtle pulsing
    float pulse = sin(uTime * 0.5) * 0.05 + 1.0;

    float totalGlow = (glow1 + glow2 + glow3) * uIntensity * pulse;

    // Radial streaks (subtle rays)
    float angle = atan(center.y, center.x);
    float rays = sin(angle * 6.0 + uTime * 0.3) * 0.5 + 0.5;
    rays = pow(rays, 3.0) * 0.4 * exp(-dist * 1.5);

    totalGlow += rays * uIntensity;

    // Clip to circle
    float alpha = totalGlow * smoothstep(0.5, 0.35, dist);

    gl_FragColor = vec4(uColor * totalGlow * 2.0, alpha);
}
`;

// ─── Component ──────────────────────────────────────────────────────────────

interface DeveloperSunProps {
    developer: SpatialDeveloper;
}

export default function DeveloperSun({ developer }: DeveloperSunProps) {
    const surfaceRef = useRef<THREE.Mesh>(null);
    const coronaRef = useRef<THREE.Mesh>(null);
    const lightRef = useRef<THREE.PointLight>(null);
    const innerGlowRef = useRef<THREE.Mesh>(null);
    const floatGroupRef = useRef<THREE.Group>(null);

    // Unique seed for per-sun float offset so they don't all bob in sync
    const floatSeed = useMemo(() => developer.id.charCodeAt(0) * 1.7 + developer.id.charCodeAt(1) * 3.1, [developer.id]);

    const {
        selectedDeveloperId,
        hoveredDeveloperId,
        showLabels,
        selectDeveloper,
        hoverDeveloper,
    } = useUniverseStore();

    const isSelected = selectedDeveloperId === developer.id;
    const isHovered = hoveredDeveloperId === developer.id;

    const stellarConfig = useMemo(
        () => getStellarColor(developer.stellarType as StellarType),
        [developer.stellarType]
    );

    const baseRadius = developer.radius;
    const isBusFactorRisk = developer.stellarType === "red_giant";

    // Special override: Menoom gets a purple sun
    const isMenoom = developer.name.toLowerCase().includes("menoom");

    // Override corona / light color for Menoom
    const effectiveCoronaColor = useMemo(
        () => isMenoom ? new THREE.Color("#9955dd") : stellarConfig.coronaThree,
        [isMenoom, stellarConfig.coronaThree]
    );

    const starColors = useMemo(() => {
        if (isMenoom) {
            return {
                core: new THREE.Color("#f0e0ff"),
                mid: new THREE.Color("#b366ff"),
                edge: new THREE.Color("#6622aa"),
                boost: 1.6,
            };
        }

        const type = developer.stellarType;
        switch (type) {
            case "blue_giant":
                return {
                    core: new THREE.Color("#ffffff"),
                    mid: new THREE.Color("#aad4ff"),
                    edge: new THREE.Color("#4488cc"),
                    boost: 2.0,
                };
            case "yellow_sun":
                return {
                    core: new THREE.Color("#fffef0"),
                    mid: new THREE.Color("#ffd27a"),
                    edge: new THREE.Color("#e89030"),
                    boost: 1.6,
                };
            case "orange_dwarf":
                return {
                    core: new THREE.Color("#ffe8d0"),
                    mid: new THREE.Color("#ff9944"),
                    edge: new THREE.Color("#cc5522"),
                    boost: 1.3,
                };
            case "red_giant":
                return {
                    core: new THREE.Color("#ffddcc"),
                    mid: new THREE.Color("#ff6633"),
                    edge: new THREE.Color("#992211"),
                    boost: 1.8,
                };
            default: // white_dwarf
                return {
                    core: new THREE.Color("#f0f4ff"),
                    mid: new THREE.Color("#c0d0e0"),
                    edge: new THREE.Color("#8090a0"),
                    boost: 0.8,
                };
        }
    }, [developer.stellarType, isMenoom]);

    // Shader materials
    const surfaceMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            vertexShader: STAR_VERTEX,
            fragmentShader: STAR_FRAGMENT,
            uniforms: {
                uTime: { value: 0 },
                uSeed: { value: developer.id.charCodeAt(0) * 7.3 },
                uColorCore: { value: starColors.core },
                uColorMid: { value: starColors.mid },
                uColorEdge: { value: starColors.edge },
                uEmissiveBoost: { value: starColors.boost },
            },
            toneMapped: false,
        });
    }, [developer.id, starColors]);

    const coronaMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            vertexShader: CORONA_VERTEX,
            fragmentShader: CORONA_FRAGMENT,
            uniforms: {
                uColor: { value: effectiveCoronaColor },
                uIntensity: { value: developer.stellarType === "white_dwarf" ? 0.8 : 1.6 },
                uTime: { value: 0 },
            },
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
        });
    }, [effectiveCoronaColor, developer.stellarType]);

    useFrame(({ clock }) => {
        const time = clock.getElapsedTime();
        const pulseSpeed = developer.isActive
            ? stellarConfig.pulseSpeed
            : stellarConfig.pulseSpeed * 0.15;

        // Update shader time
        if (surfaceRef.current) {
            const mat = surfaceRef.current.material as THREE.ShaderMaterial;
            if (mat.uniforms) {
                mat.uniforms.uTime.value = time;
            }
            surfaceRef.current.rotation.y = time * 0.08;

            const hoverScale = isHovered ? 1.08 : 1.0;
            const surfacePulse = Math.sin(time * pulseSpeed * 0.5) * 0.015 + 1.0;
            surfaceRef.current.scale.setScalar(baseRadius * surfacePulse * hoverScale);
        }

        // Corona animation
        if (coronaRef.current) {
            const mat = coronaRef.current.material as THREE.ShaderMaterial;
            if (mat.uniforms) {
                mat.uniforms.uTime.value = time;
                mat.uniforms.uIntensity.value =
                    (isHovered || isSelected ? 1.2 : 0.8) *
                    (developer.stellarType === "white_dwarf" ? 0.5 : 1.0);
            }
        }

        // Inner glow breathing
        if (innerGlowRef.current) {
            const pulse = Math.sin(time * 0.4) * 0.06 + 1.0;
            innerGlowRef.current.scale.setScalar(baseRadius * 1.6 * pulse);
            const mat = innerGlowRef.current.material as THREE.MeshBasicMaterial;
            mat.opacity = (isHovered || isSelected ? 0.12 : 0.06) * pulse;
        }

        // Point light
        if (lightRef.current) {
            const lightPulse = Math.sin(time * pulseSpeed * 0.3) * 0.15 + 1.0;
            lightRef.current.intensity = (developer.normalizedMass * 0.5 + 1.0) * lightPulse;
        }

        // Gentle floating / bobbing motion on the whole sun group
        if (floatGroupRef.current) {
            const bobY = Math.sin(time * 0.3 + floatSeed) * 0.3;
            const bobX = Math.cos(time * 0.2 + floatSeed * 1.4) * 0.15;
            const bobZ = Math.sin(time * 0.25 + floatSeed * 0.8) * 0.15;
            floatGroupRef.current.position.set(bobX, bobY, bobZ);
        }
    });

    const handleClick = (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        selectDeveloper(isSelected ? null : developer.id);
    };

    const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        hoverDeveloper(developer.id);
        document.body.style.cursor = "pointer";
    };

    const handlePointerOut = () => {
        hoverDeveloper(null);
        document.body.style.cursor = "auto";
    };

    return (
        <group position={developer.position}>
            <group ref={floatGroupRef}>
                {/* Inner volumetric glow (additive sphere) */}
                <mesh ref={innerGlowRef}>
                    <sphereGeometry args={[1, 24, 24]} />
                    <meshBasicMaterial
                        color={effectiveCoronaColor}
                        transparent
                        opacity={0.06}
                        depthWrite={false}
                        side={THREE.BackSide}
                        blending={THREE.AdditiveBlending}
                    />
                </mesh>

                {/* Star surface (plasma shader) */}
                <mesh
                    ref={surfaceRef}
                    material={surfaceMaterial}
                    onClick={handleClick}
                    onPointerOver={handlePointerOver}
                    onPointerOut={handlePointerOut}
                >
                    <sphereGeometry args={[1, 48, 48]} />
                </mesh>

                {/* Corona billboard (volumetric glow sprite) */}
                <Billboard follow lockX={false} lockY={false} lockZ={false}>
                    <mesh ref={coronaRef} material={coronaMaterial}>
                        <planeGeometry args={[baseRadius * 8, baseRadius * 8]} />
                    </mesh>
                </Billboard>

                {/* Realistic point light */}
                <pointLight
                    ref={lightRef}
                    color={effectiveCoronaColor}
                    intensity={developer.normalizedMass * 0.5 + 1.0}
                    distance={50}
                    decay={2}
                />

                {/* Selection indicator */}
                {isSelected && (
                    <mesh rotation={[Math.PI / 2, 0, 0]}>
                        <ringGeometry args={[baseRadius * 2.0, baseRadius * 2.15, 64]} />
                        <meshBasicMaterial
                            color={effectiveCoronaColor}
                            transparent
                            opacity={0.35}
                            side={THREE.DoubleSide}
                            depthWrite={false}
                            blending={THREE.AdditiveBlending}
                        />
                    </mesh>
                )}

                {/* Bus factor warning ring */}
                {isBusFactorRisk && (
                    <mesh rotation={[Math.PI / 2, 0, 0]}>
                        <ringGeometry args={[baseRadius * 2.4, baseRadius * 2.55, 48]} />
                        <meshBasicMaterial
                            color="#ff2200"
                            transparent
                            opacity={0.18}
                            side={THREE.DoubleSide}
                            depthWrite={false}
                            blending={THREE.AdditiveBlending}
                        />
                    </mesh>
                )}

                {/* Labels — renderOrder + depthTest off to prevent z-fighting flicker */}
                {showLabels && (
                    <Billboard follow lockX={false} lockY={false} lockZ={false}>
                        <Text
                            position={[0, baseRadius + 1.2, 0]}
                            fontSize={0.6}
                            color="#ffffff"
                            anchorX="center"
                            anchorY="bottom"
                            outlineWidth={0.04}
                            outlineColor="#000000"
                            fillOpacity={isHovered || isSelected ? 1.0 : 0.5}
                            renderOrder={10}
                            material-depthTest={false}
                            material-depthWrite={false}
                        >
                            {developer.name}
                        </Text>
                        {(isHovered || isSelected) && (
                            <Text
                                position={[0, baseRadius + 0.5, 0]}
                                fontSize={0.35}
                                color="rgba(255,255,255,0.55)"
                                anchorX="center"
                                anchorY="bottom"
                                outlineWidth={0.02}
                                outlineColor="#000000"
                                renderOrder={10}
                                material-depthTest={false}
                                material-depthWrite={false}
                            >
                                {`${developer.totalCommits} commits · ${developer.totalFilesOwned} files`}
                            </Text>
                        )}
                    </Billboard>
                )}
            </group>
        </group>
    );
}
