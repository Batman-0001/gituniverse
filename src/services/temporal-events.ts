/**
 * Temporal Event Detector
 *
 * Automatically classifies significant moments in repository history:
 * - STAR_BIRTH: Developer's first commit
 * - WHITE_DWARF: No commits for 180+ days
 * - SUPERNOVA: Single commit deletes >30% of files
 * - BINARY_FORMATION: Two devs cross binary star threshold
 * - GALAXY_SPLIT: Service extracted from monolith
 * - GALAXY_MERGE: Two services merged
 * - DEBT_CLEARANCE: Large refactor (high churn, net negative LOC)
 * - BUS_FACTOR_ALERT: Single dev owns >60% of a galaxy
 */

import { Types } from "mongoose";
import {
    Developer,
    Commit,
    FileNode,
    Galaxy,
    CollaborationEdge,
    TemporalEvent,
    TemporalEventType,
} from "@/lib/models";

// ─── Detection Thresholds ────────────────────────────────────────────────────

const THRESHOLDS = {
    WHITE_DWARF_DAYS: 180,
    SUPERNOVA_DELETE_RATIO: 0.30,
    BUS_FACTOR_OWNERSHIP_RATIO: 0.60,
    DEBT_CLEARANCE_MIN_CHURN: 100,
    DEBT_CLEARANCE_NET_NEGATIVE_RATIO: 0.50,
};

// ─── Star Birth Detection ────────────────────────────────────────────────────

async function detectStarBirths(repositoryId: Types.ObjectId): Promise<void> {
    const developers = await Developer.find({ repositoryId });

    for (const dev of developers) {
        const firstCommit = await Commit.findOne({
            repositoryId,
            developerId: dev._id,
        }).sort({ timestamp: 1 });

        if (!firstCommit) continue;

        // Check if event already exists
        const existing = await TemporalEvent.findOne({
            repositoryId,
            eventType: "STAR_BIRTH",
            developerId: dev._id,
        });

        if (!existing) {
            await TemporalEvent.create({
                repositoryId,
                eventType: "STAR_BIRTH" as TemporalEventType,
                timestamp: firstCommit.timestamp,
                developerId: dev._id,
                commitHash: firstCommit.hash,
                description: `${dev.name} made their first commit`,
                magnitude: 1.0,
                metadata: {
                    commitMessage: firstCommit.message,
                    filesChanged: firstCommit.totalFilesChanged,
                },
            });
        }
    }
}

// ─── White Dwarf Detection ───────────────────────────────────────────────────

async function detectWhiteDwarfs(repositoryId: Types.ObjectId): Promise<void> {
    const now = new Date();
    const developers = await Developer.find({ repositoryId });

    for (const dev of developers) {
        const lastCommit = await Commit.findOne({
            repositoryId,
            developerId: dev._id,
        }).sort({ timestamp: -1 });

        if (!lastCommit) continue;

        const daysSinceLastCommit = Math.ceil(
            (now.getTime() - lastCommit.timestamp.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLastCommit >= THRESHOLDS.WHITE_DWARF_DAYS) {
            const existing = await TemporalEvent.findOne({
                repositoryId,
                eventType: "WHITE_DWARF",
                developerId: dev._id,
            });

            if (!existing) {
                // The event timestamp is when they became inactive (180 days after last commit)
                const whiteDwarfDate = new Date(
                    lastCommit.timestamp.getTime() + THRESHOLDS.WHITE_DWARF_DAYS * 24 * 60 * 60 * 1000
                );

                await TemporalEvent.create({
                    repositoryId,
                    eventType: "WHITE_DWARF" as TemporalEventType,
                    timestamp: whiteDwarfDate,
                    developerId: dev._id,
                    description: `${dev.name} became inactive (${daysSinceLastCommit} days since last commit)`,
                    magnitude: daysSinceLastCommit / 365,
                    metadata: {
                        daysSinceLastCommit,
                        lastCommitDate: lastCommit.timestamp,
                        filesOrphaned: dev.totalFilesOwned,
                    },
                });
            }
        }
    }
}

// ─── Supernova Detection ─────────────────────────────────────────────────────

async function detectSupernovas(repositoryId: Types.ObjectId): Promise<void> {
    const totalFiles = await FileNode.countDocuments({ repositoryId });
    if (totalFiles === 0) return;

    const threshold = Math.floor(totalFiles * THRESHOLDS.SUPERNOVA_DELETE_RATIO);

    // Find commits that deleted a large number of files
    const commits = await Commit.find({ repositoryId }).sort({ timestamp: 1 });

    for (const commit of commits) {
        const deletedFiles = commit.files.filter((f: { status: string }) => f.status === "deleted");

        if (deletedFiles.length >= threshold || commit.totalLinesDeleted > commit.totalLinesAdded * 3) {
            const existing = await TemporalEvent.findOne({
                repositoryId,
                eventType: "SUPERNOVA",
                commitHash: commit.hash,
            });

            if (!existing) {
                const dev = await Developer.findById(commit.developerId);
                await TemporalEvent.create({
                    repositoryId,
                    eventType: "SUPERNOVA" as TemporalEventType,
                    timestamp: commit.timestamp,
                    developerId: commit.developerId,
                    commitHash: commit.hash,
                    description: `Massive deletion: ${deletedFiles.length} files removed (${commit.totalLinesDeleted} lines deleted)`,
                    magnitude: deletedFiles.length / totalFiles,
                    metadata: {
                        filesDeleted: deletedFiles.length,
                        linesDeleted: commit.totalLinesDeleted,
                        linesAdded: commit.totalLinesAdded,
                        commitMessage: commit.message,
                        developerName: dev?.name,
                    },
                });
            }
        }
    }
}

// ─── Binary Formation Detection ──────────────────────────────────────────────

async function detectBinaryFormations(repositoryId: Types.ObjectId): Promise<void> {
    const binaryEdges = await CollaborationEdge.find({
        repositoryId,
        isBinaryStar: true,
    });

    for (const edge of binaryEdges) {
        const existing = await TemporalEvent.findOne({
            repositoryId,
            eventType: "BINARY_FORMATION",
            developerId: edge.developerAId,
            developerBId: edge.developerBId,
        });

        if (!existing) {
            const devA = await Developer.findById(edge.developerAId);
            const devB = await Developer.findById(edge.developerBId);

            await TemporalEvent.create({
                repositoryId,
                eventType: "BINARY_FORMATION" as TemporalEventType,
                timestamp: edge.firstInteraction,
                developerId: edge.developerAId,
                developerBId: edge.developerBId,
                description: `${devA?.name} and ${devB?.name} formed a binary star system (${edge.sharedFiles.length} shared files)`,
                magnitude: edge.weight,
                metadata: {
                    sharedFiles: edge.sharedFiles.length,
                    sharedCommits: edge.sharedCommitCount,
                    collaborationWeight: edge.weight,
                },
            });
        }
    }
}

// ─── Debt Clearance Detection ────────────────────────────────────────────────

async function detectDebtClearance(repositoryId: Types.ObjectId): Promise<void> {
    // Find commits with high churn and net negative LOC
    const commits = await Commit.find({ repositoryId }).sort({ timestamp: 1 });

    for (const commit of commits) {
        const totalChurn = commit.totalLinesAdded + commit.totalLinesDeleted;
        const netLines = commit.totalLinesAdded - commit.totalLinesDeleted;

        if (
            totalChurn >= THRESHOLDS.DEBT_CLEARANCE_MIN_CHURN &&
            netLines < 0 &&
            Math.abs(netLines) > totalChurn * THRESHOLDS.DEBT_CLEARANCE_NET_NEGATIVE_RATIO
        ) {
            const existing = await TemporalEvent.findOne({
                repositoryId,
                eventType: "DEBT_CLEARANCE",
                commitHash: commit.hash,
            });

            if (!existing) {
                const dev = await Developer.findById(commit.developerId);
                await TemporalEvent.create({
                    repositoryId,
                    eventType: "DEBT_CLEARANCE" as TemporalEventType,
                    timestamp: commit.timestamp,
                    developerId: commit.developerId,
                    commitHash: commit.hash,
                    description: `Technical debt clearance: ${Math.abs(netLines)} net lines removed in refactor`,
                    magnitude: Math.abs(netLines) / totalChurn,
                    metadata: {
                        linesAdded: commit.totalLinesAdded,
                        linesDeleted: commit.totalLinesDeleted,
                        netLines,
                        totalChurn,
                        filesChanged: commit.totalFilesChanged,
                        developerName: dev?.name,
                    },
                });
            }
        }
    }
}

// ─── Bus Factor Alert Detection ──────────────────────────────────────────────

async function detectBusFactorAlerts(repositoryId: Types.ObjectId): Promise<void> {
    const galaxies = await Galaxy.find({ repositoryId });

    for (const galaxy of galaxies) {
        if (galaxy.totalFiles === 0) continue;

        // Count files owned by each developer in this galaxy
        const filesInGalaxy = await FileNode.find({
            repositoryId,
            galaxyId: galaxy._id,
            isDeleted: false,
        });

        const ownershipCount = new Map<string, number>();

        for (const file of filesInGalaxy) {
            for (const ownerId of file.currentOwnerIds) {
                const key = ownerId.toString();
                ownershipCount.set(key, (ownershipCount.get(key) || 0) + 1);
            }
        }

        // Check if any single developer owns >60%
        for (const [devId, count] of ownershipCount) {
            const ratio = count / galaxy.totalFiles;

            if (ratio >= THRESHOLDS.BUS_FACTOR_OWNERSHIP_RATIO) {
                const existing = await TemporalEvent.findOne({
                    repositoryId,
                    eventType: "BUS_FACTOR_ALERT",
                    developerId: new Types.ObjectId(devId),
                    galaxyId: galaxy._id,
                });

                if (!existing) {
                    const dev = await Developer.findById(devId);
                    await TemporalEvent.create({
                        repositoryId,
                        eventType: "BUS_FACTOR_ALERT" as TemporalEventType,
                        timestamp: new Date(),
                        developerId: new Types.ObjectId(devId),
                        galaxyId: galaxy._id,
                        description: `${dev?.name} owns ${Math.round(ratio * 100)}% of ${galaxy.name} — critical bus factor`,
                        magnitude: ratio,
                        metadata: {
                            filesOwned: count,
                            totalFilesInGalaxy: galaxy.totalFiles,
                            ownershipRatio: ratio,
                            galaxyName: galaxy.name,
                            developerName: dev?.name,
                        },
                    });
                }
            }
        }
    }
}

// ─── Main Detector ───────────────────────────────────────────────────────────

export async function detectTemporalEvents(
    repositoryId: string,
    onProgress?: (phase: string, progress: number, detail?: string) => void
): Promise<void> {
    const emit = onProgress || (() => { });
    const repoObjectId = new Types.ObjectId(repositoryId);

    emit("events", 97, "Detecting star births...");
    await detectStarBirths(repoObjectId);

    emit("events", 97.5, "Detecting white dwarfs...");
    await detectWhiteDwarfs(repoObjectId);

    emit("events", 98, "Detecting supernovas...");
    await detectSupernovas(repoObjectId);

    emit("events", 98.5, "Detecting binary formations...");
    await detectBinaryFormations(repoObjectId);

    emit("events", 99, "Detecting debt clearance...");
    await detectDebtClearance(repoObjectId);

    emit("events", 99.5, "Detecting bus factor alerts...");
    await detectBusFactorAlerts(repoObjectId);

    emit("events", 100, "Temporal event detection complete");
}

export { THRESHOLDS };
