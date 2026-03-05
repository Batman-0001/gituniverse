/**
 * Color Utilities for Stellar Visualization
 *
 * Maps developer stellar types to physically-inspired color temperatures.
 * Refined for realistic, non-cartoonish rendering:
 * - Lower emissive intensities for natural star appearance
 * - Muted corona colors so bloom doesn't overpower
 * - Subtle edge colors that blend into the scene
 */

import * as THREE from "three";

// ─── Stellar Type Color Mapping ──────────────────────────────────────────────

export type StellarType =
    | "blue_giant"
    | "yellow_sun"
    | "orange_dwarf"
    | "red_giant"
    | "white_dwarf";

interface StellarColorConfig {
    core: string;
    corona: string;
    coreThree: THREE.Color;
    coronaThree: THREE.Color;
    emissiveIntensity: number;
    pulseSpeed: number;
    label: string;
}

const STELLAR_COLORS: Record<StellarType, StellarColorConfig> = {
    blue_giant: {
        core: "#aad4ff",
        corona: "#6baeff",
        coreThree: new THREE.Color("#aad4ff"),
        coronaThree: new THREE.Color("#6baeff"),
        emissiveIntensity: 0.8,
        pulseSpeed: 2.5,
        label: "Blue Giant",
    },
    yellow_sun: {
        core: "#fff4d6",
        corona: "#ffd27a",
        coreThree: new THREE.Color("#fff4d6"),
        coronaThree: new THREE.Color("#ffd27a"),
        emissiveIntensity: 0.7,
        pulseSpeed: 1.8,
        label: "Yellow Sun",
    },
    orange_dwarf: {
        core: "#ffc495",
        corona: "#e8854a",
        coreThree: new THREE.Color("#ffc495"),
        coronaThree: new THREE.Color("#e8854a"),
        emissiveIntensity: 0.6,
        pulseSpeed: 1.4,
        label: "Orange Dwarf",
    },
    red_giant: {
        core: "#ff9e8a",
        corona: "#cc4433",
        coreThree: new THREE.Color("#ff9e8a"),
        coronaThree: new THREE.Color("#cc4433"),
        emissiveIntensity: 0.9,
        pulseSpeed: 0.9,
        label: "Red Giant",
    },
    white_dwarf: {
        core: "#d8e0e6",
        corona: "#8a9aaa",
        coreThree: new THREE.Color("#d8e0e6"),
        coronaThree: new THREE.Color("#8a9aaa"),
        emissiveIntensity: 0.25,
        pulseSpeed: 0.3,
        label: "White Dwarf",
    },
};

export function getStellarColor(type: StellarType): StellarColorConfig {
    return STELLAR_COLORS[type] || STELLAR_COLORS.yellow_sun;
}

// ─── File Type Planet Colors ─────────────────────────────────────────────────

export type FileType =
    | "javascript"
    | "typescript"
    | "config"
    | "test"
    | "docs"
    | "style"
    | "data"
    | "other";

interface PlanetColorConfig {
    surface: THREE.Color;
    atmosphere: THREE.Color;
    label: string;
}

const PLANET_COLORS: Record<FileType, PlanetColorConfig> = {
    javascript: {
        surface: new THREE.Color("#e65100"),
        atmosphere: new THREE.Color("#ff6d00"),
        label: "Rocky (JS)",
    },
    typescript: {
        surface: new THREE.Color("#0277bd"),
        atmosphere: new THREE.Color("#039be5"),
        label: "Ocean (TS)",
    },
    config: {
        surface: new THREE.Color("#455a64"),
        atmosphere: new THREE.Color("#78909c"),
        label: "Metallic (Config)",
    },
    test: {
        surface: new THREE.Color("#2e7d32"),
        atmosphere: new THREE.Color("#66bb6a"),
        label: "Verdant (Test)",
    },
    docs: {
        surface: new THREE.Color("#b3e5fc"),
        atmosphere: new THREE.Color("#e1f5fe"),
        label: "Ice (Docs)",
    },
    style: {
        surface: new THREE.Color("#ce93d8"),
        atmosphere: new THREE.Color("#f3e5f5"),
        label: "Cloud (Style)",
    },
    data: {
        surface: new THREE.Color("#ffd54f"),
        atmosphere: new THREE.Color("#fff9c4"),
        label: "Crystal (Data)",
    },
    other: {
        surface: new THREE.Color("#9e9e9e"),
        atmosphere: new THREE.Color("#bdbdbd"),
        label: "Barren (Other)",
    },
};

export function getPlanetColor(type: FileType): PlanetColorConfig {
    return PLANET_COLORS[type] || PLANET_COLORS.other;
}

// ─── Galaxy Nebula Colors ────────────────────────────────────────────────────

export function getGalaxyColor(hue: number): {
    primary: THREE.Color;
    secondary: THREE.Color;
    css: string;
} {
    const primary = new THREE.Color().setHSL(hue / 360, 0.35, 0.35);
    const secondary = new THREE.Color().setHSL(((hue + 30) % 360) / 360, 0.25, 0.25);
    const css = `hsl(${hue}, 35%, 35%)`;

    return { primary, secondary, css };
}

// ─── Collaboration Edge Colors ───────────────────────────────────────────────

export function getEdgeColor(
    typeA: StellarType,
    typeB: StellarType,
    isBinary: boolean
): THREE.Color {
    if (isBinary) {
        // Muted lavender instead of blazing magenta
        return new THREE.Color("#9c7cb0");
    }

    const colorA = STELLAR_COLORS[typeA]?.coronaThree || new THREE.Color("#5588aa");
    const colorB = STELLAR_COLORS[typeB]?.coronaThree || new THREE.Color("#5588aa");

    // Blend and desaturate slightly
    const blended = new THREE.Color().lerpColors(colorA, colorB, 0.5);
    const hsl = { h: 0, s: 0, l: 0 };
    blended.getHSL(hsl);
    blended.setHSL(hsl.h, hsl.s * 0.5, hsl.l * 0.7);

    return blended;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

export function hexToThreeColor(hex: string): THREE.Color {
    return new THREE.Color(hex);
}

export function lerpColor(
    colorA: THREE.Color,
    colorB: THREE.Color,
    t: number
): THREE.Color {
    return new THREE.Color().lerpColors(colorA, colorB, t);
}
