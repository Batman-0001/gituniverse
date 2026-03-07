/**
 * GET /api/universe/[id]
 *
 * Returns the full universe data for a repository:
 * - Repository metadata
 * - Developers (stars) with stellar mass
 * - Collaboration edges
 * - Galaxies
 * - Temporal events
 * - File nodes (planets)
 */

import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import {
  Repository,
  Developer,
  Commit,
  FileNode,
  CollaborationEdge,
  Galaxy,
  TemporalEvent,
  MassSnapshot,
} from "@/lib/models";

// ─── Commit Volume Aggregation (weekly buckets) ──────────────────────────────

interface WeekBucket {
  weekStart: string;
  count: number;
  linesChanged: number;
}

function aggregateCommitVolume(
  commits: Array<{
    timestamp: Date;
    totalLinesAdded: number;
    totalLinesDeleted: number;
  }>,
): WeekBucket[] {
  if (commits.length === 0) return [];

  const buckets = new Map<string, { count: number; linesChanged: number }>();

  for (const commit of commits) {
    const d = new Date(commit.timestamp);
    // Bucket by ISO week start (Monday)
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    const key = weekStart.toISOString().slice(0, 10);

    const existing = buckets.get(key) || { count: 0, linesChanged: 0 };
    existing.count += 1;
    existing.linesChanged +=
      (commit.totalLinesAdded || 0) + (commit.totalLinesDeleted || 0);
    buckets.set(key, existing);
  }

  return Array.from(buckets.entries())
    .map(([weekStart, data]) => ({ weekStart, ...data }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;

    const repository = await Repository.findById(id);
    if (!repository) {
      return Response.json({ error: "Universe not found" }, { status: 404 });
    }

    const [
      developers,
      collaborationEdges,
      galaxies,
      temporalEvents,
      fileNodes,
      massSnapshots,
    ] = await Promise.all([
      Developer.find({ repositoryId: id }).sort({ normalizedMass: -1 }),
      CollaborationEdge.find({ repositoryId: id }).sort({ weight: -1 }),
      Galaxy.find({ repositoryId: id }),
      TemporalEvent.find({ repositoryId: id }).sort({ timestamp: 1 }),
      FileNode.find({ repositoryId: id, isDeleted: false })
        .sort({ totalModifications: -1 })
        .limit(500),
      MassSnapshot.find({ repositoryId: id }).sort({ epoch: 1 }),
    ]);

    // Fetch all commits for timeline waveform (only timestamps + line counts)
    const commitsForTimeline = await Commit.find(
      { repositoryId: id },
      { timestamp: 1, totalLinesAdded: 1, totalLinesDeleted: 1 },
    ).sort({ timestamp: 1 });

    const commitVolume = aggregateCommitVolume(commitsForTimeline);

    // Developer temporal data (first/last commit timestamps)
    const developerTimestamps = developers.map((d) => ({
      id: d._id.toString(),
      firstCommit:
        d.firstCommitDate?.toISOString() || repository.createdAt.toISOString(),
      lastCommit:
        d.lastCommitDate?.toISOString() || repository.updatedAt.toISOString(),
    }));

    // File temporal data (created/modified timestamps)
    const fileTimestamps = fileNodes.map((f) => ({
      id: f._id.toString(),
      createdAt:
        f.createdAt?.toISOString() || repository.createdAt.toISOString(),
      lastModified:
        f.lastModifiedAt?.toISOString() ||
        f.createdAt?.toISOString() ||
        repository.updatedAt.toISOString(),
    }));

    return Response.json({
      repository,
      developers,
      collaborationEdges,
      galaxies,
      temporalEvents,
      fileNodes,
      massSnapshots,
      // Phase 3: Temporal dimension data
      commitVolume,
      developerTimestamps,
      fileTimestamps,
      stats: {
        totalDevelopers: developers.length,
        activeDevelopers: developers.filter((d) => d.isActive).length,
        whiteDwarfs: developers.filter((d) => d.stellarType === "white_dwarf")
          .length,
        totalEdges: collaborationEdges.length,
        binaryStars: collaborationEdges.filter((e) => e.isBinaryStar).length,
        totalGalaxies: galaxies.length,
        totalEvents: temporalEvents.length,
        totalFiles: fileNodes.length,
        eventBreakdown: {
          starBirths: temporalEvents.filter((e) => e.eventType === "STAR_BIRTH")
            .length,
          whiteDwarfs: temporalEvents.filter(
            (e) => e.eventType === "WHITE_DWARF",
          ).length,
          supernovas: temporalEvents.filter((e) => e.eventType === "SUPERNOVA")
            .length,
          binaryFormations: temporalEvents.filter(
            (e) => e.eventType === "BINARY_FORMATION",
          ).length,
          debtClearances: temporalEvents.filter(
            (e) => e.eventType === "DEBT_CLEARANCE",
          ).length,
          busFactorAlerts: temporalEvents.filter(
            (e) => e.eventType === "BUS_FACTOR_ALERT",
          ).length,
        },
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
