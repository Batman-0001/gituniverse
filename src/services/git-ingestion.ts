/**
 * Git Ingestion Pipeline
 *
 * Parses a local Git repository, extracting:
 * - All commits with metadata
 * - File change details
 * - Co-authorship from commit trailers
 * - Email normalization (one dev, many emails → single identity)
 * - File type classification
 */

import simpleGit, { SimpleGit, LogResult, DefaultLogFields } from "simple-git";
import { Types } from "mongoose";
import {
    Repository,
    Developer,
    Commit,
    FileNode,
    ICommitFile,
} from "@/lib/models";

// ─── File Type Classification ────────────────────────────────────────────────

const FILE_TYPE_MAP: Record<string, IFileNode["fileType"]> = {
    // JavaScript / TypeScript
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
    ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
    // Config
    json: "config", yaml: "config", yml: "config", toml: "config",
    ini: "config", env: "config", editorconfig: "config",
    // Test
    spec: "test", test: "test",
    // Docs
    md: "docs", mdx: "docs", txt: "docs", rst: "docs", adoc: "docs",
    // Style
    css: "style", scss: "style", sass: "style", less: "style",
    // Data
    sql: "data", csv: "data", xml: "data",
};

interface IFileNode {
    fileType: "javascript" | "typescript" | "config" | "test" | "docs" | "style" | "data" | "other";
}

function classifyFileType(filePath: string): IFileNode["fileType"] {
    const parts = filePath.split(".");
    const ext = parts[parts.length - 1]?.toLowerCase() || "";

    // Check if it's a test file
    if (filePath.includes("__tests__") || filePath.includes(".test.") || filePath.includes(".spec.")) {
        return "test";
    }

    return FILE_TYPE_MAP[ext] || "other";
}

// ─── Email Normalization ─────────────────────────────────────────────────────

interface DeveloperIdentity {
    name: string;
    emails: Set<string>;
    primaryEmail: string;
}

function normalizeEmail(email: string): string {
    // Remove noreply GitHub patterns
    const githubMatch = email.match(/^(\d+\+)?(.+)@users\.noreply\.github\.com$/);
    if (githubMatch) {
        return githubMatch[2] + "@github";
    }
    return email.toLowerCase().trim();
}

function buildDeveloperIdentities(
    commits: Array<{ authorName: string; authorEmail: string }>
): Map<string, DeveloperIdentity> {
    const identities = new Map<string, DeveloperIdentity>();
    const emailToKey = new Map<string, string>();

    for (const commit of commits) {
        const normalizedEmail = normalizeEmail(commit.authorEmail);
        const name = commit.authorName.trim();

        // Check if we've seen this email before
        const existingKey = emailToKey.get(normalizedEmail);

        if (existingKey) {
            // Add to existing identity
            const identity = identities.get(existingKey)!;
            identity.emails.add(commit.authorEmail);
            // Use the most recent name
            identity.name = name;
        } else {
            // Check if we've seen this name with a different email (possible same person)
            let foundKey: string | null = null;
            for (const [key, identity] of identities) {
                if (identity.name.toLowerCase() === name.toLowerCase()) {
                    foundKey = key;
                    break;
                }
            }

            if (foundKey) {
                const identity = identities.get(foundKey)!;
                identity.emails.add(commit.authorEmail);
                emailToKey.set(normalizedEmail, foundKey);
            } else {
                // Create new identity
                const key = normalizedEmail;
                identities.set(key, {
                    name,
                    emails: new Set([commit.authorEmail]),
                    primaryEmail: commit.authorEmail,
                });
                emailToKey.set(normalizedEmail, key);
            }
        }
    }

    return identities;
}

// ─── Co-Author Extraction ────────────────────────────────────────────────────

function extractCoAuthors(message: string): string[] {
    const coAuthorRegex = /Co-authored-by:\s*(.+?)\s*<(.+?)>/gi;
    const coAuthors: string[] = [];
    let match;

    while ((match = coAuthorRegex.exec(message)) !== null) {
        coAuthors.push(match[2].trim()); // email
    }

    return coAuthors;
}

// ─── Progress Callback ──────────────────────────────────────────────────────

export type ProgressCallback = (phase: string, progress: number, detail?: string) => void;

// ─── Main Ingestion ──────────────────────────────────────────────────────────

export async function ingestRepository(
    repoPath: string,
    onProgress?: ProgressCallback
): Promise<string> {
    const emit = onProgress || (() => { });

    // Phase 1: Initialize
    emit("initializing", 0, "Setting up repository analysis...");

    const git: SimpleGit = simpleGit(repoPath);

    // Verify it's a valid git repo
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
        throw new Error(`Not a valid Git repository: ${repoPath}`);
    }

    // Get repo info
    const remotes = await git.getRemotes(true);
    const originRemote = remotes.find((r) => r.name === "origin");
    const repoUrl = originRemote?.refs?.fetch || "";
    const repoName = repoPath.split(/[/\\]/).pop() || "unknown";
    const fullName = repoUrl
        ? repoUrl.replace(/\.git$/, "").split("/").slice(-2).join("/")
        : repoName;

    // Get default branch
    let defaultBranch = "main";
    try {
        const branches = await git.branch();
        defaultBranch = branches.current || "main";
    } catch {
        // fallback
    }

    // Create or update repository record
    let repository = await Repository.findOneAndUpdate(
        { fullName },
        {
            name: repoName,
            fullName,
            url: repoUrl,
            localPath: repoPath,
            source: "local",
            defaultBranch,
            ingestionStatus: "parsing",
            ingestionProgress: 5,
            ingestionPhase: "Parsing git log...",
        },
        { upsert: true, new: true }
    );

    const repoId = repository._id;

    try {
        // Phase 2: Parse Git Log
        emit("parsing", 10, "Reading commit history...");

        const log: LogResult<DefaultLogFields> = await git.log({
            "--all": null,
            "--stat": null,
            "--numstat": null,
            maxCount: 50000,
        });

        const totalCommits = log.all.length;
        emit("parsing", 15, `Found ${totalCommits} commits`);

        await Repository.findByIdAndUpdate(repoId, {
            ingestionProgress: 15,
            ingestionPhase: `Found ${totalCommits} commits`,
        });

        // Phase 3: Build Developer Identities
        emit("analyzing", 20, "Identifying developers...");

        const rawCommits = log.all.map((c) => ({
            authorName: c.author_name,
            authorEmail: c.author_email,
        }));

        const identities = buildDeveloperIdentities(rawCommits);
        const emailToDeveloperId = new Map<string, Types.ObjectId>();

        // Create developer records
        let devIndex = 0;
        for (const [, identity] of identities) {
            const developer = await Developer.findOneAndUpdate(
                { repositoryId: repoId, primaryEmail: identity.primaryEmail },
                {
                    name: identity.name,
                    emails: Array.from(identity.emails),
                    primaryEmail: identity.primaryEmail,
                },
                { upsert: true, new: true }
            );

            for (const email of identity.emails) {
                emailToDeveloperId.set(email.toLowerCase(), developer._id);
                emailToDeveloperId.set(normalizeEmail(email), developer._id);
            }

            devIndex++;
            const progress = 20 + (devIndex / identities.size) * 10;
            emit("analyzing", progress, `Developer ${devIndex}/${identities.size}: ${identity.name}`);
        }

        await Repository.findByIdAndUpdate(repoId, {
            totalDevelopers: identities.size,
            ingestionProgress: 30,
            ingestionPhase: `Identified ${identities.size} developers`,
            ingestionStatus: "analyzing",
        });

        // Phase 4: Process Commits
        emit("analyzing", 30, "Processing commits...");

        const fileModifications = new Map<string, {
            totalMods: number;
            totalLines: number;
            authors: Set<string>;
            originalAuthor: string | null;
            lastModifier: string | null;
            isDeleted: boolean;
        }>();

        for (let i = 0; i < log.all.length; i++) {
            const logEntry = log.all[i];
            const authorEmail = logEntry.author_email.toLowerCase();
            const developerId = emailToDeveloperId.get(authorEmail) ||
                emailToDeveloperId.get(normalizeEmail(logEntry.author_email));

            if (!developerId) continue;

            // Parse diff stat for file details
            const files: ICommitFile[] = [];
            let totalAdded = 0;
            let totalDeleted = 0;

            // Parse the diff section
            const diffLines = logEntry.diff?.files || [];

            for (const diffFile of diffLines) {
                const df = diffFile as unknown as Record<string, unknown>;
                const filePath = String(df.file || "");
                const linesAdded = Number(df.insertions) || 0;
                const linesDeleted = Number(df.deletions) || 0;

                let status: ICommitFile["status"] = "modified";
                if (df.binary) {
                    status = "modified";
                }

                files.push({
                    path: filePath,
                    linesAdded,
                    linesDeleted,
                    status,
                });

                totalAdded += linesAdded;
                totalDeleted += linesDeleted;

                // Track file modifications
                const existing = fileModifications.get(filePath);
                if (existing) {
                    existing.totalMods++;
                    existing.totalLines += linesAdded;
                    existing.authors.add(developerId.toString());
                    existing.lastModifier = developerId.toString();
                } else {
                    fileModifications.set(filePath, {
                        totalMods: 1,
                        totalLines: linesAdded,
                        authors: new Set([developerId.toString()]),
                        originalAuthor: developerId.toString(),
                        lastModifier: developerId.toString(),
                        isDeleted: false,
                    });
                }
            }

            // Extract co-authors
            const coAuthors = extractCoAuthors(logEntry.body || "");
            const isMergeCommit = logEntry.message.startsWith("Merge ");

            // Create commit record
            await Commit.findOneAndUpdate(
                { repositoryId: repoId, hash: logEntry.hash },
                {
                    developerId,
                    authorName: logEntry.author_name,
                    authorEmail: logEntry.author_email,
                    message: logEntry.message,
                    timestamp: new Date(logEntry.date),
                    files,
                    totalLinesAdded: totalAdded,
                    totalLinesDeleted: totalDeleted,
                    totalFilesChanged: files.length,
                    coAuthors,
                    isMergeCommit,
                },
                { upsert: true, new: true }
            );

            // Progress
            if (i % 100 === 0 || i === log.all.length - 1) {
                const progress = 30 + ((i + 1) / log.all.length) * 40;
                emit("analyzing", progress, `Commit ${i + 1}/${log.all.length}`);
                await Repository.findByIdAndUpdate(repoId, {
                    ingestionProgress: Math.round(progress),
                    ingestionPhase: `Processing commit ${i + 1}/${log.all.length}`,
                });
            }
        }

        // Phase 5: Create FileNode records
        emit("computing", 70, "Building file tree...");

        let fileIndex = 0;
        const totalFiles = fileModifications.size;

        for (const [filePath, data] of fileModifications) {
            const parts = filePath.split("/");
            const fileName = parts[parts.length - 1] || filePath;
            const extensionParts = fileName.split(".");
            const extension = extensionParts.length > 1 ? extensionParts[extensionParts.length - 1] : "";

            const ownerIds = Array.from(data.authors).map((id) => new Types.ObjectId(id));

            await FileNode.findOneAndUpdate(
                { repositoryId: repoId, path: filePath },
                {
                    fileName,
                    extension,
                    fileType: classifyFileType(filePath),
                    currentOwnerIds: ownerIds,
                    originalAuthorId: data.originalAuthor ? new Types.ObjectId(data.originalAuthor) : undefined,
                    lastModifierId: data.lastModifier ? new Types.ObjectId(data.lastModifier) : undefined,
                    totalModifications: data.totalMods,
                    totalLinesOfCode: data.totalLines,
                    isDeleted: data.isDeleted,
                    lastModifiedAt: new Date(),
                },
                { upsert: true, new: true }
            );

            fileIndex++;
            if (fileIndex % 50 === 0) {
                const progress = 70 + (fileIndex / totalFiles) * 15;
                emit("computing", progress, `File ${fileIndex}/${totalFiles}`);
            }
        }

        // Update repository dates
        const firstCommit = await Commit.findOne({ repositoryId: repoId }).sort({ timestamp: 1 });
        const lastCommit = await Commit.findOne({ repositoryId: repoId }).sort({ timestamp: -1 });

        await Repository.findByIdAndUpdate(repoId, {
            totalCommits: log.all.length,
            totalFiles: fileModifications.size,
            firstCommitDate: firstCommit?.timestamp,
            lastCommitDate: lastCommit?.timestamp,
            ingestionProgress: 85,
            ingestionPhase: "Building file tree complete",
            ingestionStatus: "computing",
        });

        emit("computing", 85, "Ingestion core complete");

        return repoId.toString();
    } catch (error) {
        await Repository.findByIdAndUpdate(repoId, {
            ingestionStatus: "failed",
            ingestionPhase: `Error: ${(error as Error).message}`,
        });
        throw error;
    }
}

export { normalizeEmail, buildDeveloperIdentities, extractCoAuthors, classifyFileType };
