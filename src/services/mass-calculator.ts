/**
 * Stellar Mass Calculator
 *
 * Computes a developer's "mass" as a composite score:
 * StellarMass = (commits × 0.25) + (linesAuthored × 0.30) + (longevityDays × 0.20) + (filesOwned × 0.15) + (collaborationEdges × 0.10)
 *
 * Mass is versioned over time and normalized to a 0-100 scale.
 */

import { Types } from "mongoose";
import { Developer, MassSnapshot, IDeveloper, Commit, FileNode, CollaborationEdge } from "@/lib/models";

// ─── Weight Constants ────────────────────────────────────────────────────────

const WEIGHTS = {
    commits: 0.25,
    linesAuthored: 0.30,
    longevityDays: 0.20,
    filesOwned: 0.15,
    collaborationEdges: 0.10,
} as const;

// ─── Stellar Type Classification ─────────────────────────────────────────────

const WHITE_DWARF_INACTIVITY_DAYS = 180;

function classifyStellarType(
    longevityDays: number,
    isActive: boolean,
    normalizedMass: number
): IDeveloper["stellarType"] {
    if (!isActive) return "white_dwarf";
    if (normalizedMass > 75) return "red_giant"; // Massive, dominant
    if (normalizedMass > 50 && longevityDays > 365) return "orange_dwarf"; // Veteran heavy-hitter
    if (longevityDays > 500 && normalizedMass < 25) return "blue_giant"; // Long-lived low-mass
    return "yellow_sun"; // Default: warm sun-like star
}

// ─── Raw Mass Computation ────────────────────────────────────────────────────

interface RawMassComponents {
    commits: number;
    linesAuthored: number;
    longevityDays: number;
    filesOwned: number;
    collaborationEdges: number;
}

function computeRawMass(components: RawMassComponents): number {
    return (
        components.commits * WEIGHTS.commits +
        components.linesAuthored * WEIGHTS.linesAuthored +
        components.longevityDays * WEIGHTS.longevityDays +
        components.filesOwned * WEIGHTS.filesOwned +
        components.collaborationEdges * WEIGHTS.collaborationEdges
    );
}

// ─── Normalization ───────────────────────────────────────────────────────────

function normalizeToScale(value: number, maxValue: number): number {
    if (maxValue === 0) return 0;
    return Math.min(100, (value / maxValue) * 100);
}

// ─── Main Calculator ─────────────────────────────────────────────────────────

export async function calculateStellarMasses(repositoryId: string): Promise<void> {
    const repoObjectId = new Types.ObjectId(repositoryId);
    const developers = await Developer.find({ repositoryId: repoObjectId });

    if (developers.length === 0) return;

    const now = new Date();
    const massComponents: Map<string, RawMassComponents> = new Map();
    const rawMasses: Map<string, number> = new Map();

    // Compute raw components for each developer
    for (const dev of developers) {
        // Count commits
        const commitCount = await Commit.countDocuments({
            repositoryId: repoObjectId,
            developerId: dev._id,
        });

        // Sum lines authored
        const lineStats = await Commit.aggregate([
            { $match: { repositoryId: repoObjectId, developerId: dev._id } },
            { $group: { _id: null, totalLines: { $sum: "$totalLinesAdded" } } },
        ]);
        const linesAuthored = lineStats[0]?.totalLines || 0;

        // Longevity in days
        const firstCommit = await Commit.findOne({
            repositoryId: repoObjectId,
            developerId: dev._id,
        }).sort({ timestamp: 1 });

        const lastCommit = await Commit.findOne({
            repositoryId: repoObjectId,
            developerId: dev._id,
        }).sort({ timestamp: -1 });

        let longevityDays = 0;
        if (firstCommit && lastCommit) {
            longevityDays = Math.ceil(
                (lastCommit.timestamp.getTime() - firstCommit.timestamp.getTime()) / (1000 * 60 * 60 * 24)
            );
        }

        // Files owned
        const filesOwned = await FileNode.countDocuments({
            repositoryId: repoObjectId,
            currentOwnerIds: dev._id,
            isDeleted: false,
        });

        // Collaboration edges
        const collabEdges = await CollaborationEdge.countDocuments({
            repositoryId: repoObjectId,
            $or: [{ developerAId: dev._id }, { developerBId: dev._id }],
        });

        const components: RawMassComponents = {
            commits: commitCount,
            linesAuthored,
            longevityDays,
            filesOwned,
            collaborationEdges: collabEdges,
        };

        massComponents.set(dev._id.toString(), components);
        rawMasses.set(dev._id.toString(), computeRawMass(components));

        // Check if developer is active (committed within last 180 days)
        const daysSinceLastCommit = lastCommit
            ? Math.ceil((now.getTime() - lastCommit.timestamp.getTime()) / (1000 * 60 * 60 * 24))
            : Infinity;

        const isActive = daysSinceLastCommit < WHITE_DWARF_INACTIVITY_DAYS;

        // Update developer basic stats
        await Developer.findByIdAndUpdate(dev._id, {
            totalCommits: commitCount,
            totalLinesAuthored: linesAuthored,
            totalFilesOwned: filesOwned,
            longevityDays,
            collaborationEdgeCount: collabEdges,
            firstCommitDate: firstCommit?.timestamp,
            lastCommitDate: lastCommit?.timestamp,
            isActive,
        });
    }

    // Find max mass for normalization
    const maxMass = Math.max(...Array.from(rawMasses.values()), 1);

    // Normalize and update each developer
    for (const dev of developers) {
        const devId = dev._id.toString();
        const rawMass = rawMasses.get(devId) || 0;
        const normalizedMass = normalizeToScale(rawMass, maxMass);
        const components = massComponents.get(devId)!;
        const isActive = dev.isActive;

        const stellarType = classifyStellarType(components.longevityDays, isActive, normalizedMass);

        await Developer.findByIdAndUpdate(dev._id, {
            stellarMass: rawMass,
            normalizedMass,
            stellarType,
        });

        // Create mass snapshot for this epoch
        const epochDate = new Date(now.getFullYear(), now.getMonth(), 1); // Monthly snapshot
        await MassSnapshot.findOneAndUpdate(
            {
                repositoryId: repoObjectId,
                developerId: dev._id,
                epoch: epochDate,
            },
            {
                stellarMass: rawMass,
                normalizedMass,
                commits: components.commits,
                linesAuthored: components.linesAuthored,
                longevityDays: components.longevityDays,
                filesOwned: components.filesOwned,
                collaborationEdges: components.collaborationEdges,
            },
            { upsert: true, new: true }
        );
    }
}

export { WEIGHTS, computeRawMass, normalizeToScale, classifyStellarType };
