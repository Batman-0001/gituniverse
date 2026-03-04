/**
 * Ingestion Orchestrator
 *
 * Ties together all Phase 1 services into a single pipeline:
 * 1. Git Ingestion (parse commits, files, developers)
 * 2. Collaboration Graph (build edges, detect binary stars)
 * 3. Stellar Mass Calculator (compute developer mass)
 * 4. Galaxy Detector (identify microservices/modules)
 * 5. Temporal Event Detector (classify significant moments)
 *
 * Streams progress updates via a callback.
 */

import { Repository } from "@/lib/models";
import { ingestRepository, ProgressCallback } from "@/services/git-ingestion";
import { buildCollaborationGraph } from "@/services/collaboration-graph";
import { calculateStellarMasses } from "@/services/mass-calculator";
import { detectGalaxies } from "@/services/galaxy-detector";
import { detectTemporalEvents } from "@/services/temporal-events";

export async function runFullIngestion(
    repoPath: string,
    onProgress?: ProgressCallback
): Promise<string> {
    const emit = onProgress || (() => { });

    try {
        // Step 1: Git Ingestion
        emit("ingestion", 0, "Starting repository ingestion...");
        const repositoryId = await ingestRepository(repoPath, onProgress);

        // Step 2: Collaboration Graph
        emit("collaboration", 85, "Building collaboration graph...");
        await buildCollaborationGraph(repositoryId, onProgress);

        // Step 3: Stellar Mass Calculator
        emit("mass", 95, "Computing stellar masses...");
        await calculateStellarMasses(repositoryId);

        // Step 4: Galaxy Detection
        emit("galaxies", 96, "Detecting galaxies...");
        await detectGalaxies(repositoryId, onProgress);

        // Step 5: Temporal Event Detection
        emit("events", 97, "Detecting temporal events...");
        await detectTemporalEvents(repositoryId, onProgress);

        // Mark complete
        await Repository.findByIdAndUpdate(repositoryId, {
            ingestionStatus: "complete",
            ingestionProgress: 100,
            ingestionPhase: "Ingestion complete",
        });

        emit("complete", 100, "Universe fully mapped! ✨");

        return repositoryId;
    } catch (error) {
        emit("error", -1, `Error: ${(error as Error).message}`);
        throw error;
    }
}
