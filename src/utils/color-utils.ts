/**
 * Color Utilities for Stellar Visualization
 *
 * Maps developer stellar types to physically-inspired color temperatures
 * and provides utility functions for color manipulation in 3D space.
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
        core: "#ffb300",
        corona: "#ff8f00",
        coreThree: new THREE.Color("#ffb300"),
        coronaThree: new THREE.Color("#ff8f00"),
        emissiveIntensity: 2.5,
        pulseSpeed: 3.0,
        label: "Solar Giant",
    },
    yellow_sun: {
        core: "#ffd700",
        corona: "#ff8c00",
        coreThree: new THREE.Color("#ffd700"),
        coronaThree: new THREE.Color("#ff8c00"),
        emissiveIntensity: 2.0,
        pulseSpeed: 2.0,
        label: "Yellow Sun",
    },
    orange_dwarf: {
        core: "#ffb74d",
        corona: "#e65100",
        coreThree: new THREE.Color("#ffb74d"),
        coronaThree: new THREE.Color("#e65100"),
        emissiveIntensity: 1.5,
        pulseSpeed: 1.5,
        label: "Orange Dwarf",
    },
    red_giant: {
        core: "#ef5350",
        corona: "#b71c1c",
        coreThree: new THREE.Color("#ef5350"),
        coronaThree: new THREE.Color("#b71c1c"),
        emissiveIntensity: 3.0,
        pulseSpeed: 1.0,
        label: "Red Giant",
    },
    white_dwarf: {
        core: "#b0bec5",
        corona: "#546e7a",
        coreThree: new THREE.Color("#cfd8dc"),
        coronaThree: new THREE.Color("#78909c"),
        emissiveIntensity: 0.5,
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
    const primary = new THREE.Color().setHSL(hue / 360, 0.6, 0.5);
    const secondary = new THREE.Color().setHSL(((hue + 30) % 360) / 360, 0.4, 0.3);
    const css = `hsl(${hue}, 60%, 50%)`;

    return { primary, secondary, css };
}

// ─── Collaboration Edge Colors ───────────────────────────────────────────────

export function getEdgeColor(
    typeA: StellarType,
    typeB: StellarType,
    isBinary: boolean
): THREE.Color {
    if (isBinary) {
        return new THREE.Color("#e040fb");
    }

    const colorA = STELLAR_COLORS[typeA]?.coreThree || new THREE.Color("#4fc3f7");
    const colorB = STELLAR_COLORS[typeB]?.coreThree || new THREE.Color("#4fc3f7");

    return new THREE.Color().lerpColors(colorA, colorB, 0.5);
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
