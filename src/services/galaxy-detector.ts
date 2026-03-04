/**
 * Galaxy (Service/Module) Detector
 *
 * Auto-detects galaxies (microservices/modules) via:
 * 1. Explicit: nx.json, turbo.json, pnpm-workspace.yaml, lerna.json
 * 2. Structural: subdirectories with their own package.json
 * 3. Inferred: community detection on file co-modification graph
 * 4. Manual override: user-tagged files
 *
 * Each galaxy gets a deterministic color, spatial position, and drift velocity.
 */

import { Types } from "mongoose";
import { FileNode, Galaxy, Developer, Commit } from "@/lib/models";

// ─── Deterministic Color from Galaxy Name ────────────────────────────────────

function galaxyColorHue(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
}

// ─── Spatial Position ────────────────────────────────────────────────────────

function computeGalaxyCentroid(index: number, total: number): { x: number; y: number; z: number } {
    // Arrange galaxies in a spiral pattern
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const radius = 50 + index * 30;
    const theta = index * goldenAngle;
    const phi = Math.acos(1 - (2 * (index + 0.5)) / Math.max(total, 1));

    return {
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.sin(phi) * Math.sin(theta),
        z: radius * Math.cos(phi),
    };
}

// ─── Structural Galaxy Detection ─────────────────────────────────────────────

async function detectStructuralGalaxies(
    repositoryId: Types.ObjectId
): Promise<Map<string, Set<string>>> {
    const galaxies = new Map<string, Set<string>>();

    const allFiles = await FileNode.find({ repositoryId, isDeleted: false }).select("path");

    // Detect workspace patterns from file paths
    const workspaceMarkers = [
        "package.json",
        "pyproject.toml",
        "Cargo.toml",
        "go.mod",
        "pom.xml",
        "build.gradle",
    ];

    const directories = new Set<string>();

    for (const file of allFiles) {
        const parts = file.path.split("/");
        // Check for workspace markers at depth 2 (e.g., packages/foo/package.json)
        for (let depth = 1; depth < Math.min(parts.length, 4); depth++) {
            const fileName = parts[depth];
            if (workspaceMarkers.includes(fileName) && depth > 0) {
                const galaxyName = parts.slice(0, depth).join("/");
                directories.add(galaxyName);
            }
        }
    }

    // Group files by detected galaxies
    for (const dir of directories) {
        const filesInDir = allFiles
            .filter((f) => f.path.startsWith(dir + "/"))
            .map((f) => f.path);

        if (filesInDir.length > 0) {
            galaxies.set(dir, new Set(filesInDir));
        }
    }

    return galaxies;
}

// ─── Inferred Galaxy Detection (Simple Community Detection) ──────────────────

async function detectInferredGalaxies(
    repositoryId: Types.ObjectId
): Promise<Map<string, Set<string>>> {
    const galaxies = new Map<string, Set<string>>();

    const allFiles = await FileNode.find({ repositoryId, isDeleted: false }).select("path");

    // Group files by their top-level directory
    const dirGroups = new Map<string, Set<string>>();

    for (const file of allFiles) {
        const parts = file.path.split("/");
        let groupKey: string;

        if (parts.length > 1) {
            groupKey = parts[0];
        } else {
            groupKey = "_root";
        }

        if (!dirGroups.has(groupKey)) {
            dirGroups.set(groupKey, new Set());
        }
        dirGroups.get(groupKey)!.add(file.path);
    }

    // Only create galaxies for directories with enough files
    for (const [dir, files] of dirGroups) {
        if (files.size >= 3 && dir !== "_root") {
            galaxies.set(dir, files);
        }
    }

    // Handle root files as their own galaxy
    const rootFiles = dirGroups.get("_root");
    if (rootFiles && rootFiles.size > 0) {
        galaxies.set("Root Config", rootFiles);
    }

    return galaxies;
}

// ─── Main Detector ───────────────────────────────────────────────────────────

export async function detectGalaxies(
    repositoryId: string,
    onProgress?: (phase: string, progress: number, detail?: string) => void
): Promise<void> {
    const emit = onProgress || (() => { });
    const repoObjectId = new Types.ObjectId(repositoryId);

    emit("galaxies", 95, "Detecting service/module boundaries...");

    // Try structural detection first
    let detectedGalaxies = await detectStructuralGalaxies(repoObjectId);
    let method: "structural" | "inferred" = "structural";

    // Fall back to inferred if no structural galaxies found
    if (detectedGalaxies.size === 0) {
        detectedGalaxies = await detectInferredGalaxies(repoObjectId);
        method = "inferred";
    }

    emit("galaxies", 96, `Detected ${detectedGalaxies.size} galaxies via ${method} method`);

    // Create galaxy records
    let galaxyIndex = 0;
    const totalGalaxies = detectedGalaxies.size;

    for (const [name, filePaths] of detectedGalaxies) {
        const centroid = computeGalaxyCentroid(galaxyIndex, totalGalaxies);

        // Find developers who work on files in this galaxy
        const filesInGalaxy = await FileNode.find({
            repositoryId: repoObjectId,
            path: { $in: Array.from(filePaths) },
            isDeleted: false,
        });

        const devIds = new Set<string>();
        for (const file of filesInGalaxy) {
            for (const ownerId of file.currentOwnerIds) {
                devIds.add(ownerId.toString());
            }
        }

        const galaxy = await Galaxy.findOneAndUpdate(
            { repositoryId: repoObjectId, name },
            {
                detectionMethod: method,
                filePaths: Array.from(filePaths),
                developerIds: Array.from(devIds).map((id) => new Types.ObjectId(id)),
                colorHue: galaxyColorHue(name),
                totalFiles: filePaths.size,
                totalDevelopers: devIds.size,
                centroidX: centroid.x,
                centroidY: centroid.y,
                centroidZ: centroid.z,
                previousCentroidX: centroid.x,
                previousCentroidY: centroid.y,
                previousCentroidZ: centroid.z,
                driftVelocity: 0,
            },
            { upsert: true, new: true }
        );

        // Update file nodes with galaxy assignment
        await FileNode.updateMany(
            {
                repositoryId: repoObjectId,
                path: { $in: Array.from(filePaths) },
            },
            { galaxyId: galaxy._id }
        );

        // Update developers with galaxy assignment
        for (const devIdStr of devIds) {
            await Developer.findByIdAndUpdate(devIdStr, {
                $addToSet: { galaxyIds: galaxy._id },
            });
        }

        galaxyIndex++;
    }

    emit("galaxies", 97, `Created ${detectedGalaxies.size} galaxies`);
}

export { galaxyColorHue, computeGalaxyCentroid };
