/**
 * Universe HUD (Heads-Up Display)
 *
 * Transparent overlay on top of the 3D canvas providing:
 * - Repository name and stats bar (top)
 * - View controls and toggle panel (top-right)
 * - Developer list sidebar (left, collapsible)
 * - Event timeline mini (bottom)
 * - Back / reset buttons
 */

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sun,
    Orbit,
    Telescope,
    ArrowLeft,
    Eye,
    EyeOff,
    GitBranch,
    Users,
    Layers,
    Activity,
    Star,
    RotateCcw,
    ChevronRight,
    ChevronLeft,
    Network,
} from "lucide-react";
import { useUniverseStore } from "@/stores/universe-store";
import DeveloperPanel from "@/components/ui/DeveloperPanel";

// ─── Stellar type display configs ────────────────────────────────────────────

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

// ─── Main HUD Component ─────────────────────────────────────────────────────

export default function UniverseHUD() {
    const {
        repository,
        stats,
        spatialData,
        viewLevel,
        selectedDeveloperId,
        showEdges,
        showPlanets,
        showNebulae,
        showLabels,
        toggleEdges,
        togglePlanets,
        toggleNebulae,
        toggleLabels,
        selectDeveloper,
        resetView,
    } = useUniverseStore();

    const [sidebarOpen, setSidebarOpen] = useState(true);

    if (!repository || !stats) return null;

    const selectedDev = spatialData?.developers.find(
        (d) => d.id === selectedDeveloperId
    );

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 10,
                fontFamily: "var(--font-sans)",
            }}
        >
            {/* ── Top Bar ───────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "linear-gradient(180deg, rgba(3,0,20,0.85) 0%, transparent 100%)",
                    pointerEvents: "auto",
                }}
            >
                {/* Left: Back + Repo name */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <Link
                        href="/"
                        style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "var(--radius-sm)",
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "rgba(255,255,255,0.5)",
                            textDecoration: "none",
                            cursor: "pointer",
                        }}
                    >
                        <ArrowLeft size={16} />
                    </Link>
                    <div>
                        <h1 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
                            {repository.name}
                        </h1>
                        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-mono)" }}>
                            {repository.fullName}
                        </p>
                    </div>

                    {/* View level badge */}
                    <span
                        style={{
                            fontSize: "10px",
                            padding: "3px 8px",
                            borderRadius: "var(--radius-full)",
                            background: "rgba(79,195,247,0.15)",
                            border: "1px solid rgba(79,195,247,0.3)",
                            color: "var(--blue-giant)",
                            textTransform: "uppercase",
                            letterSpacing: "1px",
                            fontWeight: 600,
                        }}
                    >
                        {viewLevel.replace("-", " ")}
                    </span>
                </div>

                {/* Center: Stats */}
                <div style={{ display: "flex", gap: "16px", fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
                    {[
                        { icon: Sun, value: stats.totalDevelopers, label: "Stars", color: "var(--star-core)" },
                        { icon: Activity, value: stats.activeDevelopers, label: "Active", color: "var(--success-green)" },
                        { icon: GitBranch, value: repository.totalCommits, label: "Commits", color: "var(--blue-giant)" },
                        { icon: Layers, value: stats.totalGalaxies, label: "Galaxies", color: "var(--galaxy-teal)" },
                        { icon: Orbit, value: stats.binaryStars, label: "Binary", color: "var(--binary-pulse)" },
                    ].map((stat, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <stat.icon size={12} style={{ color: stat.color }} />
                            <span style={{ fontWeight: 700, color: "#fff" }}>{formatNumber(stat.value)}</span>
                            <span>{stat.label}</span>
                        </div>
                    ))}
                </div>

                {/* Right: View Controls */}
                <div style={{ display: "flex", gap: "4px" }}>
                    {[
                        { key: "edges", icon: Network, active: showEdges, toggle: toggleEdges, label: "Edges" },
                        { key: "planets", icon: Telescope, active: showPlanets, toggle: togglePlanets, label: "Planets" },
                        { key: "nebulae", icon: Layers, active: showNebulae, toggle: toggleNebulae, label: "Nebulae" },
                        { key: "labels", icon: showLabels ? Eye : EyeOff, active: showLabels, toggle: toggleLabels, label: "Labels" },
                    ].map((ctrl) => (
                        <button
                            key={ctrl.key}
                            onClick={ctrl.toggle}
                            title={ctrl.label}
                            style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "var(--radius-sm)",
                                background: ctrl.active ? "rgba(79,195,247,0.15)" : "rgba(255,255,255,0.05)",
                                border: `1px solid ${ctrl.active ? "rgba(79,195,247,0.3)" : "rgba(255,255,255,0.08)"}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: ctrl.active ? "var(--blue-giant)" : "rgba(255,255,255,0.3)",
                                cursor: "pointer",
                            }}
                        >
                            <ctrl.icon size={14} />
                        </button>
                    ))}
                    <button
                        onClick={resetView}
                        title="Reset View"
                        style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "var(--radius-sm)",
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "rgba(255,255,255,0.3)",
                            cursor: "pointer",
                        }}
                    >
                        <RotateCcw size={14} />
                    </button>
                </div>
            </motion.div>

            {/* ── Developer Sidebar (Left) ──────────────────────── */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                    position: "absolute",
                    top: "72px",
                    left: 0,
                    bottom: "60px",
                    width: sidebarOpen ? "260px" : "40px",
                    transition: "width 0.3s ease",
                    pointerEvents: "auto",
                }}
            >
                {/* Toggle button */}
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    style={{
                        position: "absolute",
                        right: "-16px",
                        top: "12px",
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "rgba(10,10,26,0.9)",
                        border: "1px solid rgba(79,195,247,0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--blue-giant)",
                        cursor: "pointer",
                        zIndex: 2,
                    }}
                >
                    {sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
                </button>

                <AnimatePresence>
                    {sidebarOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                height: "100%",
                                background: "rgba(3,0,20,0.85)",
                                backdropFilter: "blur(12px)",
                                borderRight: "1px solid rgba(108,52,131,0.2)",
                                padding: "12px",
                                overflowY: "auto",
                            }}
                        >
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                marginBottom: "12px",
                                padding: "0 4px",
                            }}>
                                <Users size={14} style={{ color: "var(--blue-giant)" }} />
                                <span style={{ fontSize: "12px", fontWeight: 600, color: "#fff", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    Developer Stars
                                </span>
                            </div>

                            {spatialData?.developers
                                .sort((a, b) => b.normalizedMass - a.normalizedMass)
                                .map((dev) => {
                                    const config = stellarTypeConfig[dev.stellarType] || stellarTypeConfig.yellow_sun;
                                    const isActive = selectedDeveloperId === dev.id;
                                    return (
                                        <motion.button
                                            key={dev.id}
                                            onClick={() => selectDeveloper(isActive ? null : dev.id)}
                                            whileHover={{ x: 2 }}
                                            style={{
                                                width: "100%",
                                                padding: "8px",
                                                marginBottom: "2px",
                                                borderRadius: "var(--radius-sm)",
                                                background: isActive
                                                    ? "rgba(79,195,247,0.12)"
                                                    : "transparent",
                                                border: isActive
                                                    ? "1px solid rgba(79,195,247,0.25)"
                                                    : "1px solid transparent",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                                cursor: "pointer",
                                                textAlign: "left",
                                                color: "#fff",
                                            }}
                                        >
                                            {/* Mini star indicator */}
                                            <div
                                                style={{
                                                    width: `${Math.max(10, dev.normalizedMass * 0.18 + 8)}px`,
                                                    height: `${Math.max(10, dev.normalizedMass * 0.18 + 8)}px`,
                                                    borderRadius: "50%",
                                                    background: `radial-gradient(circle, ${config.color}, transparent)`,
                                                    boxShadow: `0 0 ${dev.normalizedMass * 0.1 + 2}px ${config.color}`,
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
                                                <Star size={10} style={{ color: "var(--white-dwarf)", flexShrink: 0 }} />
                                            )}
                                        </motion.button>
                                    );
                                })}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* ── Developer Detail Panel (Right) ────────────────── */}
            <AnimatePresence>
                {selectedDev && (
                    <DeveloperPanel developer={selectedDev} />
                )}
            </AnimatePresence>

            {/* ── Bottom Status Bar ─────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: "12px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "24px",
                    background: "linear-gradient(0deg, rgba(3,0,20,0.85) 0%, transparent 100%)",
                    pointerEvents: "auto",
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.35)",
                }}
            >
                <span>🖱️ Click star to focus · Scroll to zoom · Drag to rotate</span>
                <span>·</span>
                <span>
                    {stats.totalFiles} planets · {stats.totalEdges} orbital intersections · {stats.totalEvents} temporal events
                </span>
            </motion.div>
        </div>
    );
}
