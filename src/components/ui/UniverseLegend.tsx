/**
 * Universe Legend Panel
 *
 * A collapsible help panel at bottom-left that explains
 * the visual language of the universe. Helps users understand
 * what they're looking at without confusion.
 *
 * - Stellar type color key
 * - Planet file type key
 * - Edge meaning
 * - Event icons
 * - Controls summary
 */

"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, X } from "lucide-react";

const stellarTypes = [
    { color: "#ffb300", label: "Blue Giant", desc: "New dev (<6 months)" },
    { color: "#ffd700", label: "Yellow Sun", desc: "Mid-career developer" },
    { color: "#ffb74d", label: "Orange Dwarf", desc: "Veteran contributor" },
    { color: "#ef5350", label: "Red Giant", desc: "Bus factor risk (>60% ownership)" },
    { color: "#b0bec5", label: "White Dwarf", desc: "Inactive (no commits 180+ days)" },
];

const planetTypes = [
    { color: "#ff5500", label: "JavaScript", desc: "Lava world (hot, active)" },
    { color: "#3178c6", label: "TypeScript", desc: "Ocean world (blue)" },
    { color: "#78909c", label: "Config", desc: "Rocky (barren)" },
    { color: "#66bb6a", label: "Test", desc: "Verdant (green)" },
    { color: "#8ecae6", label: "Docs", desc: "Ice world (pale)" },
    { color: "#ce93d8", label: "Style/CSS", desc: "Gas giant (banded)" },
    { color: "#ffd54f", label: "Data", desc: "Crystal (golden veins)" },
    { color: "#9e9e9e", label: "Other", desc: "Dead moon (grey)" },
];

const edgeTypes = [
    { color: "#e040fb", label: "Binary Star", desc: "Deep collaboration pair" },
    { color: "#aaaaaa", label: "Collaboration", desc: "Shared file work" },
];

const eventTypes = [
    { symbol: "☀", color: "#ffd700", label: "Star Birth", desc: "Developer's first commit" },
    { symbol: "⚫", color: "#b0bec5", label: "White Dwarf", desc: "Developer went inactive" },
    { symbol: "💥", color: "#ff1744", label: "Supernova", desc: "Massive refactor / deletion" },
    { symbol: "💫", color: "#e040fb", label: "Binary Formation", desc: "Two devs form a pair" },
];

export default function UniverseLegend() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            {/* Toggle button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: "fixed",
                    bottom: "48px",
                    left: "16px",
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: isOpen ? "rgba(79,195,247,0.2)" : "rgba(10,10,26,0.8)",
                    border: `1px solid ${isOpen ? "rgba(79,195,247,0.4)" : "rgba(255,255,255,0.1)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isOpen ? "var(--blue-giant)" : "rgba(255,255,255,0.5)",
                    cursor: "pointer",
                    zIndex: 20,
                    backdropFilter: "blur(8px)",
                    pointerEvents: "auto",
                }}
                title="Universe Legend"
            >
                {isOpen ? <X size={16} /> : <HelpCircle size={16} />}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        style={{
                            position: "fixed",
                            bottom: "90px",
                            left: "16px",
                            width: "280px",
                            maxHeight: "calc(100vh - 180px)",
                            background: "rgba(3,0,20,0.92)",
                            backdropFilter: "blur(20px)",
                            border: "1px solid rgba(108,52,131,0.25)",
                            borderRadius: "var(--radius-lg)",
                            padding: "16px",
                            overflowY: "auto",
                            pointerEvents: "auto",
                            zIndex: 20,
                            fontFamily: "var(--font-sans)",
                        }}
                    >
                        <h3 style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "#fff",
                            marginBottom: "14px",
                            letterSpacing: "0.5px",
                        }}>
                            Universe Guide
                        </h3>

                        {/* Stellar Types */}
                        <Section title="Developer Stars">
                            {stellarTypes.map((s, i) => (
                                <LegendItem key={i} color={s.color} label={s.label} desc={s.desc} />
                            ))}
                        </Section>

                        {/* Planet Types */}
                        <Section title="File Planets">
                            {planetTypes.map((p, i) => (
                                <LegendItem key={i} color={p.color} label={p.label} desc={p.desc} />
                            ))}
                        </Section>

                        {/* Edge Types */}
                        <Section title="Collaboration Edges">
                            {edgeTypes.map((e, i) => (
                                <LegendItem key={i} color={e.color} label={e.label} desc={e.desc} isLine />
                            ))}
                        </Section>

                        {/* Event Types */}
                        <Section title="Temporal Events">
                            {eventTypes.map((e, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        padding: "3px 0",
                                    }}
                                >
                                    <span style={{ fontSize: "12px", width: "16px", textAlign: "center" }}>{e.symbol}</span>
                                    <span style={{ fontSize: "11px", color: e.color, fontWeight: 600, minWidth: "80px" }}>
                                        {e.label}
                                    </span>
                                    <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>
                                        {e.desc}
                                    </span>
                                </div>
                            ))}
                        </Section>

                        {/* Controls */}
                        <Section title="Controls">
                            <ControlItem keys="Click star" desc="Focus on developer" />
                            <ControlItem keys="Click nebula" desc="Focus on galaxy" />
                            <ControlItem keys="Scroll" desc="Zoom in/out" />
                            <ControlItem keys="Drag" desc="Rotate view" />
                            <ControlItem keys="Right drag" desc="Pan view" />
                        </Section>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: "14px" }}>
            <h4 style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "6px",
                paddingBottom: "4px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
                {title}
            </h4>
            {children}
        </div>
    );
}

function LegendItem({ color, label, desc, isLine }: { color: string; label: string; desc: string; isLine?: boolean }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "2px 0" }}>
            {isLine ? (
                <div style={{
                    width: "14px",
                    height: "2px",
                    background: color,
                    borderRadius: "1px",
                    boxShadow: `0 0 4px ${color}`,
                    flexShrink: 0,
                }} />
            ) : (
                <div style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${color}, transparent)`,
                    boxShadow: `0 0 4px ${color}`,
                    flexShrink: 0,
                }} />
            )}
            <span style={{ fontSize: "11px", color: "#fff", fontWeight: 500, minWidth: "70px" }}>
                {label}
            </span>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>
                {desc}
            </span>
        </div>
    );
}

function ControlItem({ keys, desc }: { keys: string; desc: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "2px 0" }}>
            <span style={{
                fontSize: "10px",
                padding: "2px 6px",
                borderRadius: "4px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.6)",
                fontFamily: "var(--font-mono)",
                whiteSpace: "nowrap",
            }}>
                {keys}
            </span>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>
                {desc}
            </span>
        </div>
    );
}
