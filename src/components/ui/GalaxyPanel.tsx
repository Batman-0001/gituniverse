/**
 * Galaxy Detail Panel
 *
 * Slides in from the right when a galaxy (nebula) is selected.
 * Shows:
 * - Galaxy name, detection method, file/developer count
 * - Color-coded nebula indicator
 * - Developers within this galaxy
 * - File type breakdown
 * - Drift velocity indicator
 */

"use client";

import React from "react";
import { motion } from "framer-motion";
import {
    X,
    Layers,
    Users,
    FileText,
    Activity,
    Compass,
} from "lucide-react";
import { useUniverseStore } from "@/stores/universe-store";

const detectionMethodLabels: Record<string, { label: string; color: string }> = {
    explicit: { label: "Explicit (monorepo config)", color: "var(--blue-giant)" },
    structural: { label: "Structural (own package.json)", color: "var(--galaxy-teal)" },
    inferred: { label: "Inferred (file clustering)", color: "var(--binary-pulse)" },
    manual: { label: "Manual tag", color: "var(--solar-warm)" },
};

export default function GalaxyPanel() {
    const { spatialData, selectedGalaxyId, selectGalaxy, selectDeveloper } = useUniverseStore();

    if (!selectedGalaxyId || !spatialData) return null;

    const galaxy = spatialData.galaxies.find((g) => g.id === selectedGalaxyId);
    if (!galaxy) return null;

    // Get developers in this galaxy
    const galaxyDevelopers = spatialData.developers.filter(
        (d) => d.galaxyIds.includes(galaxy.id)
    );

    // Get planets in this galaxy
    const galaxyPlanets = spatialData.planets.filter((p) => {
        const owner = spatialData.developers.find((d) => d.id === p.ownerId);
        return owner && owner.galaxyIds.includes(galaxy.id);
    });

    // File type breakdown
    const fileTypeBreakdown = galaxyPlanets.reduce<Record<string, number>>((acc, p) => {
        acc[p.fileType] = (acc[p.fileType] || 0) + 1;
        return acc;
    }, {});

    const detectionInfo = detectionMethodLabels[galaxy.detectionMethod] || detectionMethodLabels.inferred;

    const stellarTypeConfig: Record<string, { color: string }> = {
        blue_giant: { color: "var(--blue-giant)" },
        yellow_sun: { color: "var(--star-core)" },
        orange_dwarf: { color: "var(--solar-warm)" },
        red_giant: { color: "var(--red-giant)" },
        white_dwarf: { color: "var(--white-dwarf)" },
    };

    const fileTypeColors: Record<string, string> = {
        javascript: "#ff5500",
        typescript: "#3178c6",
        config: "#78909c",
        test: "#66bb6a",
        docs: "#8ecae6",
        style: "#ce93d8",
        data: "#ffd54f",
        other: "#9e9e9e",
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{
                position: "absolute",
                top: "72px",
                right: 0,
                bottom: "60px",
                width: "320px",
                background: "rgba(3,0,20,0.9)",
                backdropFilter: "blur(20px)",
                borderLeft: "1px solid rgba(108,52,131,0.25)",
                pointerEvents: "auto",
                overflowY: "auto",
                padding: "20px",
            }}
        >
            {/* Close button */}
            <button
                onClick={() => selectGalaxy(null)}
                style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "rgba(255,255,255,0.5)",
                    cursor: "pointer",
                }}
            >
                <X size={14} />
            </button>

            {/* Galaxy header */}
            <div style={{ marginBottom: "20px", textAlign: "center" }}>
                {/* Nebula indicator glow */}
                <div
                    style={{
                        width: "64px",
                        height: "64px",
                        borderRadius: "50%",
                        margin: "0 auto 12px",
                        background: `radial-gradient(circle, hsl(${galaxy.colorHue}, 60%, 50%), hsl(${galaxy.colorHue}, 40%, 20%), transparent)`,
                        boxShadow: `0 0 30px hsla(${galaxy.colorHue}, 60%, 50%, 0.4), 0 0 60px hsla(${galaxy.colorHue}, 60%, 50%, 0.2)`,
                    }}
                />

                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#fff", marginBottom: "4px" }}>
                    {galaxy.name}
                </h2>
                <span
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "11px",
                        padding: "3px 10px",
                        borderRadius: "var(--radius-full)",
                        background: `${detectionInfo.color}15`,
                        border: `1px solid ${detectionInfo.color}30`,
                        color: detectionInfo.color,
                        fontWeight: 500,
                    }}
                >
                    <Compass size={10} />
                    {detectionInfo.label}
                </span>
            </div>

            {/* Stats grid */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "8px",
                    marginBottom: "20px",
                }}
            >
                {[
                    { icon: FileText, value: galaxy.totalFiles, label: "Files", color: `hsl(${galaxy.colorHue}, 50%, 65%)` },
                    { icon: Users, value: galaxy.totalDevelopers, label: "Developers", color: "var(--star-core)" },
                    { icon: Layers, value: Object.keys(fileTypeBreakdown).length, label: "File Types", color: "var(--blue-giant)" },
                    { icon: Activity, value: galaxyDevelopers.filter((d) => d.isActive).length, label: "Active Stars", color: "var(--success-green)" },
                ].map((stat, i) => (
                    <div
                        key={i}
                        style={{
                            padding: "10px",
                            background: "rgba(255,255,255,0.02)",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid rgba(255,255,255,0.04)",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                            <stat.icon size={10} style={{ color: stat.color }} />
                            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
                                {stat.label}
                            </span>
                        </div>
                        <p style={{ fontSize: "16px", fontWeight: 700, color: "#fff" }}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* File Type Breakdown */}
            {Object.keys(fileTypeBreakdown).length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                    <h3 style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.5)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        marginBottom: "8px",
                    }}>
                        Planet Composition
                    </h3>
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {Object.entries(fileTypeBreakdown)
                            .sort(([, a], [, b]) => b - a)
                            .map(([type, count]) => (
                                <span
                                    key={type}
                                    style={{
                                        fontSize: "10px",
                                        padding: "3px 8px",
                                        borderRadius: "var(--radius-full)",
                                        background: `${fileTypeColors[type] || "#666"}20`,
                                        border: `1px solid ${fileTypeColors[type] || "#666"}40`,
                                        color: fileTypeColors[type] || "#999",
                                        fontWeight: 500,
                                    }}
                                >
                                    {type} ({count})
                                </span>
                            ))}
                    </div>
                </div>
            )}

            {/* Developer Stars in Galaxy */}
            {galaxyDevelopers.length > 0 && (
                <div>
                    <h3 style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.5)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        marginBottom: "8px",
                    }}>
                        Stars in Galaxy ({galaxyDevelopers.length})
                    </h3>
                    {galaxyDevelopers
                        .slice()
                        .sort((a, b) => b.normalizedMass - a.normalizedMass)
                        .map((dev) => {
                            const config = stellarTypeConfig[dev.stellarType] || stellarTypeConfig.yellow_sun;
                            return (
                                <button
                                    key={dev.id}
                                    onClick={() => selectDeveloper(dev.id)}
                                    style={{
                                        width: "100%",
                                        padding: "8px",
                                        marginBottom: "2px",
                                        borderRadius: "var(--radius-sm)",
                                        background: "transparent",
                                        border: "1px solid transparent",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        cursor: "pointer",
                                        textAlign: "left",
                                        color: "#fff",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${Math.max(8, dev.normalizedMass * 0.15 + 6)}px`,
                                            height: `${Math.max(8, dev.normalizedMass * 0.15 + 6)}px`,
                                            borderRadius: "50%",
                                            background: `radial-gradient(circle, ${config.color}, transparent)`,
                                            boxShadow: `0 0 ${dev.normalizedMass * 0.08 + 2}px ${config.color}`,
                                            flexShrink: 0,
                                            opacity: dev.isActive ? 1 : 0.4,
                                        }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: "12px",
                                            fontWeight: 600,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}>
                                            {dev.name}
                                        </div>
                                        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>
                                            {dev.totalCommits} commits · mass {dev.normalizedMass.toFixed(0)}
                                        </div>
                                    </div>
                                    {!dev.isActive && (
                                        <span style={{ fontSize: "8px", color: "var(--white-dwarf)" }}>DWARF</span>
                                    )}
                                </button>
                            );
                        })}
                </div>
            )}
        </motion.div>
    );
}
