/**
 * Collaboration Graph Builder
 *
 * Builds typed, weighted edges between developers based on:
 * - CO_AUTHOR: Same commit (3.0× multiplier)
 * - CO_MODIFIER: Same file within 14 days (1.5× multiplier)
 * - Temporal decay: older collaborations count less
 * - Binary Star detection: >40% shared edges = binary star system
 */

import { Types } from "mongoose";
import { Commit, Developer, CollaborationEdge, IDeveloper } from "@/lib/models";

// ─── Edge Weight Multipliers ─────────────────────────────────────────────────

const EDGE_MULTIPLIERS = {
    CO_AUTHOR: 3.0,
    CO_MODIFIER: 1.5,
    PR_REVIEWER: 2.5,
    ISSUE_ASSIGNEE: 1.0,
} as const;

const BINARY_STAR_THRESHOLD = 0.40; // 40% shared edges
const CO_MODIFIER_WINDOW_DAYS = 14;

// ─── Temporal Decay ──────────────────────────────────────────────────────────

function calculateDecay(lastInteraction: Date, now: Date): number {
    const daysSince = (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24);
    // Half-life of ~365 days
    return Math.exp(-0.693 * (daysSince / 365));
}

// ─── Build Co-Author Edges ───────────────────────────────────────────────────

async function buildCoAuthorEdges(repositoryId: Types.ObjectId): Promise<void> {
    const commits = await Commit.find({
        repositoryId,
        "coAuthors.0": { $exists: true },
    }).populate("developerId");

    for (const commit of commits) {
        const authorDevId = commit.developerId;

        for (const coAuthorEmail of commit.coAuthors) {
            const coAuthorDev = await Developer.findOne({
                repositoryId,
                emails: coAuthorEmail,
            });

            if (!coAuthorDev || coAuthorDev._id.equals(authorDevId)) continue;

            // Sort IDs for consistent edge direction
            const [devA, devB] = [authorDevId, coAuthorDev._id].sort((a, b) =>
                a.toString().localeCompare(b.toString())
            );

            await CollaborationEdge.findOneAndUpdate(
                {
                    repositoryId,
                    developerAId: devA,
                    developerBId: devB,
                    edgeType: "CO_AUTHOR",
                },
                {
                    $inc: { rawWeight: 1, sharedCommitCount: 1 },
                    $set: {
                        multiplier: EDGE_MULTIPLIERS.CO_AUTHOR,
                        lastInteraction: commit.timestamp,
                    },
                    $setOnInsert: {
                        firstInteraction: commit.timestamp,
                        sharedFiles: [],
                    },
                },
                { upsert: true, new: true }
            );
        }
    }
}

// ─── Build Co-Modifier Edges ─────────────────────────────────────────────────

async function buildCoModifierEdges(repositoryId: Types.ObjectId): Promise<void> {
    // Get all files that have been modified by multiple developers
    const commits = await Commit.find({ repositoryId })
        .sort({ timestamp: 1 })
        .select("developerId timestamp files");

    // Build a map of file path → [{developerId, timestamp}]
    const fileModHistory = new Map<string, Array<{ devId: Types.ObjectId; timestamp: Date }>>();

    for (const commit of commits) {
        for (const file of commit.files) {
            if (!fileModHistory.has(file.path)) {
                fileModHistory.set(file.path, []);
            }
            fileModHistory.get(file.path)!.push({
                devId: commit.developerId,
                timestamp: commit.timestamp,
            });
        }
    }

    // Find co-modifications within the 14-day window
    const edgeAccumulator = new Map<string, {
        devA: Types.ObjectId;
        devB: Types.ObjectId;
        sharedFiles: Set<string>;
        count: number;
        firstInteraction: Date;
        lastInteraction: Date;
    }>();

    for (const [filePath, mods] of fileModHistory) {
        for (let i = 0; i < mods.length; i++) {
            for (let j = i + 1; j < mods.length; j++) {
                if (mods[i].devId.equals(mods[j].devId)) continue;

                const daysDiff = Math.abs(
                    mods[j].timestamp.getTime() - mods[i].timestamp.getTime()
                ) / (1000 * 60 * 60 * 24);

                if (daysDiff <= CO_MODIFIER_WINDOW_DAYS) {
                    const [devA, devB] = [mods[i].devId, mods[j].devId].sort((a, b) =>
                        a.toString().localeCompare(b.toString())
                    );
                    const key = `${devA}-${devB}`;

                    if (!edgeAccumulator.has(key)) {
                        edgeAccumulator.set(key, {
                            devA,
                            devB,
                            sharedFiles: new Set(),
                            count: 0,
                            firstInteraction: mods[i].timestamp,
                            lastInteraction: mods[j].timestamp,
                        });
                    }

                    const edge = edgeAccumulator.get(key)!;
                    edge.sharedFiles.add(filePath);
                    edge.count++;
                    if (mods[j].timestamp > edge.lastInteraction) {
                        edge.lastInteraction = mods[j].timestamp;
                    }
                }
            }
        }
    }

    // Upsert co-modifier edges
    for (const [, edge] of edgeAccumulator) {
        await CollaborationEdge.findOneAndUpdate(
            {
                repositoryId,
                developerAId: edge.devA,
                developerBId: edge.devB,
                edgeType: "CO_MODIFIER",
            },
            {
                rawWeight: edge.count,
                multiplier: EDGE_MULTIPLIERS.CO_MODIFIER,
                weight: edge.count * EDGE_MULTIPLIERS.CO_MODIFIER,
                sharedFiles: Array.from(edge.sharedFiles),
                sharedCommitCount: edge.count,
                firstInteraction: edge.firstInteraction,
                lastInteraction: edge.lastInteraction,
            },
            { upsert: true, new: true }
        );
    }
}

// ─── Apply Temporal Decay ────────────────────────────────────────────────────

async function applyTemporalDecay(repositoryId: Types.ObjectId): Promise<void> {
    const now = new Date();
    const edges = await CollaborationEdge.find({ repositoryId });

    for (const edge of edges) {
        const decay = calculateDecay(edge.lastInteraction, now);
        const decayedWeight = edge.rawWeight * edge.multiplier * decay;

        await CollaborationEdge.findByIdAndUpdate(edge._id, {
            decayFactor: decay,
            weight: decayedWeight,
        });
    }
}

// ─── Binary Star Detection ───────────────────────────────────────────────────

async function detectBinaryStars(repositoryId: Types.ObjectId): Promise<void> {
    const developers = await Developer.find({ repositoryId });

    for (const dev of developers) {
        const devEdges = await CollaborationEdge.find({
            repositoryId,
            $or: [{ developerAId: dev._id }, { developerBId: dev._id }],
        });

        if (devEdges.length === 0) continue;

        const totalWeight = devEdges.reduce((sum, e) => sum + e.weight, 0);

        // Check each partner
        for (const edge of devEdges) {
            const partnerId = edge.developerAId.equals(dev._id)
                ? edge.developerBId
                : edge.developerAId;

            // Get partner's edges
            const partnerEdges = await CollaborationEdge.find({
                repositoryId,
                $or: [{ developerAId: partnerId }, { developerBId: partnerId }],
            });

            const partnerTotalWeight = partnerEdges.reduce((sum, e) => sum + e.weight, 0);

            // Check if this edge represents >40% of both developers' collaboration
            const devShare = totalWeight > 0 ? edge.weight / totalWeight : 0;
            const partnerShare = partnerTotalWeight > 0 ? edge.weight / partnerTotalWeight : 0;

            const isBinary = devShare > BINARY_STAR_THRESHOLD && partnerShare > BINARY_STAR_THRESHOLD;

            if (edge.isBinaryStar !== isBinary) {
                await CollaborationEdge.findByIdAndUpdate(edge._id, { isBinaryStar: isBinary });
            }
        }
    }
}

// ─── Main Builder ────────────────────────────────────────────────────────────

export async function buildCollaborationGraph(
    repositoryId: string,
    onProgress?: (phase: string, progress: number, detail?: string) => void
): Promise<void> {
    const emit = onProgress || (() => { });
    const repoObjectId = new Types.ObjectId(repositoryId);

    emit("collaboration", 86, "Building co-author edges...");
    await buildCoAuthorEdges(repoObjectId);

    emit("collaboration", 89, "Building co-modifier edges...");
    await buildCoModifierEdges(repoObjectId);

    emit("collaboration", 92, "Applying temporal decay...");
    await applyTemporalDecay(repoObjectId);

    emit("collaboration", 94, "Detecting binary star systems...");
    await detectBinaryStars(repoObjectId);

    emit("collaboration", 95, "Collaboration graph complete");
}

export { EDGE_MULTIPLIERS, BINARY_STAR_THRESHOLD, calculateDecay };
