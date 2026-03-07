/**
 * Universe Page
 *
 * Full-screen 3D visualization of a repository's sociotechnical universe.
 * Renders:
 * - Three.js canvas with developer suns, commit planets, galaxy nebulae
 * - HUD overlay with stats, controls, developer list
 * - Camera system with zoom levels
 *
 * Data is loaded from /api/universe/[id] and transformed into spatial layout.
 */

"use client";

import React, { useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, XCircle } from "lucide-react";
import dynamic from "next/dynamic";

import { useUniverseStore } from "@/stores/universe-store";
import { useTemporalStore } from "@/stores/temporal-store";
import UniverseHUD from "@/components/ui/UniverseHUD";

// Dynamic import to avoid SSR issues with Three.js
const UniverseScene = dynamic(
  () => import("@/components/universe/UniverseScene"),
  { ssr: false },
);

export default function UniversePage() {
  const params = useParams();
  const { isLoading, error, loadUniverseData, spatialData, repository } =
    useUniverseStore();
  const { initTimeline, isInitialized: temporalInitialized } =
    useTemporalStore();

  useEffect(() => {
    if (params.id) {
      loadUniverseData(params.id as string);
    }
  }, [params.id, loadUniverseData]);

  // Initialize temporal store once universe data is loaded
  useEffect(() => {
    if (!spatialData || !repository || temporalInitialized) return;

    // Fetch temporal data from the same API endpoint
    (async () => {
      try {
        const response = await fetch(`/api/universe/${params.id}`);
        if (!response.ok) return;
        const data = await response.json();

        initTimeline({
          firstCommitDate:
            data.repository.firstCommitDate || new Date().toISOString(),
          lastCommitDate:
            data.repository.lastCommitDate || new Date().toISOString(),
          commitVolume: data.commitVolume || [],
          events: (data.temporalEvents || []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (e: any) => ({
              id: e._id,
              eventType: e.eventType,
              timestamp: e.timestamp,
              description: e.description,
              magnitude: e.magnitude,
              developerId: e.developerId,
              developerBId: e.developerBId,
              galaxyId: e.galaxyId,
            }),
          ),
          massSnapshots: (data.massSnapshots || []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (s: any) => ({
              developerId: s.developerId,
              epoch: s.epoch,
              stellarMass: s.stellarMass,
              normalizedMass: s.normalizedMass,
              commits: s.commits,
              linesAuthored: s.linesAuthored,
            }),
          ),
          developerTimestamps: data.developerTimestamps || [],
          fileTimestamps: data.fileTimestamps || [],
        });
      } catch {
        // Temporal features degrade gracefully if this fails
      }
    })();
  }, [spatialData, repository, params.id, initTimeline, temporalInitialized]);

  // Loading state
  if (isLoading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--void-black)",
        }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ textAlign: "center" }}
        >
          <Loader2
            size={48}
            style={{
              color: "var(--blue-giant)",
              animation: "spin-slow 2s linear infinite",
            }}
          />
          <p
            style={{
              marginTop: "20px",
              color: "rgba(255,255,255,0.5)",
              fontSize: "15px",
            }}
          >
            Assembling the universe...
          </p>
          <p
            style={{
              marginTop: "8px",
              color: "rgba(255,255,255,0.25)",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
            }}
          >
            Computing spatial layout for stars, planets, and galaxies
          </p>
        </motion.div>
      </main>
    );
  }

  // Error state
  if (error || !spatialData) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--void-black)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <XCircle size={48} style={{ color: "var(--alert-red)" }} />
          <p
            style={{
              marginTop: "16px",
              color: "var(--alert-red)",
              fontSize: "15px",
            }}
          >
            {error || "Universe not found"}
          </p>
          <Link
            href="/"
            style={{
              color: "var(--blue-giant)",
              marginTop: "16px",
              display: "inline-block",
              fontSize: "14px",
            }}
          >
            ← Back to Home
          </Link>
        </div>
      </main>
    );
  }

  // 3D Universe view
  return (
    <main
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* 3D Canvas (full-screen background) */}
      <UniverseScene />

      {/* HUD Overlay (transparent controls on top) */}
      <UniverseHUD />
    </main>
  );
}
