/**
 * Developer Detail Panel
 *
 * Slides in from the right when a developer star is selected.
 * Shows:
 * - Developer name, stellar type, mass
 * - Commit count, lines authored, files owned
 * - Collaboration partners
 * - "What would break" simulation placeholder
 */

"use client";

import React from "react";
import { motion } from "framer-motion";
import {
    X,
    Sun,
    GitBranch,
    FileText,
    Users,
    Activity,
    Calendar,
} from "lucide-react";
import { SpatialDeveloper } from "@/utils/spatial-layout";
import { useUniverseStore } from "@/stores/universe-store";

interface DeveloperPanelProps {
    developer: SpatialDeveloper;
}

const stellarTypeConfig: Record<string, { color: string; label: string; icon: string }> = {
    blue_giant: { color: "var(--blue-giant)", label: "Blue Giant", icon: "🔵" },
    yellow_sun: { color: "var(--star-core)", label: "Yellow Sun", icon: "🌟" },
    orange_dwarf: { color: "var(--solar-warm)", label: "Orange Dwarf", icon: "🟠" },
    red_giant: { color: "var(--red-giant)", label: "Red Giant", icon: "🔴" },
    white_dwarf: { color: "var(--white-dwarf)", label: "White Dwarf", icon: "⚪" },
};

function formatNumber(num: number) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
}

export default function DeveloperPanel({ developer }: DeveloperPanelProps) {
    const { selectDeveloper, spatialData } = useUniverseStore();
    const config = stellarTypeConfig[developer.stellarType] || stellarTypeConfig.yellow_sun;

    // Find collaboration partners
    const partners = spatialData?.edges
        .filter(
            (e) => e.sourceId === developer.id || e.targetId === developer.id
        )
        .map((e) => {
            const partnerId =
                e.sourceId === developer.id ? e.targetId : e.sourceId;
            const partner = spatialData.developers.find(
                (d) => d.id === partnerId
            );
            return { ...e, partner };
        })
        .filter((e) => e.partner)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 8) || [];

    // Find owned planets
    const ownedPlanets = spatialData?.planets
        .filter((p) => p.ownerId === developer.id)
        .sort((a, b) => b.totalModifications - a.totalModifications)
        .slice(0, 10) || [];

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
                onClick={() => selectDeveloper(null)}
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

            {/* Star header */}
            <div style={{ marginBottom: "20px", textAlign: "center" }}>
                {/* Star glow */}
                <div
                    style={{
                        width: "64px",
                        height: "64px",
                        borderRadius: "50%",
                        margin: "0 auto 12px",
                        background: `radial-gradient(circle, ${config.color}, transparent)`,
                        boxShadow: `0 0 30px ${config.color}, 0 0 60px ${config.color}40`,
                        opacity: developer.isActive ? 1 : 0.4,
                    }}
                />

                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#fff", marginBottom: "4px" }}>
                    {developer.name}
                </h2>
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-mono)", marginBottom: "8px" }}>
                    {developer.primaryEmail}
                </p>

                <span
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "11px",
                        padding: "3px 10px",
                        borderRadius: "var(--radius-full)",
                        background: `${config.color}15`,
                        border: `1px solid ${config.color}30`,
                        color: config.color,
                        fontWeight: 600,
                    }}
                >
                    {config.icon} {config.label}
                    {!developer.isActive && " · Inactive"}
                </span>
            </div>

            {/* Mass display */}
            <div
                style={{
                    textAlign: "center",
                    marginBottom: "20px",
                    padding: "16px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid rgba(255,255,255,0.06)",
                }}
            >
                <p style={{ fontSize: "36px", fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                    {developer.normalizedMass.toFixed(1)}
                </p>
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "4px", textTransform: "uppercase", letterSpacing: "1px" }}>
                    Stellar Mass
                </p>
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
                    { icon: GitBranch, value: developer.totalCommits, label: "Commits", color: "var(--blue-giant)" },
                    { icon: FileText, value: formatNumber(developer.totalLinesAuthored), label: "Lines", color: "var(--star-core)" },
                    { icon: Sun, value: developer.totalFilesOwned, label: "Files Owned", color: "var(--solar-warm)" },
                    { icon: Calendar, value: `${developer.longevityDays}d`, label: "Longevity", color: "var(--galaxy-teal)" },
                    { icon: Users, value: developer.collaborationEdgeCount, label: "Collab Edges", color: "var(--binary-pulse)" },
                    { icon: Activity, value: developer.isActive ? "Active" : "Inactive", label: "Status", color: developer.isActive ? "var(--success-green)" : "var(--white-dwarf)" },
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

            {/* Collaboration Partners */}
            {partners.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                    <h3 style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.5)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        marginBottom: "8px",
                    }}>
                        Collaboration Partners
                    </h3>
                    {partners.map((p, i) => {
                        const partnerConfig = stellarTypeConfig[p.partner!.stellarType] || stellarTypeConfig.yellow_sun;
                        return (
                            <button
                                key={i}
                                onClick={() => selectDeveloper(p.partner!.id)}
                                style={{
                                    width: "100%",
                                    padding: "6px 8px",
                                    marginBottom: "2px",
                                    borderRadius: "var(--radius-sm)",
                                    background: "transparent",
                                    border: "1px solid transparent",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    cursor: "pointer",
                                    color: "#fff",
                                    textAlign: "left",
                                }}
                            >
                                <div
                                    style={{
                                        width: "8px",
                                        height: "8px",
                                        borderRadius: "50%",
                                        background: partnerConfig.color,
                                        boxShadow: `0 0 4px ${partnerConfig.color}`,
                                        flexShrink: 0,
                                    }}
                                />
                                <span style={{ flex: 1, fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {p.partner!.name}
                                </span>
                                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>
                                    {p.weight.toFixed(1)}
                                </span>
                                {p.isBinaryStar && (
                                    <span style={{ fontSize: "10px", color: "var(--binary-pulse)" }}>💫</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Owned Planets (Files) */}
            {ownedPlanets.length > 0 && (
                <div>
                    <h3 style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.5)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        marginBottom: "8px",
                    }}>
                        Orbiting Planets ({developer.totalFilesOwned} total)
                    </h3>
                    {ownedPlanets.map((planet, i) => (
                        <div
                            key={i}
                            style={{
                                padding: "4px 8px",
                                fontSize: "11px",
                                fontFamily: "var(--font-mono)",
                                color: "rgba(255,255,255,0.5)",
                                borderBottom: "1px solid rgba(255,255,255,0.03)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                                {planet.path}
                            </span>
                            <span style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0, marginLeft: "8px" }}>
                                {planet.totalModifications}×
                                {planet.hasRings && " 💍"}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    );
}
