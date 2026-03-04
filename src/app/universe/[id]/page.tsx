"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sun,
    Orbit,
    Telescope,
    Clock,
    Users,
    GitBranch,
    Zap,
    AlertTriangle,
    Star,
    Activity,
    Network,
    Layers,
    ArrowLeft,
    Loader2,
    XCircle,
} from "lucide-react";
import StarfieldCanvas from "@/components/StarfieldCanvas";

interface UniverseData {
    repository: {
        name: string;
        fullName: string;
        totalCommits: number;
        totalDevelopers: number;
        totalFiles: number;
        firstCommitDate: string;
        lastCommitDate: string;
    };
    developers: Array<{
        _id: string;
        name: string;
        primaryEmail: string;
        stellarMass: number;
        normalizedMass: number;
        stellarType: string;
        totalCommits: number;
        totalLinesAuthored: number;
        totalFilesOwned: number;
        longevityDays: number;
        isActive: boolean;
        collaborationEdgeCount: number;
    }>;
    collaborationEdges: Array<{
        _id: string;
        developerAId: string;
        developerBId: string;
        edgeType: string;
        weight: number;
        isBinaryStar: boolean;
        sharedFiles: string[];
    }>;
    galaxies: Array<{
        _id: string;
        name: string;
        totalFiles: number;
        totalDevelopers: number;
        colorHue: number;
        detectionMethod: string;
    }>;
    temporalEvents: Array<{
        _id: string;
        eventType: string;
        timestamp: string;
        description: string;
        magnitude: number;
    }>;
    stats: {
        totalDevelopers: number;
        activeDevelopers: number;
        whiteDwarfs: number;
        totalEdges: number;
        binaryStars: number;
        totalGalaxies: number;
        totalEvents: number;
        totalFiles: number;
        eventBreakdown: Record<string, number>;
    };
}

const stellarTypeConfig: Record<string, { color: string; label: string; icon: string }> = {
    blue_giant: { color: "var(--blue-giant)", label: "Blue Giant", icon: "🔵" },
    yellow_sun: { color: "var(--star-core)", label: "Yellow Sun", icon: "🌟" },
    orange_dwarf: { color: "var(--solar-warm)", label: "Orange Dwarf", icon: "🟠" },
    red_giant: { color: "var(--red-giant)", label: "Red Giant", icon: "🔴" },
    white_dwarf: { color: "var(--white-dwarf)", label: "White Dwarf", icon: "⚪" },
};

const eventTypeConfig: Record<string, { color: string; icon: string; label: string }> = {
    STAR_BIRTH: { color: "var(--blue-giant)", icon: "☀️", label: "Star Birth" },
    WHITE_DWARF: { color: "var(--white-dwarf)", icon: "⚫", label: "White Dwarf" },
    SUPERNOVA: { color: "var(--supernova-gold)", icon: "💥", label: "Supernova" },
    BINARY_FORMATION: { color: "var(--binary-pulse)", icon: "💫", label: "Binary Formation" },
    DEBT_CLEARANCE: { color: "var(--success-green)", icon: "✨", label: "Debt Clearance" },
    BUS_FACTOR_ALERT: { color: "var(--alert-red)", icon: "🚨", label: "Bus Factor Alert" },
    GALAXY_SPLIT: { color: "var(--galaxy-teal)", icon: "🌌", label: "Galaxy Split" },
    GALAXY_MERGE: { color: "var(--nebula-pink)", icon: "🌀", label: "Galaxy Merge" },
};

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function formatNumber(num: number) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
}

const stagger = {
    container: {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
    },
    item: {
        hidden: { opacity: 0, y: 15 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
    },
};

export default function UniversePage() {
    const params = useParams();
    const [data, setData] = useState<UniverseData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"stars" | "edges" | "galaxies" | "events">("stars");

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch(`/api/universe/${params.id}`);
                if (!res.ok) throw new Error("Failed to load universe data");
                const json = await res.json();
                setData(json);
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setLoading(false);
            }
        }
        if (params.id) fetchData();
    }, [params.id]);

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <StarfieldCanvas />
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ position: "relative", zIndex: 2, textAlign: "center" }}
                >
                    <Loader2 size={40} style={{ color: "var(--blue-giant)", animation: "spin-slow 2s linear infinite" }} />
                    <p style={{ marginTop: "16px", color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>
                        Loading universe...
                    </p>
                </motion.div>
            </main>
        );
    }

    if (error || !data) {
        return (
            <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <StarfieldCanvas />
                <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
                    <XCircle size={40} style={{ color: "var(--alert-red)" }} />
                    <p style={{ marginTop: "16px", color: "var(--alert-red)" }}>{error || "Universe not found"}</p>
                    <a href="/" style={{ color: "var(--blue-giant)", marginTop: "12px", display: "inline-block" }}>
                        ← Back to Home
                    </a>
                </div>
            </main>
        );
    }

    const tabs = [
        { key: "stars", label: "Stars", icon: Sun, count: data.stats.totalDevelopers },
        { key: "edges", label: "Orbits", icon: Orbit, count: data.stats.totalEdges },
        { key: "galaxies", label: "Galaxies", icon: Telescope, count: data.stats.totalGalaxies },
        { key: "events", label: "Events", icon: Clock, count: data.stats.totalEvents },
    ] as const;

    return (
        <main style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
            <StarfieldCanvas />
            <div
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    background:
                        "radial-gradient(ellipse at 30% 30%, rgba(108,52,131,0.1) 0%, transparent 60%), " +
                        "radial-gradient(ellipse at 70% 70%, rgba(79,195,247,0.06) 0%, transparent 50%)",
                    pointerEvents: "none",
                    zIndex: 1,
                }}
            />

            <div style={{ position: "relative", zIndex: 2, maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
                {/* Header */}
                <motion.header
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "32px",
                        flexWrap: "wrap",
                        gap: "16px",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <a
                            href="/"
                            style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "var(--radius-sm)",
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "rgba(255,255,255,0.5)",
                                textDecoration: "none",
                                transition: "all 0.3s",
                            }}
                        >
                            <ArrowLeft size={18} />
                        </a>
                        <div>
                            <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#fff" }}>
                                {data.repository.name}
                            </h1>
                            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-mono)" }}>
                                {data.repository.fullName}
                            </p>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
                        {data.repository.firstCommitDate && (
                            <span>{formatDate(data.repository.firstCommitDate)}</span>
                        )}
                        {data.repository.lastCommitDate && (
                            <>
                                <span>→</span>
                                <span>{formatDate(data.repository.lastCommitDate)}</span>
                            </>
                        )}
                    </div>
                </motion.header>

                {/* Stats Cards */}
                <motion.div
                    variants={stagger.container}
                    initial="hidden"
                    animate="visible"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: "12px",
                        marginBottom: "32px",
                    }}
                >
                    {[
                        { label: "Total Stars", value: data.stats.totalDevelopers, icon: Sun, color: "var(--star-core)" },
                        { label: "Active Stars", value: data.stats.activeDevelopers, icon: Activity, color: "var(--success-green)" },
                        { label: "White Dwarfs", value: data.stats.whiteDwarfs, icon: Star, color: "var(--white-dwarf)" },
                        { label: "Commits", value: data.repository.totalCommits, icon: GitBranch, color: "var(--blue-giant)" },
                        { label: "Galaxies", value: data.stats.totalGalaxies, icon: Layers, color: "var(--galaxy-teal)" },
                        { label: "Binary Stars", value: data.stats.binaryStars, icon: Orbit, color: "var(--binary-pulse)" },
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            variants={stagger.item}
                            className="glass"
                            style={{ borderRadius: "var(--radius-md)", padding: "16px" }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                <stat.icon size={14} style={{ color: stat.color }} />
                                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    {stat.label}
                                </span>
                            </div>
                            <p style={{ fontSize: "28px", fontWeight: 800, color: "#fff" }}>
                                {formatNumber(stat.value)}
                            </p>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Tab Navigation */}
                <div
                    style={{
                        display: "flex",
                        gap: "4px",
                        marginBottom: "20px",
                        background: "rgba(10,10,26,0.6)",
                        borderRadius: "var(--radius-md)",
                        padding: "4px",
                        border: "1px solid rgba(255,255,255,0.05)",
                    }}
                >
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            style={{
                                flex: 1,
                                padding: "10px 16px",
                                borderRadius: "var(--radius-sm)",
                                border: "none",
                                background: activeTab === tab.key ? "rgba(79,195,247,0.15)" : "transparent",
                                color: activeTab === tab.key ? "#fff" : "rgba(255,255,255,0.4)",
                                fontSize: "13px",
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "8px",
                                transition: "all 0.3s",
                            }}
                        >
                            <tab.icon size={14} />
                            {tab.label}
                            <span
                                style={{
                                    fontSize: "11px",
                                    padding: "2px 6px",
                                    borderRadius: "var(--radius-full)",
                                    background: activeTab === tab.key ? "rgba(79,195,247,0.2)" : "rgba(255,255,255,0.05)",
                                }}
                            >
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <AnimatePresence mode="wait">
                    {/* ── Stars Tab ──────────────── */}
                    {activeTab === "stars" && (
                        <motion.div
                            key="stars"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div style={{ display: "grid", gap: "8px" }}>
                                {data.developers.map((dev, i) => {
                                    const config = stellarTypeConfig[dev.stellarType] || stellarTypeConfig.yellow_sun;
                                    return (
                                        <motion.div
                                            key={dev._id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.03 }}
                                            className="glass-light"
                                            style={{
                                                borderRadius: "var(--radius-md)",
                                                padding: "16px 20px",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "16px",
                                                borderLeft: `3px solid ${config.color}`,
                                            }}
                                        >
                                            {/* Star indicator */}
                                            <div
                                                style={{
                                                    width: `${Math.max(28, dev.normalizedMass * 0.5 + 16)}px`,
                                                    height: `${Math.max(28, dev.normalizedMass * 0.5 + 16)}px`,
                                                    borderRadius: "50%",
                                                    background: `radial-gradient(circle, ${config.color}, transparent)`,
                                                    boxShadow: `0 0 ${dev.normalizedMass * 0.3 + 5}px ${config.color}`,
                                                    flexShrink: 0,
                                                    animation: dev.isActive ? "pulseGlow 3s infinite" : "none",
                                                    opacity: dev.isActive ? 1 : 0.4,
                                                }}
                                            />

                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                                    <span style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>
                                                        {dev.name}
                                                    </span>
                                                    <span style={{ fontSize: "11px", color: config.color, fontWeight: 500 }}>
                                                        {config.icon} {config.label}
                                                    </span>
                                                    {!dev.isActive && (
                                                        <span
                                                            style={{
                                                                fontSize: "10px",
                                                                padding: "2px 6px",
                                                                background: "rgba(176,190,197,0.15)",
                                                                borderRadius: "var(--radius-full)",
                                                                color: "var(--white-dwarf)",
                                                            }}
                                                        >
                                                            Inactive
                                                        </span>
                                                    )}
                                                </div>
                                                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-mono)" }}>
                                                    {dev.primaryEmail}
                                                </p>
                                            </div>

                                            <div style={{ display: "flex", gap: "20px", flexShrink: 0, fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                                                <div style={{ textAlign: "center" }}>
                                                    <p style={{ fontWeight: 700, fontSize: "16px", color: "#fff" }}>{formatNumber(dev.totalCommits)}</p>
                                                    <p>commits</p>
                                                </div>
                                                <div style={{ textAlign: "center" }}>
                                                    <p style={{ fontWeight: 700, fontSize: "16px", color: "#fff" }}>{formatNumber(dev.totalLinesAuthored)}</p>
                                                    <p>lines</p>
                                                </div>
                                                <div style={{ textAlign: "center" }}>
                                                    <p style={{ fontWeight: 700, fontSize: "16px", color: "#fff" }}>{dev.totalFilesOwned}</p>
                                                    <p>files</p>
                                                </div>
                                                <div style={{ textAlign: "center" }}>
                                                    <p style={{ fontWeight: 700, fontSize: "16px", color: config.color }}>
                                                        {dev.normalizedMass.toFixed(1)}
                                                    </p>
                                                    <p>mass</p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {/* ── Orbits/Edges Tab ──────── */}
                    {activeTab === "edges" && (
                        <motion.div
                            key="edges"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div style={{ display: "grid", gap: "8px" }}>
                                {data.collaborationEdges.slice(0, 50).map((edge, i) => {
                                    const devA = data.developers.find((d) => d._id === edge.developerAId);
                                    const devB = data.developers.find((d) => d._id === edge.developerBId);
                                    return (
                                        <motion.div
                                            key={edge._id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.03 }}
                                            className="glass-light"
                                            style={{
                                                borderRadius: "var(--radius-md)",
                                                padding: "14px 20px",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "12px",
                                                borderLeft: edge.isBinaryStar
                                                    ? "3px solid var(--binary-pulse)"
                                                    : "3px solid rgba(79,195,247,0.3)",
                                            }}
                                        >
                                            <Network size={16} style={{ color: edge.isBinaryStar ? "var(--binary-pulse)" : "var(--blue-giant)", flexShrink: 0 }} />

                                            <div style={{ flex: 1 }}>
                                                <span style={{ fontSize: "14px", fontWeight: 600, color: "#fff" }}>
                                                    {devA?.name || "Unknown"}
                                                </span>
                                                <span style={{ margin: "0 8px", color: "rgba(255,255,255,0.3)" }}>⟷</span>
                                                <span style={{ fontSize: "14px", fontWeight: 600, color: "#fff" }}>
                                                    {devB?.name || "Unknown"}
                                                </span>
                                                {edge.isBinaryStar && (
                                                    <span
                                                        style={{
                                                            marginLeft: "8px",
                                                            fontSize: "10px",
                                                            padding: "2px 8px",
                                                            background: "rgba(224,64,251,0.15)",
                                                            border: "1px solid rgba(224,64,251,0.3)",
                                                            borderRadius: "var(--radius-full)",
                                                            color: "var(--binary-pulse)",
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        💫 Binary Star
                                                    </span>
                                                )}
                                            </div>

                                            <div style={{ display: "flex", gap: "16px", flexShrink: 0, fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                                                <div style={{ textAlign: "center" }}>
                                                    <p style={{ fontWeight: 700, fontSize: "14px", color: "#fff" }}>{edge.weight.toFixed(1)}</p>
                                                    <p>weight</p>
                                                </div>
                                                <div style={{ textAlign: "center" }}>
                                                    <p style={{ fontWeight: 700, fontSize: "14px", color: "#fff" }}>{edge.sharedFiles.length}</p>
                                                    <p>shared</p>
                                                </div>
                                                <span
                                                    style={{
                                                        fontSize: "10px",
                                                        padding: "4px 8px",
                                                        background: "rgba(255,255,255,0.05)",
                                                        borderRadius: "var(--radius-full)",
                                                        alignSelf: "center",
                                                    }}
                                                >
                                                    {edge.edgeType.replace("_", " ")}
                                                </span>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                                {data.collaborationEdges.length === 0 && (
                                    <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.3)" }}>
                                        No collaboration edges detected yet.
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* ── Galaxies Tab ──────────── */}
                    {activeTab === "galaxies" && (
                        <motion.div
                            key="galaxies"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
                                {data.galaxies.map((galaxy, i) => (
                                    <motion.div
                                        key={galaxy._id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="glass"
                                        style={{
                                            borderRadius: "var(--radius-lg)",
                                            padding: "20px",
                                            borderTop: `3px solid hsl(${galaxy.colorHue}, 60%, 50%)`,
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                                            <div
                                                style={{
                                                    width: "32px",
                                                    height: "32px",
                                                    borderRadius: "50%",
                                                    background: `radial-gradient(circle, hsla(${galaxy.colorHue}, 60%, 50%, 0.5), transparent)`,
                                                    boxShadow: `0 0 15px hsla(${galaxy.colorHue}, 60%, 50%, 0.3)`,
                                                }}
                                            />
                                            <div>
                                                <h4 style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>{galaxy.name}</h4>
                                                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
                                                    {galaxy.detectionMethod}
                                                </p>
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", gap: "16px", fontSize: "12px" }}>
                                            <div>
                                                <p style={{ fontWeight: 700, fontSize: "18px", color: "#fff" }}>{galaxy.totalFiles}</p>
                                                <p style={{ color: "rgba(255,255,255,0.4)" }}>files</p>
                                            </div>
                                            <div>
                                                <p style={{ fontWeight: 700, fontSize: "18px", color: "#fff" }}>{galaxy.totalDevelopers}</p>
                                                <p style={{ color: "rgba(255,255,255,0.4)" }}>developers</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                                {data.galaxies.length === 0 && (
                                    <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.3)", gridColumn: "1 / -1" }}>
                                        No galaxies detected. The project may be too small for structural detection.
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* ── Events Tab ────────────── */}
                    {activeTab === "events" && (
                        <motion.div
                            key="events"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            {/* Event type summary */}
                            <div
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "8px",
                                    marginBottom: "16px",
                                }}
                            >
                                {Object.entries(data.stats.eventBreakdown).map(([type, count]) => {
                                    const snakeType = type
                                        .replace(/([A-Z])/g, "_$1")
                                        .toUpperCase()
                                        .replace(/^_/, "");
                                    const key = snakeType === "STAR_BIRTHS" ? "STAR_BIRTH" :
                                        snakeType === "WHITE_DWARFS" ? "WHITE_DWARF" :
                                            snakeType === "SUPERNOVAS" ? "SUPERNOVA" :
                                                snakeType === "BINARY_FORMATIONS" ? "BINARY_FORMATION" :
                                                    snakeType === "DEBT_CLEARANCES" ? "DEBT_CLEARANCE" :
                                                        snakeType === "BUS_FACTOR_ALERTS" ? "BUS_FACTOR_ALERT" :
                                                            snakeType;
                                    const config = eventTypeConfig[key];
                                    if (!config || count === 0) return null;
                                    return (
                                        <span
                                            key={type}
                                            style={{
                                                fontSize: "12px",
                                                padding: "4px 10px",
                                                background: "rgba(255,255,255,0.05)",
                                                borderRadius: "var(--radius-full)",
                                                color: config.color,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "4px",
                                            }}
                                        >
                                            {config.icon} {config.label}: {count}
                                        </span>
                                    );
                                })}
                            </div>

                            {/* Event timeline */}
                            <div style={{ display: "grid", gap: "6px" }}>
                                {data.temporalEvents.map((event, i) => {
                                    const config = eventTypeConfig[event.eventType] || {
                                        color: "var(--blue-giant)",
                                        icon: "📌",
                                        label: event.eventType,
                                    };
                                    return (
                                        <motion.div
                                            key={event._id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.02 }}
                                            className="glass-light"
                                            style={{
                                                borderRadius: "var(--radius-sm)",
                                                padding: "12px 16px",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "12px",
                                                borderLeft: `3px solid ${config.color}`,
                                            }}
                                        >
                                            <span style={{ fontSize: "18px", flexShrink: 0 }}>{config.icon}</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: "13px", color: "#fff", fontWeight: 500 }}>
                                                    {event.description}
                                                </p>
                                                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>
                                                    {formatDate(event.timestamp)} · Magnitude: {event.magnitude.toFixed(2)}
                                                </p>
                                            </div>
                                            <span
                                                style={{
                                                    fontSize: "10px",
                                                    padding: "3px 8px",
                                                    background: `${config.color}15`,
                                                    border: `1px solid ${config.color}30`,
                                                    borderRadius: "var(--radius-full)",
                                                    color: config.color,
                                                    fontWeight: 600,
                                                    whiteSpace: "nowrap",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {config.label}
                                            </span>
                                        </motion.div>
                                    );
                                })}
                                {data.temporalEvents.length === 0 && (
                                    <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.3)" }}>
                                        No temporal events detected.
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </main>
    );
}
