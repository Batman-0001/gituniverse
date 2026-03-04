/**
 * POST /api/ingest
 *
 * Accepts a local path or GitHub URL, kicks off the full ingestion pipeline,
 * and streams progress updates via Server-Sent Events (SSE).
 */

import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { runFullIngestion } from "@/services/orchestrator";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { repoPath } = body;

        if (!repoPath || typeof repoPath !== "string") {
            return Response.json(
                { error: "repoPath is required" },
                { status: 400 }
            );
        }

        await connectDB();

        // Create a readable stream for SSE
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const sendEvent = (phase: string, progress: number, detail?: string) => {
                    const data = JSON.stringify({ phase, progress, detail, timestamp: Date.now() });
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                };

                try {
                    const repositoryId = await runFullIngestion(repoPath, sendEvent);
                    sendEvent("complete", 100, repositoryId);
                    controller.close();
                } catch (error) {
                    sendEvent("error", -1, (error as Error).message);
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            },
        });
    } catch (error) {
        return Response.json(
            { error: (error as Error).message },
            { status: 500 }
        );
    }
}
