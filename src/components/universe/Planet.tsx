/**
 * Planet Component
 *
 * Renders a single procedural 3D planet with:
 * - GLSL fragment shader that generates surface features (continents, bands, craters)
 * - Different visual styles per file type:
 *     JS  → Lava/rocky world (orange/red noise terrain)
 *     TS  → Ocean world (blue with land masses)
 *     Config → Barren rocky (grey/brown cratered surface)
 *     Test → Terrestrial (green continents, blue oceans)
 *     Docs → Ice world (pale blue/white smooth)
 *     Style → Gas giant (banded atmospheric stripes)
 *     Data → Crystal/mineral world (golden veins)
 *     Other → Dead moon (grey, heavily cratered)
 * - Atmosphere rim glow (Fresnel-based outer shell)
 * - Axial tilt + self-rotation
 * - Saturn-like rings for heavily-modified files
 * - Hover interaction for tooltips
 */

"use client";

import React, { useRef, useMemo } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

// ─── GLSL Simplex Noise (Ashima/webgl-noise) ────────────────────────────────

const NOISE_GLSL = /* glsl */ `
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

float fbm(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
        value += amplitude * snoise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}
`;

// ─── Planet Surface Vertex Shader ────────────────────────────────────────────

const PLANET_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;

${NOISE_GLSL}

uniform float uTime;
uniform float uDisplacement;
uniform float uSeed;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    // Visible surface displacement for terrain
    vec3 pos = position;
    float disp = fbm(pos * 2.5 + uSeed, 5) * uDisplacement;
    pos += normal * disp;

    vPosition = (modelViewMatrix * vec4(pos, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

// ─── Planet Surface Fragment Shader ──────────────────────────────────────────

const PLANET_FRAGMENT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;

${NOISE_GLSL}

uniform float uTime;
uniform float uSeed;
uniform int uPlanetType;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uLightIntensity;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(-vPosition);

    // Dramatic 3-point lighting (key + fill + rim)
    vec3 lightDir = normalize(vec3(1.0, 0.8, 0.5));
    float NdotL = max(dot(normal, lightDir), 0.0);
    // Soft shadow terminator for realistic look
    float shadow = smoothstep(-0.05, 0.2, NdotL);
    float fill = max(dot(normal, normalize(vec3(-0.5, 0.3, -0.8))), 0.0) * 0.12;
    float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.0) * 0.25;
    float lighting = shadow * uLightIntensity + fill + rim + 0.06;

    // Noise coordinates (rotated by time for slow surface drift)
    float t = uTime * 0.03;
    vec3 noisePos = vec3(
        vUv.x * 6.28 + uSeed,
        vUv.y * 3.14 + uSeed * 0.7,
        uSeed * 2.0
    );
    // Use spherical position for more natural noise
    vec3 spherePos = normal * 2.0 + vec3(uSeed);

    vec3 color;

    // ── TYPE 0: Lava/Rocky World (JavaScript) ──
    if (uPlanetType == 0) {
        float n = fbm(spherePos * 2.5 + t * 0.5, 5);
        float lava = smoothstep(0.0, 0.3, n);
        vec3 rock = uColorA * 0.6;
        vec3 hot = uColorB * 1.5;
        color = mix(hot, rock, lava);
        // Lava cracks glow
        float cracks = 1.0 - smoothstep(0.0, 0.08, abs(n));
        color += vec3(1.0, 0.3, 0.05) * cracks * 0.8;
    }
    // ── TYPE 1: Ocean World (TypeScript) ──
    else if (uPlanetType == 1) {
        float continent = fbm(spherePos * 2.0, 5);
        float shoreline = smoothstep(-0.05, 0.15, continent);
        vec3 ocean = uColorA;
        vec3 land = uColorB;
        vec3 shore = mix(uColorA, uColorC, 0.5);
        color = mix(ocean, shore, smoothstep(-0.05, 0.05, continent));
        color = mix(color, land, smoothstep(0.05, 0.2, continent));
        // Deep ocean specular
        float spec = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 40.0);
        color += vec3(0.3, 0.5, 0.7) * spec * (1.0 - shoreline) * 0.5;
    }
    // ── TYPE 2: Mars-like Rocky (Config) ──
    else if (uPlanetType == 2) {
        float terrain = fbm(spherePos * 3.0, 5);
        float craters = snoise(spherePos * 7.0 + uSeed);
        craters = smoothstep(0.45, 0.65, craters) * 0.35;
        float ridges = abs(snoise(spherePos * 5.0)) * 0.2;
        color = mix(uColorA, uColorB, terrain * 0.5 + 0.5);
        color += uColorC * ridges; // elevated ridges
        color -= craters; // darken craters
        // Polar dust caps
        float polar = abs(normal.y);
        color = mix(color, uColorB * 1.3, smoothstep(0.8, 0.95, polar));
        color = max(color, vec3(0.04));
    }
    // ── TYPE 3: Terrestrial (Test) ──
    else if (uPlanetType == 3) {
        float continent = fbm(spherePos * 1.8, 5);
        float polar = abs(normal.y);
        vec3 ocean = vec3(0.05, 0.15, 0.4);
        vec3 land = uColorA;
        vec3 desert = uColorB;
        vec3 ice = vec3(0.85, 0.9, 0.95);
        color = mix(ocean, land, smoothstep(-0.05, 0.15, continent));
        color = mix(color, desert, smoothstep(0.3, 0.5, continent));
        // Polar ice caps
        color = mix(color, ice, smoothstep(0.75, 0.9, polar));
    }
    // ── TYPE 4: Ice World (Docs) ──
    else if (uPlanetType == 4) {
        float surface = fbm(spherePos * 3.0, 3) * 0.3;
        float cracks = snoise(spherePos * 10.0) * 0.1;
        color = mix(uColorA, uColorB, surface + 0.5);
        color += vec3(0.1, 0.15, 0.25) * cracks;
        // Subsurface glow
        float sss = pow(max(dot(normal, lightDir), 0.0), 1.5) * 0.15;
        color += uColorA * sss;
    }
    // ── TYPE 5: Gas Giant (Style) ──
    else if (uPlanetType == 5) {
        // Horizontal bands like Jupiter
        float bands = sin(normal.y * 20.0 + fbm(spherePos * vec3(1.0, 0.2, 1.0) * 3.0, 4) * 3.0);
        float storm = fbm(spherePos * 4.0 + vec3(t, 0.0, 0.0), 4);
        vec3 band1 = uColorA;
        vec3 band2 = uColorB;
        vec3 stormColor = uColorC;
        color = mix(band1, band2, bands * 0.5 + 0.5);
        // Great spot
        float spot = smoothstep(0.55, 0.65, storm);
        color = mix(color, stormColor, spot * 0.6);
    }
    // ── TYPE 6: Crystal World (Data) ──
    else if (uPlanetType == 6) {
        float crystal = fbm(spherePos * 5.0, 3);
        float veins = abs(snoise(spherePos * 12.0));
        veins = smoothstep(0.0, 0.15, veins);
        color = mix(uColorA, uColorB, crystal * 0.5 + 0.5);
        color += uColorC * (1.0 - veins) * 0.4; // golden vein glow
        float spec = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 60.0);
        color += vec3(1.0, 0.9, 0.6) * spec * 0.3;
    }
    // ── TYPE 7: Dead Moon (Other) ──
    else {
        float terrain = fbm(spherePos * 5.0, 4);
        float craters = snoise(spherePos * 10.0 + uSeed * 3.0);
        craters = smoothstep(0.4, 0.6, craters) * 0.4;
        color = mix(uColorA, uColorB, terrain * 0.3 + 0.5);
        color -= craters;
        color = max(color, vec3(0.03));
    }

    color *= lighting;

    gl_FragColor = vec4(color, 1.0);
}
`;

// ─── Atmosphere Fragment Shader (Fresnel rim glow) ───────────────────────────

const ATMO_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ATMO_FRAGMENT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vPosition;

uniform vec3 uAtmoColor;
uniform float uAtmoIntensity;

void main() {
    vec3 viewDir = normalize(-vPosition);
    float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 3.0);
    float alpha = fresnel * uAtmoIntensity;
    gl_FragColor = vec4(uAtmoColor, alpha);
}
`;

// ─── Planet type → shader config mapping ─────────────────────────────────────

interface PlanetVisualConfig {
    type: number;
    colorA: THREE.Color;
    colorB: THREE.Color;
    colorC: THREE.Color;
    atmoColor: THREE.Color;
    atmoIntensity: number;
    displacement: number;
    lightIntensity: number;
}

function getPlanetVisual(fileType: string): PlanetVisualConfig {
    switch (fileType) {
        case "javascript":
            return {
                type: 0,
                colorA: new THREE.Color("#8b1a1a"),   // dark volcanic rock
                colorB: new THREE.Color("#ff5500"),   // molten lava
                colorC: new THREE.Color("#ffcc00"),   // hot glow
                atmoColor: new THREE.Color("#ff6600"),
                atmoIntensity: 0.7,
                displacement: 0.06,
                lightIntensity: 0.9,
            };
        case "typescript":
            return {
                type: 1,
                colorA: new THREE.Color("#003366"),   // deep ocean
                colorB: new THREE.Color("#2d6a1e"),   // lush green land
                colorC: new THREE.Color("#a8d5a2"),   // coastal sand
                atmoColor: new THREE.Color("#4fc3f7"),
                atmoIntensity: 0.6,
                displacement: 0.045,
                lightIntensity: 0.95,
            };
        case "config":
            return {
                type: 2,
                colorA: new THREE.Color("#5d3a1a"),   // Mars-like rust
                colorB: new THREE.Color("#c4703a"),   // reddish-orange terrain
                colorC: new THREE.Color("#a0522d"),   // sienna
                atmoColor: new THREE.Color("#d4845a"),
                atmoIntensity: 0.3,
                displacement: 0.07,
                lightIntensity: 0.85,
            };
        case "test":
            return {
                type: 3,
                colorA: new THREE.Color("#1a5e1a"),   // forests
                colorB: new THREE.Color("#c8a040"),   // sandy desert
                colorC: new THREE.Color("#e8f5e9"),   // light green
                atmoColor: new THREE.Color("#70c080"),
                atmoIntensity: 0.55,
                displacement: 0.04,
                lightIntensity: 0.95,
            };
        case "docs":
            return {
                type: 4,
                colorA: new THREE.Color("#8ecae6"),   // pale blue ice
                colorB: new THREE.Color("#e8eef4"),   // snow white
                colorC: new THREE.Color("#48b5c4"),   // cracked blue
                atmoColor: new THREE.Color("#b0d8f0"),
                atmoIntensity: 0.5,
                displacement: 0.02,
                lightIntensity: 1.0,
            };
        case "style":
            return {
                type: 5,
                colorA: new THREE.Color("#6a1b9a"),   // deep purple band
                colorB: new THREE.Color("#e8b4f8"),   // light pastel band
                colorC: new THREE.Color("#ff4081"),   // storm vortex
                atmoColor: new THREE.Color("#ce93d8"),
                atmoIntensity: 0.6,
                displacement: 0.0,
                lightIntensity: 0.9,
            };
        case "data":
            return {
                type: 6,
                colorA: new THREE.Color("#4a3520"),   // dark mineral base
                colorB: new THREE.Color("#e68a00"),   // amber crystal
                colorC: new THREE.Color("#ffd700"),   // gold veins
                atmoColor: new THREE.Color("#ffc107"),
                atmoIntensity: 0.45,
                displacement: 0.05,
                lightIntensity: 0.9,
            };
        default: // "other" = cratered moon
            return {
                type: 7,
                colorA: new THREE.Color("#505050"),   // dark grey
                colorB: new THREE.Color("#8a8a8a"),   // lighter grey
                colorC: new THREE.Color("#6e6e6e"),   // mid grey
                atmoColor: new THREE.Color("#888888"),
                atmoIntensity: 0.12,
                displacement: 0.08,
                lightIntensity: 0.7,
            };
    }
}

// ─── Seeded hash for per-planet uniqueness ───────────────────────────────────

function hashString(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) - hash) + s.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash) / 2147483647;
}

// ─── Component Props ─────────────────────────────────────────────────────────

export interface PlanetProps {
    position: [number, number, number];
    radius: number;
    fileType: string;
    fileName: string;
    path: string;
    totalModifications: number;
    totalLinesOfCode: number;
    hasRings: boolean;
    planetId: string;
    onHover?: (info: { fileName: string; fileType: string; totalModifications: number; totalLinesOfCode: number; position: THREE.Vector3 } | null) => void;
}

export default function Planet({
    position,
    radius,
    fileType,
    fileName,
    path,
    totalModifications,
    totalLinesOfCode,
    hasRings,
    planetId,
    onHover,
}: PlanetProps) {
    const groupRef = useRef<THREE.Group>(null);
    const surfaceRef = useRef<THREE.Mesh>(null);
    const ringRef = useRef<THREE.Mesh>(null);

    const seed = useMemo(() => hashString(planetId + path), [planetId, path]);
    const visual = useMemo(() => getPlanetVisual(fileType), [fileType]);

    // Axial tilt (unique per planet)
    const axialTilt = useMemo(() => seed * 0.5 - 0.25, [seed]);

    // Surface shader material
    const surfaceMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            vertexShader: PLANET_VERTEX,
            fragmentShader: PLANET_FRAGMENT,
            uniforms: {
                uTime: { value: 0 },
                uSeed: { value: seed * 100 },
                uPlanetType: { value: visual.type },
                uColorA: { value: visual.colorA },
                uColorB: { value: visual.colorB },
                uColorC: { value: visual.colorC },
                uDisplacement: { value: visual.displacement },
                uLightIntensity: { value: visual.lightIntensity },
            },
        });
    }, [seed, visual]);

    // Atmosphere shader material
    const atmoMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            vertexShader: ATMO_VERTEX,
            fragmentShader: ATMO_FRAGMENT,
            uniforms: {
                uAtmoColor: { value: visual.atmoColor },
                uAtmoIntensity: { value: visual.atmoIntensity * 0.2 },
            },
            transparent: true,
            depthWrite: false,
            side: THREE.BackSide,
            blending: THREE.NormalBlending,
        });
    }, [visual]);

    // Animate rotation — read material from mesh ref to avoid mutating useMemo value directly
    useFrame(({ clock }) => {
        const time = clock.getElapsedTime();

        if (surfaceRef.current) {
            const mat = surfaceRef.current.material as THREE.ShaderMaterial;
            if (mat.uniforms) {
                mat.uniforms.uTime.value = time;
            }
            // Slow self-rotation
            surfaceRef.current.rotation.y = time * 0.15 + seed * 10;
        }
        if (ringRef.current) {
            ringRef.current.rotation.z = time * 0.05;
        }
    });

    const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
        if (onHover) {
            onHover({
                fileName,
                fileType,
                totalModifications,
                totalLinesOfCode,
                position: new THREE.Vector3(...position),
            });
        }
    };

    const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        document.body.style.cursor = "auto";
        if (onHover) onHover(null);
    };

    return (
        <group ref={groupRef} position={position} rotation={[axialTilt, 0, 0]}>
            {/* Planet surface (procedural shader) */}
            <mesh
                ref={surfaceRef}
                material={surfaceMaterial}
                scale={radius}
                onPointerOver={handlePointerOver}
                onPointerOut={handlePointerOut}
            >
                <sphereGeometry args={[1, 32, 32]} />
            </mesh>

            {/* Atmosphere rim glow */}
            <mesh
                material={atmoMaterial}
                scale={radius * 1.04}
            >
                <sphereGeometry args={[1, 24, 24]} />
            </mesh>

            {/* Saturn-like ring for heavily-modified files */}
            {hasRings && (
                <mesh
                    ref={ringRef}
                    rotation={[Math.PI * 0.4, 0, 0]}
                    scale={radius}
                >
                    <ringGeometry args={[1.4, 2.0, 64]} />
                    <meshBasicMaterial
                        color={visual.atmoColor}
                        transparent
                        opacity={0.15}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                    />
                </mesh>
            )}
        </group>
    );
}
