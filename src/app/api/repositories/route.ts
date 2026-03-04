/**
 * GET /api/repositories
 *
 * Returns all ingested repositories with their status.
 */

import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Repository } from "@/lib/models";

export async function GET(request: NextRequest) {
    try {
        await connectDB();

        const repositories = await Repository.find()
            .sort({ updatedAt: -1 })
            .select(
                "name fullName url source ingestionStatus ingestionProgress ingestionPhase totalCommits totalDevelopers totalFiles firstCommitDate lastCommitDate createdAt updatedAt"
            );

        return Response.json({ repositories });
    } catch (error) {
        return Response.json(
            { error: (error as Error).message },
            { status: 500 }
        );
    }
}
