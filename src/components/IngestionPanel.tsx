"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    GitBranch,
    FolderGit2,
    Loader2,
    CheckCircle2,
    XCircle,
    Sparkles,
    AlertTriangle,
} from "lucide-react";

interface ProgressEvent {
    phase: string;
    progress: number;
    detail?: string;
    timestamp: number;
}

interface IngestionPanelProps {
    onComplete?: (repositoryId: string) => void;
}

export default function IngestionPanel({ onComplete }: IngestionPanelProps) {
    const [repoPath, setRepoPath] = useState("");
    const [isIngesting, setIsIngesting] = useState(false);
    const [progress, setProgress] = useState<ProgressEvent | null>(null);
    const [events, setEvents] = useState<ProgressEvent[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isComplete, setIsComplete] = useState(false);
    const [repositoryId, setRepositoryId] = useState<string | null>(null);
    const eventLogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (eventLogRef.current) {
            eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
        }
    }, [events]);

    const startIngestion = async () => {
        if (!repoPath.trim() || isIngesting) return;

        setIsIngesting(true);
        setError(null);
        setIsComplete(false);
        setEvents([]);
        setProgress(null);

        try {
            const response = await fetch("/api/ingest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ repoPath: repoPath.trim() }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Ingestion failed");
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error("No response stream");

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                const lines = text.split("\n");

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const event: ProgressEvent = JSON.parse(line.slice(6));

                            setProgress(event);
                            setEvents((prev) => [...prev.slice(-50), event]);

                            if (event.phase === "complete" && event.detail) {
                                setIsComplete(true);
                                setRepositoryId(event.detail);
                                onComplete?.(event.detail);
                            } else if (event.phase === "error") {
                                setError(event.detail || "Unknown error");
                            }
                        } catch {
                            // Ignore parse errors
                        }
                    }
                }
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsIngesting(false);
        }
    };

    const getPhaseIcon = (phase: string) => {
        switch (phase) {
            case "complete":
                return <CheckCircle2 size={14} />;
            case "error":
                return <XCircle size={14} />;
            case "events":
                return <Sparkles size={14} />;
            default:
                return <Loader2 size={14} className="animate-spin" />;
        }
    };

    const getPhaseColor = (phase: string) => {
        switch (phase) {
            case "complete":
                return "var(--success-green)";
            case "error":
                return "var(--alert-red)";
            case "events":
                return "var(--supernova-gold)";
            case "collaboration":
                return "var(--binary-pulse)";
            case "mass":
                return "var(--star-core)";
            case "galaxies":
                return "var(--galaxy-teal)";
            default:
                return "var(--blue-giant)";
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            style={{
                width: "100%",
                maxWidth: "640px",
                margin: "0 auto",
            }}
        >
            {/* Input Section */}
            <div
                className="glass"
                style={{
                    borderRadius: "var(--radius-lg)",
                    padding: "24px",
                    marginBottom: "16px",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                    <FolderGit2 size={20} style={{ color: "var(--blue-giant)" }} />
                    <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#fff" }}>
                        Repository Path
                    </h3>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                    <div style={{ flex: 1, position: "relative" }}>
                        <GitBranch
                            size={16}
                            style={{
                                position: "absolute",
                                left: "14px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                color: "rgba(255,255,255,0.3)",
                            }}
                        />
                        <input
                            id="repo-path-input"
                            type="text"
                            value={repoPath}
                            onChange={(e) => setRepoPath(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && startIngestion()}
                            placeholder="C:\path\to\your\repo or /home/user/repo"
                            disabled={isIngesting}
                            style={{
                                width: "100%",
                                padding: "12px 14px 12px 40px",
                                background: "rgba(3, 0, 20, 0.6)",
                                border: "1px solid rgba(79, 195, 247, 0.2)",
                                borderRadius: "var(--radius-md)",
                                color: "#fff",
                                fontSize: "14px",
                                fontFamily: "var(--font-mono)",
                                outline: "none",
                                transition: "border-color 0.3s, box-shadow 0.3s",
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = "rgba(79, 195, 247, 0.5)";
                                e.target.style.boxShadow = "0 0 20px rgba(79, 195, 247, 0.1)";
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = "rgba(79, 195, 247, 0.2)";
                                e.target.style.boxShadow = "none";
                            }}
                        />
                    </div>

                    <button
                        id="ingest-button"
                        onClick={startIngestion}
                        disabled={!repoPath.trim() || isIngesting}
                        style={{
                            padding: "12px 24px",
                            background: isIngesting
                                ? "rgba(79, 195, 247, 0.2)"
                                : "linear-gradient(135deg, rgba(79, 195, 247, 0.3), rgba(108, 52, 131, 0.3))",
                            border: "1px solid rgba(79, 195, 247, 0.3)",
                            borderRadius: "var(--radius-md)",
                            color: "#fff",
                            fontSize: "14px",
                            fontWeight: 600,
                            cursor: isIngesting ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            transition: "all 0.3s",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {isIngesting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Mapping...
                            </>
                        ) : (
                            <>
                                <Sparkles size={16} />
                                Map Universe
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Progress Section */}
            <AnimatePresence>
                {(isIngesting || isComplete || error) && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <div
                            className="glass"
                            style={{
                                borderRadius: "var(--radius-lg)",
                                padding: "24px",
                                overflow: "hidden",
                            }}
                        >
                            {/* Progress Bar */}
                            {progress && (
                                <div style={{ marginBottom: "16px" }}>
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            marginBottom: "8px",
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: "13px",
                                                fontWeight: 500,
                                                color: getPhaseColor(progress.phase),
                                                textTransform: "uppercase",
                                                letterSpacing: "0.5px",
                                            }}
                                        >
                                            {progress.phase}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: "13px",
                                                fontFamily: "var(--font-mono)",
                                                color: "rgba(255,255,255,0.6)",
                                            }}
                                        >
                                            {Math.round(Math.max(0, progress.progress))}%
                                        </span>
                                    </div>

                                    {/* Progress track */}
                                    <div
                                        style={{
                                            width: "100%",
                                            height: "4px",
                                            background: "rgba(255,255,255,0.05)",
                                            borderRadius: "2px",
                                            overflow: "hidden",
                                        }}
                                    >
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.max(0, progress.progress)}%` }}
                                            transition={{ duration: 0.5, ease: "easeOut" }}
                                            style={{
                                                height: "100%",
                                                borderRadius: "2px",
                                                background: `linear-gradient(90deg, ${getPhaseColor(progress.phase)}, var(--binary-pulse))`,
                                                boxShadow: `0 0 10px ${getPhaseColor(progress.phase)}`,
                                            }}
                                        />
                                    </div>

                                    {progress.detail && (
                                        <p
                                            style={{
                                                marginTop: "8px",
                                                fontSize: "12px",
                                                color: "rgba(255,255,255,0.5)",
                                                fontFamily: "var(--font-mono)",
                                            }}
                                        >
                                            {progress.detail}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Event Log */}
                            <div
                                ref={eventLogRef}
                                style={{
                                    maxHeight: "200px",
                                    overflowY: "auto",
                                    background: "rgba(3, 0, 20, 0.5)",
                                    borderRadius: "var(--radius-sm)",
                                    padding: "12px",
                                }}
                            >
                                {events.map((event, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            padding: "4px 0",
                                            fontSize: "11px",
                                            fontFamily: "var(--font-mono)",
                                            color: "rgba(255,255,255,0.6)",
                                            borderBottom: "1px solid rgba(255,255,255,0.03)",
                                        }}
                                    >
                                        <span style={{ color: getPhaseColor(event.phase), flexShrink: 0 }}>
                                            {getPhaseIcon(event.phase)}
                                        </span>
                                        <span style={{ color: getPhaseColor(event.phase), flexShrink: 0, width: "60px" }}>
                                            {Math.round(Math.max(0, event.progress))}%
                                        </span>
                                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {event.detail}
                                        </span>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Error */}
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    style={{
                                        marginTop: "12px",
                                        padding: "12px",
                                        background: "rgba(239, 83, 80, 0.1)",
                                        border: "1px solid rgba(239, 83, 80, 0.3)",
                                        borderRadius: "var(--radius-sm)",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                    }}
                                >
                                    <AlertTriangle size={16} style={{ color: "var(--alert-red)", flexShrink: 0 }} />
                                    <span style={{ fontSize: "13px", color: "var(--alert-red)" }}>{error}</span>
                                </motion.div>
                            )}

                            {/* Complete */}
                            {isComplete && repositoryId && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    style={{
                                        marginTop: "12px",
                                        padding: "16px",
                                        background: "rgba(102, 187, 106, 0.1)",
                                        border: "1px solid rgba(102, 187, 106, 0.3)",
                                        borderRadius: "var(--radius-sm)",
                                        textAlign: "center",
                                    }}
                                >
                                    <CheckCircle2 size={24} style={{ color: "var(--success-green)", marginBottom: "8px" }} />
                                    <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--success-green)" }}>
                                        Universe Mapped Successfully! ✨
                                    </p>
                                    <a
                                        href={`/universe/${repositoryId}`}
                                        style={{
                                            display: "inline-block",
                                            marginTop: "12px",
                                            padding: "10px 24px",
                                            background: "linear-gradient(135deg, rgba(79, 195, 247, 0.3), rgba(108, 52, 131, 0.3))",
                                            border: "1px solid rgba(79, 195, 247, 0.3)",
                                            borderRadius: "var(--radius-md)",
                                            color: "#fff",
                                            fontSize: "14px",
                                            fontWeight: 600,
                                            textDecoration: "none",
                                            transition: "all 0.3s",
                                        }}
                                    >
                                        Explore Universe →
                                    </a>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
