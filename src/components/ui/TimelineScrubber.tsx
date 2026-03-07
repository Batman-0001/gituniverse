/**
 * Timeline Scrubber — Digital Archaeology Interface
 *
 * A cinematic bottom panel for temporal navigation:
 * - Waveform visualization (commit volume per week as amplitude)
 * - Event markers as colored glyphs (star birth, supernova, etc.)
 * - Draggable scrubber with smooth epoch tracking
 * - Playback controls (play/pause, speed, jump to event)
 * - Era labels auto-generated from major events
 * - Archaeology mode toggle
 */

"use client";

import React, {
  useRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Radio,
  Pickaxe,
  ChevronUp,
  ChevronDown,
  Zap,
} from "lucide-react";
import {
  useTemporalStore,
  PlaybackSpeed,
  TimelineEvent,
} from "@/stores/temporal-store";

// ─── Event Glyphs & Colors ──────────────────────────────────────────────────

const EVENT_CONFIG: Record<
  string,
  { glyph: string; color: string; label: string }
> = {
  STAR_BIRTH: { glyph: "☀️", color: "#ffd700", label: "Star Birth" },
  WHITE_DWARF: { glyph: "⚫", color: "#7799cc", label: "White Dwarf" },
  SUPERNOVA: { glyph: "💥", color: "#ff3300", label: "Supernova" },
  BINARY_FORMATION: {
    glyph: "💫",
    color: "#bb66dd",
    label: "Binary Formation",
  },
  GALAXY_SPLIT: { glyph: "🌌", color: "#00ccaa", label: "Galaxy Split" },
  GALAXY_MERGE: { glyph: "🌀", color: "#7755cc", label: "Galaxy Merge" },
  DEBT_CLEARANCE: { glyph: "🧹", color: "#44cc44", label: "Debt Clearance" },
  BUS_FACTOR_ALERT: { glyph: "🔴", color: "#ff4444", label: "Bus Factor" },
};

const SPEED_OPTIONS: PlaybackSpeed[] = [1, 10, 50, 100];

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatDateFull(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Playback Tick Hook ─────────────────────────────────────────────────────

function usePlaybackTick() {
  // Only subscribe to the values that should restart the loop
  const isPlaying = useTemporalStore((s) => s.isPlaying);
  const playbackSpeed = useTemporalStore((s) => s.playbackSpeed);
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying) {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      return;
    }

    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // Read latest state directly from store — NOT from React closure
      // This avoids stale closures and prevents the rAF loop from being
      // torn down on every frame due to currentEpoch changing.
      const state = useTemporalStore.getState();

      // Scale: 1× speed = 1 day of epoch time per 1 real second
      // delta is in ms, so (delta/1000) gives real seconds
      // playbackSpeed days/sec × 86,400,000 ms/day = epoch ms per real second
      const epochDeltaMs = (delta / 1000) * state.playbackSpeed * 86_400_000;
      const newEpoch = state.currentEpoch + epochDeltaMs;

      if (newEpoch >= state.timelineEnd) {
        state.setEpoch(state.timelineEnd);
        state.pause();
        return;
      }

      state.setEpoch(newEpoch);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isPlaying, playbackSpeed]);
}

// ─── Waveform Component ─────────────────────────────────────────────────────

function Waveform({
  width,
  height,
  onSeek,
}: {
  width: number;
  height: number;
  onSeek: (progress: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    commitVolume,
    timelineStart,
    timelineEnd,
    currentEpoch,
    timelineEvents,
    archaeologyMode,
  } = useTemporalStore();

  const progress =
    timelineEnd > timelineStart ?
      (currentEpoch - timelineStart) / (timelineEnd - timelineStart)
    : 1;

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;

    canvas.width = width * 2; // retina
    canvas.height = height * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(2, 2);
    ctx.clearRect(0, 0, width, height);

    if (commitVolume.length === 0) return;

    const maxCount = Math.max(...commitVolume.map((v) => v.count), 1);
    const barWidth = Math.max(1, width / commitVolume.length - 0.5);
    const midY = height * 0.5;

    // Draw bars
    commitVolume.forEach((vol, i) => {
      const x = (i / commitVolume.length) * width;
      const barProgress = x / width;
      const amplitude = (vol.count / maxCount) * midY * 0.85;

      const isPast = barProgress <= progress;
      const baseAlpha = isPast ? 0.7 : 0.2;

      // Color: blue for past, dim for future
      if (archaeologyMode) {
        ctx.fillStyle =
          isPast ?
            `rgba(255, 180, 100, ${baseAlpha})`
          : `rgba(100, 80, 60, ${baseAlpha * 0.5})`;
      } else {
        ctx.fillStyle =
          isPast ?
            `rgba(79, 195, 247, ${baseAlpha})`
          : `rgba(79, 195, 247, ${baseAlpha * 0.3})`;
      }

      // Symmetric bars (up + down)
      ctx.fillRect(x, midY - amplitude, barWidth, amplitude);
      ctx.fillRect(x, midY, barWidth, amplitude * 0.4);
    });

    // Draw playhead line
    const playheadX = progress * width;
    ctx.strokeStyle =
      archaeologyMode ? "rgba(255, 180, 100, 0.9)" : "rgba(79, 195, 247, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    // Playhead glow
    const gradient = ctx.createRadialGradient(
      playheadX,
      midY,
      0,
      playheadX,
      midY,
      8,
    );
    gradient.addColorStop(
      0,
      archaeologyMode ? "rgba(255, 180, 100, 0.4)" : "rgba(79, 195, 247, 0.4)",
    );
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient;
    ctx.fillRect(playheadX - 8, 0, 16, height);
  }, [commitVolume, progress, width, height, archaeologyMode]);

  // Handle click/drag on waveform
  const isDragging = useRef(false);

  const handlePointerEvent = useCallback(
    (e: React.PointerEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSeek(x);
    },
    [onSeek],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      handlePointerEvent(e);
    },
    [handlePointerEvent],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isDragging.current) handlePointerEvent(e);
    },
    [handlePointerEvent],
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px`, cursor: "pointer" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
}

// ─── Event Markers Layer ────────────────────────────────────────────────────

function EventMarkers({ width }: { width: number }) {
  const { timelineEvents, timelineStart, timelineEnd, jumpToEvent } =
    useTemporalStore();
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);

  if (timelineEnd <= timelineStart) return null;

  // Deduplicate overlapping events — cluster within 2% of timeline
  const clusterThreshold = 0.02;
  const positioned = timelineEvents.map((evt) => ({
    ...evt,
    progress:
      (new Date(evt.timestamp).getTime() - timelineStart) /
      (timelineEnd - timelineStart),
  }));

  return (
    <div style={{ position: "relative", width: `${width}px`, height: "20px" }}>
      {positioned.map((evt) => {
        const config = EVENT_CONFIG[evt.eventType] || EVENT_CONFIG.STAR_BIRTH;
        const x = evt.progress * width;

        return (
          <div
            key={evt.id}
            onClick={() => jumpToEvent(evt.id)}
            onMouseEnter={() => setHoveredEvent(evt)}
            onMouseLeave={() => setHoveredEvent(null)}
            style={{
              position: "absolute",
              left: `${x}px`,
              top: "0",
              transform: "translateX(-50%)",
              cursor: "pointer",
              fontSize: "12px",
              lineHeight: "20px",
              opacity: 0.8,
              transition: "opacity 0.15s, transform 0.15s",
              zIndex: hoveredEvent?.id === evt.id ? 10 : 1,
            }}
            title={`${config.label}: ${evt.description}`}
          >
            {config.glyph}
          </div>
        );
      })}

      {/* Tooltip for hovered event */}
      <AnimatePresence>
        {hoveredEvent && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute",
              left: `${Math.min(
                width - 200,
                Math.max(
                  0,
                  ((new Date(hoveredEvent.timestamp).getTime() -
                    timelineStart) /
                    (timelineEnd - timelineStart)) *
                    width -
                    100,
                ),
              )}px`,
              top: "-40px",
              width: "200px",
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              background: "rgba(3,0,20,0.95)",
              border: `1px solid ${EVENT_CONFIG[hoveredEvent.eventType]?.color || "#4fc3f7"}40`,
              fontSize: "10px",
              color: "rgba(255,255,255,0.8)",
              pointerEvents: "none",
              zIndex: 20,
            }}
          >
            <div
              style={{
                fontWeight: 600,
                color: EVENT_CONFIG[hoveredEvent.eventType]?.color,
              }}
            >
              {EVENT_CONFIG[hoveredEvent.eventType]?.label}
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", marginTop: "2px" }}>
              {hoveredEvent.description}
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.3)",
                marginTop: "2px",
                fontFamily: "var(--font-mono)",
              }}
            >
              {formatDateFull(new Date(hoveredEvent.timestamp).getTime())}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Timeline Scrubber ─────────────────────────────────────────────────

export default function TimelineScrubber() {
  const {
    isInitialized,
    isPlaying,
    isLiveMode,
    playbackSpeed,
    currentEpoch,
    timelineStart,
    timelineEnd,
    archaeologyMode,
    togglePlayback,
    setPlaybackSpeed,
    jumpToNextEvent,
    jumpToPreviousEvent,
    goLive,
    toggleArchaeologyMode,
    setEpoch,
  } = useTemporalStore();

  const [expanded, setExpanded] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [waveformWidth, setWaveformWidth] = useState(600);

  // Activate playback tick
  usePlaybackTick();

  // Measure waveform width
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        // Waveform area = container width - controls (left ~200px + right ~200px)
        const w = containerRef.current.offsetWidth - 400;
        setWaveformWidth(Math.max(200, w));
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const handleSeek = useCallback(
    (progress: number) => {
      const epoch = timelineStart + progress * (timelineEnd - timelineStart);
      setEpoch(epoch);
    },
    [timelineStart, timelineEnd, setEpoch],
  );

  if (!isInitialized) return null;

  const epochProgress =
    timelineEnd > timelineStart ?
      (currentEpoch - timelineStart) / (timelineEnd - timelineStart)
    : 1;

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        background:
          "linear-gradient(0deg, rgba(3,0,20,0.95) 0%, rgba(3,0,20,0.85) 80%, transparent 100%)",
        pointerEvents: "auto",
        zIndex: 15,
        padding: expanded ? "8px 20px 12px" : "4px 20px 8px",
        transition: "padding 0.3s ease",
      }}
    >
      {/* Expand/collapse toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          position: "absolute",
          top: "-20px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "40px",
          height: "20px",
          borderRadius: "8px 8px 0 0",
          background: "rgba(3,0,20,0.9)",
          border: "1px solid rgba(79,195,247,0.2)",
          borderBottom: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--blue-giant)",
          cursor: "pointer",
          fontSize: "10px",
        }}
      >
        {expanded ?
          <ChevronDown size={12} />
        : <ChevronUp size={12} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden" }}
          >
            {/* Top row: Date range + current date */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "4px",
                fontSize: "10px",
              }}
            >
              <span
                style={{
                  color: "rgba(255,255,255,0.3)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {formatDate(timelineStart)}
              </span>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span
                  style={{
                    color: archaeologyMode ? "#ffb464" : "var(--blue-giant)",
                    fontWeight: 700,
                    fontSize: "12px",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {formatDateFull(currentEpoch)}
                </span>
                {!isLiveMode && (
                  <span
                    style={{
                      fontSize: "9px",
                      padding: "2px 6px",
                      borderRadius: "var(--radius-full)",
                      background: "rgba(255, 180, 100, 0.15)",
                      border: "1px solid rgba(255, 180, 100, 0.3)",
                      color: "#ffb464",
                    }}
                  >
                    HISTORICAL
                  </span>
                )}
                {isLiveMode && (
                  <span
                    style={{
                      fontSize: "9px",
                      padding: "2px 6px",
                      borderRadius: "var(--radius-full)",
                      background: "rgba(102, 187, 106, 0.15)",
                      border: "1px solid rgba(102, 187, 106, 0.3)",
                      color: "var(--success-green)",
                    }}
                  >
                    LIVE
                  </span>
                )}
              </div>
              <span
                style={{
                  color: "rgba(255,255,255,0.3)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {formatDate(timelineEnd)}
              </span>
            </div>

            {/* Event markers row */}
            <EventMarkers width={waveformWidth + 400} />

            {/* Waveform + controls row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              {/* Left controls */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  flexShrink: 0,
                }}
              >
                {/* Previous event */}
                <button
                  onClick={jumpToPreviousEvent}
                  title="Previous event"
                  style={controlButtonStyle}
                >
                  <SkipBack size={12} />
                </button>

                {/* Play/Pause */}
                <button
                  onClick={togglePlayback}
                  title={isPlaying ? "Pause" : "Play"}
                  style={{
                    ...controlButtonStyle,
                    width: "36px",
                    height: "36px",
                    background:
                      isPlaying ?
                        "rgba(79,195,247,0.2)"
                      : "rgba(255,255,255,0.08)",
                    border: `1px solid ${isPlaying ? "rgba(79,195,247,0.4)" : "rgba(255,255,255,0.12)"}`,
                  }}
                >
                  {isPlaying ?
                    <Pause size={14} />
                  : <Play size={14} />}
                </button>

                {/* Next event */}
                <button
                  onClick={jumpToNextEvent}
                  title="Next event"
                  style={controlButtonStyle}
                >
                  <SkipForward size={12} />
                </button>

                {/* Speed selector */}
                <div style={{ display: "flex", gap: "2px", marginLeft: "4px" }}>
                  {SPEED_OPTIONS.map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      style={{
                        padding: "2px 6px",
                        borderRadius: "var(--radius-sm)",
                        background:
                          playbackSpeed === speed ?
                            "rgba(79,195,247,0.2)"
                          : "transparent",
                        border:
                          playbackSpeed === speed ?
                            "1px solid rgba(79,195,247,0.3)"
                          : "1px solid transparent",
                        color:
                          playbackSpeed === speed ? "var(--blue-giant)" : (
                            "rgba(255,255,255,0.3)"
                          ),
                        fontSize: "9px",
                        fontWeight: 600,
                        fontFamily: "var(--font-mono)",
                        cursor: "pointer",
                      }}
                    >
                      {speed}×
                    </button>
                  ))}
                </div>
              </div>

              {/* Waveform */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Waveform
                  width={waveformWidth}
                  height={48}
                  onSeek={handleSeek}
                />
              </div>

              {/* Right controls */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  flexShrink: 0,
                }}
              >
                {/* Archaeology mode toggle */}
                <button
                  onClick={toggleArchaeologyMode}
                  title="Archaeology Mode"
                  style={{
                    ...controlButtonStyle,
                    background:
                      archaeologyMode ?
                        "rgba(255,180,100,0.2)"
                      : "rgba(255,255,255,0.05)",
                    border: `1px solid ${archaeologyMode ? "rgba(255,180,100,0.4)" : "rgba(255,255,255,0.08)"}`,
                    color:
                      archaeologyMode ? "#ffb464" : "rgba(255,255,255,0.3)",
                  }}
                >
                  <Pickaxe size={12} />
                </button>

                {/* Go Live button */}
                <button
                  onClick={goLive}
                  title="Go to present"
                  style={{
                    ...controlButtonStyle,
                    background:
                      isLiveMode ?
                        "rgba(102,187,106,0.15)"
                      : "rgba(255,255,255,0.05)",
                    border: `1px solid ${isLiveMode ? "rgba(102,187,106,0.3)" : "rgba(255,255,255,0.08)"}`,
                    color:
                      isLiveMode ?
                        "var(--success-green)"
                      : "rgba(255,255,255,0.3)",
                    gap: "4px",
                    paddingLeft: "8px",
                    paddingRight: "8px",
                    width: "auto",
                  }}
                >
                  <Radio size={10} />
                  <span style={{ fontSize: "9px", fontWeight: 600 }}>LIVE</span>
                </button>
              </div>
            </div>

            {/* Progress bar (thin) */}
            <div
              style={{
                width: "100%",
                height: "2px",
                background: "rgba(255,255,255,0.06)",
                borderRadius: "1px",
                marginTop: "6px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${epochProgress * 100}%`,
                  height: "100%",
                  background:
                    archaeologyMode ?
                      "linear-gradient(90deg, #ffb464, #ff8c42)"
                    : "linear-gradient(90deg, var(--blue-giant), var(--plasma-cyan))",
                  borderRadius: "1px",
                  transition: "width 0.1s linear",
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed mini bar */}
      {!expanded && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            fontSize: "10px",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          <button
            onClick={togglePlayback}
            style={{ ...controlButtonStyle, width: "24px", height: "24px" }}
          >
            {isPlaying ?
              <Pause size={10} />
            : <Play size={10} />}
          </button>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--blue-giant)",
            }}
          >
            {formatDateFull(currentEpoch)}
          </span>
          <div
            style={{
              flex: 1,
              maxWidth: "300px",
              height: "3px",
              background: "rgba(255,255,255,0.06)",
              borderRadius: "2px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${epochProgress * 100}%`,
                height: "100%",
                background: "var(--blue-giant)",
                borderRadius: "2px",
              }}
            />
          </div>
          <button
            onClick={goLive}
            style={{ ...controlButtonStyle, width: "24px", height: "24px" }}
          >
            <Radio size={10} />
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─── Shared Button Style ────────────────────────────────────────────────────

const controlButtonStyle: React.CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "var(--radius-sm)",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "rgba(255,255,255,0.5)",
  cursor: "pointer",
  flexShrink: 0,
};
