/**
 * Galaxy Nebula Component — Realistic Volumetric Rewrite
 *
 * Renders each galaxy as a photorealistic nebula cloud:
 * 1. Custom GLSL volumetric shader with multi-octave fbm noise
 * 2. Filamentary wisps using turbulent noise (Carina Nebula style)
 * 3. Vivid purple/magenta core → fuchsia midtones → deep violet edges
 * 4. Dark dust lanes for depth and contrast
 * 5. Animated slow cloud evolution
 * 6. Multiple billboard layers for parallax depth
 * 7. Emissive core that interacts with bloom post-processing
 */

"use client";

import React, { useRef, useMemo } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { SpatialGalaxy } from "@/utils/spatial-layout";
import { useUniverseStore } from "@/stores/universe-store";

interface GalaxyNebulaProps {
    galaxy: SpatialGalaxy;
}

// ─── Nebula Cloud Vertex Shader ──────────────────────────────────────────────

const NEBULA_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// ─── Simplex Noise GLSL (shared) ─────────────────────────────────────────────

const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
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
    for (int i = 0; i < 6; i++) {
        value += amplitude * snoise(p * frequency);
        frequency *= 2.1;
        amplitude *= 0.45;
    }
    return value;
}

float turbulence(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 5; i++) {
        value += amplitude * abs(snoise(p * frequency));
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}
`;

// ─── Outer Nebula Cloud Fragment Shader ──────────────────────────────────────

const NEBULA_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform vec3 uColorCore;
uniform vec3 uColorWarm;
uniform vec3 uColorCool;
uniform float uIntensity;

varying vec2 vUv;

${NOISE_GLSL}

void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);

    // Soft organic radial falloff — tighter for compact cloud
    float radialFalloff = 1.0 - smoothstep(0.0, 0.38, dist);
    if (radialFalloff < 0.001) discard;

    float t = uTime * 0.04 + uSeed;

    // 3D noise coordinate from 2D UV + seed for uniqueness
    vec3 noisePos = vec3(center * 4.5 + uSeed, t * 0.3);

    // Layer 1: Main cloud structure (large-scale nebula shapes)
    float mainCloud = fbm(noisePos * 1.0 + vec3(t * 0.1, -t * 0.05, t * 0.08));
    mainCloud = mainCloud * 0.5 + 0.5;

    // Layer 2: Filamentary wisps (turbulent tendrils like Carina Nebula)
    float wisps = turbulence(noisePos * 2.0 + vec3(-t * 0.06, t * 0.12, -t * 0.04));

    // Layer 3: Fine detail
    float detail = fbm(noisePos * 4.5 + vec3(t * 0.15, t * 0.08, -t * 0.1));
    detail = detail * 0.5 + 0.5;

    // Layer 4: Dark dust lanes (carved-out regions for depth/contrast)
    float dustLanes = fbm(noisePos * 1.8 + vec3(t * 0.02, -t * 0.07, t * 0.03));
    dustLanes = smoothstep(-0.1, 0.3, dustLanes);

    // Combine layers into density
    float density = mainCloud * 0.6 + wisps * 0.3 + detail * 0.1;

    // Radial zones — tighter concentration
    float coreWeight = exp(-dist * 8.0);   // tight bright core
    float midWeight = exp(-dist * 3.5);    // warm mid-range
    // float edgeWeight = radialFalloff;   // outer cool fringe

    density *= radialFalloff;
    density *= dustLanes;       // carve dark dust lanes
    density += coreWeight * 0.4; // boost core brightness

    // Color temperature mapping (hot core → warm → cool edges)
    vec3 coreCol = uColorCore * (1.0 + coreWeight * 2.0);
    vec3 nebulaColor = mix(uColorCool, uColorWarm, midWeight);
    nebulaColor = mix(nebulaColor, coreCol, coreWeight);
    nebulaColor += uColorWarm * wisps * 0.15 * radialFalloff;

    // Emissive boost for bloom interaction
    nebulaColor *= (1.0 + coreWeight * 1.5) * uIntensity;

    // Final alpha — concentrated
    float alpha = density * radialFalloff * 0.9;
    alpha = clamp(alpha, 0.0, 1.0);
    alpha *= smoothstep(0.38, 0.15, dist);

    if (alpha < 0.005) discard;

    gl_FragColor = vec4(nebulaColor, alpha);
}
`;

// ─── Inner Radiant Glow Fragment Shader ──────────────────────────────────────

const INNER_GLOW_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform vec3 uColorCore;
uniform float uIntensity;

varying vec2 vUv;

${NOISE_GLSL}

void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);

    float t = uTime * 0.06 + uSeed;
    vec3 noisePos = vec3(center * 6.0 + uSeed * 0.5, t * 0.2);

    float cloud = fbm(noisePos);
    cloud = cloud * 0.5 + 0.5;

    // Tight radiant glow falloff
    float glow = exp(-dist * 10.0);
    float midGlow = exp(-dist * 5.0);

    float density = glow * 0.8 + midGlow * cloud * 0.3;

    vec3 col = uColorCore * (1.0 + glow * 3.0) * uIntensity;

    float alpha = density * 0.6;
    alpha *= smoothstep(0.3, 0.05, dist);

    if (alpha < 0.005) discard;

    gl_FragColor = vec4(col, alpha);
}
`;

// ─── Component ───────────────────────────────────────────────────────────────

export default function GalaxyNebula({ galaxy }: GalaxyNebulaProps) {
    const outerRef = useRef<THREE.Mesh>(null);
    const innerRef = useRef<THREE.Mesh>(null);
    const floatGroupRef = useRef<THREE.Group>(null);

    const floatSeed = useMemo(
        () => galaxy.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 2.3,
        [galaxy.name]
    );

    const { selectedGalaxyId, selectGalaxy, showLabels } = useUniverseStore();
    const isSelected = selectedGalaxyId === galaxy.id;

    const hashSeed = galaxy.name
        .split("")
        .reduce((a, c) => a + c.charCodeAt(0), 0);

    // Derive nebula colors — vivid purple/magenta/pink palette
    const nebulaColors = useMemo(() => {
        const hue = galaxy.colorHue / 360;
        return {
            // Bright hot-pink / white-pink core
            core: new THREE.Color().setHSL((hue + 0.0) % 1.0, 0.7, 0.82),
            // Saturated magenta/fuchsia mid-tones
            warm: new THREE.Color().setHSL((hue + 0.95) % 1.0, 0.75, 0.5),
            // Deep violet/purple edges
            cool: new THREE.Color().setHSL((hue + 0.08) % 1.0, 0.6, 0.18),
        };
    }, [galaxy.colorHue]);

    // Visual radius — compact concentrated cloud
    const nebulaSize = galaxy.radius * 1.8;

    // Outer nebula cloud material
    const outerMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            vertexShader: NEBULA_VERTEX,
            fragmentShader: NEBULA_FRAGMENT,
            uniforms: {
                uTime: { value: 0 },
                uSeed: { value: hashSeed * 0.1 },
                uColorCore: { value: nebulaColors.core },
                uColorWarm: { value: nebulaColors.warm },
                uColorCool: { value: nebulaColors.cool },
                uIntensity: { value: 1.2 },
            },
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
        });
    }, [hashSeed, nebulaColors]);

    // Inner glow material — brighter, tighter
    const innerMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            vertexShader: NEBULA_VERTEX,
            fragmentShader: INNER_GLOW_FRAGMENT,
            uniforms: {
                uTime: { value: 0 },
                uSeed: { value: hashSeed * 0.1 + 5.0 },
                uColorCore: { value: nebulaColors.core },
                uIntensity: { value: 1.5 },
            },
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
        });
    }, [hashSeed, nebulaColors]);

    useFrame(({ clock }) => {
        const time = clock.getElapsedTime();

        if (outerRef.current) {
            const mat = outerRef.current.material as THREE.ShaderMaterial;
            if (mat.uniforms) {
                mat.uniforms.uTime.value = time;
                mat.uniforms.uIntensity.value = isSelected ? 1.6 : 1.2;
            }
        }
        if (innerRef.current) {
            const mat = innerRef.current.material as THREE.ShaderMaterial;
            if (mat.uniforms) {
                mat.uniforms.uTime.value = time;
                mat.uniforms.uIntensity.value = isSelected ? 2.0 : 1.5;
            }
        }

        // Gentle floating
        if (floatGroupRef.current) {
            const bobY = Math.sin(time * 0.15 + floatSeed) * 0.5;
            const bobX = Math.cos(time * 0.1 + floatSeed * 1.4) * 0.35;
            const bobZ = Math.sin(time * 0.12 + floatSeed * 0.8) * 0.35;
            floatGroupRef.current.position.set(bobX, bobY, bobZ);
        }
    });

    const handleClick = (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        selectGalaxy(isSelected ? null : galaxy.id);
    };

    return (
        <group position={galaxy.position}>
            <group ref={floatGroupRef}>
                {/* Outer nebula cloud — large diffuse procedural volume */}
                <Billboard follow lockX={false} lockY={false} lockZ={false}>
                    <mesh
                        ref={outerRef}
                        material={outerMaterial}
                        onClick={handleClick}
                        renderOrder={1}
                    >
                        <planeGeometry args={[nebulaSize * 2, nebulaSize * 2]} />
                    </mesh>
                </Billboard>

                {/* Inner radiant glow — bright emissive core for bloom */}
                <Billboard follow lockX={false} lockY={false} lockZ={false}>
                    <mesh ref={innerRef} material={innerMaterial} renderOrder={2}>
                        <planeGeometry
                            args={[nebulaSize * 0.7, nebulaSize * 0.7]}
                        />
                    </mesh>
                </Billboard>

                {/* Selection ring */}
                {isSelected && (
                    <mesh rotation={[Math.PI / 2, 0, 0]}>
                        <ringGeometry
                            args={[nebulaSize * 0.52, nebulaSize * 0.54, 64]}
                        />
                        <meshBasicMaterial
                            color={nebulaColors.warm}
                            transparent
                            opacity={0.2}
                            side={THREE.DoubleSide}
                            depthWrite={false}
                            blending={THREE.AdditiveBlending}
                        />
                    </mesh>
                )}

                {/* Label */}
                {showLabels && (
                    <Billboard follow lockX={false} lockY={false} lockZ={false}>
                        <Text
                            position={[0, nebulaSize * 0.55, 0]}
                            fontSize={1.0}
                            color={`hsl(${galaxy.colorHue}, 45%, 65%)`}
                            anchorX="center"
                            anchorY="bottom"
                            outlineWidth={0.04}
                            outlineColor="#000000"
                            fillOpacity={isSelected ? 0.9 : 0.4}
                            letterSpacing={0.1}
                            renderOrder={20}
                            material-depthTest={false}
                            material-depthWrite={false}
                        >
                            {galaxy.name.toUpperCase()}
                        </Text>
                        {isSelected && (
                            <Text
                                position={[0, nebulaSize * 0.55 - 1.2, 0]}
                                fontSize={0.5}
                                color="rgba(255,255,255,0.4)"
                                anchorX="center"
                                anchorY="bottom"
                                renderOrder={20}
                                material-depthTest={false}
                                material-depthWrite={false}
                            >
                                {`${galaxy.totalFiles} files · ${galaxy.totalDevelopers} devs`}
                            </Text>
                        )}
                    </Billboard>
                )}
            </group>
        </group>
    );
}
