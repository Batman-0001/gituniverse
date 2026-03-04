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

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB();
        const { id } = await params;

        const repository = await Repository.findById(id);
        if (!repository) {
            return Response.json({ error: "Universe not found" }, { status: 404 });
        }

        const [developers, collaborationEdges, galaxies, temporalEvents, fileNodes, massSnapshots] =
            await Promise.all([
                Developer.find({ repositoryId: id }).sort({ normalizedMass: -1 }),
                CollaborationEdge.find({ repositoryId: id }).sort({ weight: -1 }),
                Galaxy.find({ repositoryId: id }),
                TemporalEvent.find({ repositoryId: id }).sort({ timestamp: 1 }),
                FileNode.find({ repositoryId: id, isDeleted: false })
                    .sort({ totalModifications: -1 })
                    .limit(500),
                MassSnapshot.find({ repositoryId: id }).sort({ epoch: 1 }),
            ]);

        return Response.json({
            repository,
            developers,
            collaborationEdges,
            galaxies,
            temporalEvents,
            fileNodes,
            massSnapshots,
            stats: {
                totalDevelopers: developers.length,
                activeDevelopers: developers.filter((d) => d.isActive).length,
                whiteDwarfs: developers.filter((d) => d.stellarType === "white_dwarf").length,
                totalEdges: collaborationEdges.length,
                binaryStars: collaborationEdges.filter((e) => e.isBinaryStar).length,
                totalGalaxies: galaxies.length,
                totalEvents: temporalEvents.length,
                totalFiles: fileNodes.length,
                eventBreakdown: {
                    starBirths: temporalEvents.filter((e) => e.eventType === "STAR_BIRTH").length,
                    whiteDwarfs: temporalEvents.filter((e) => e.eventType === "WHITE_DWARF").length,
                    supernovas: temporalEvents.filter((e) => e.eventType === "SUPERNOVA").length,
                    binaryFormations: temporalEvents.filter((e) => e.eventType === "BINARY_FORMATION").length,
                    debtClearances: temporalEvents.filter((e) => e.eventType === "DEBT_CLEARANCE").length,
                    busFactorAlerts: temporalEvents.filter((e) => e.eventType === "BUS_FACTOR_ALERT").length,
                },
            },
        });
    } catch (error) {
        return Response.json(
            { error: (error as Error).message },
            { status: 500 }
        );
    }
}
