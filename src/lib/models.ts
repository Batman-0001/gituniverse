import mongoose, { Schema, Document, Types } from "mongoose";

// ─── Repository (Universe) ───────────────────────────────────────────────────

export interface IRepository extends Document {
    _id: Types.ObjectId;
    name: string;
    fullName: string;
    url: string;
    localPath?: string;
    source: "github" | "local";
    description?: string;
    defaultBranch: string;
    ingestionStatus: "pending" | "parsing" | "analyzing" | "computing" | "complete" | "failed";
    ingestionProgress: number;
    ingestionPhase?: string;
    totalCommits: number;
    totalDevelopers: number;
    totalFiles: number;
    firstCommitDate?: Date;
    lastCommitDate?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const RepositorySchema = new Schema<IRepository>(
    {
        name: { type: String, required: true },
        fullName: { type: String, required: true, unique: true },
        url: { type: String, default: "" },
        localPath: { type: String },
        source: { type: String, enum: ["github", "local"], required: true },
        description: { type: String },
        defaultBranch: { type: String, default: "main" },
        ingestionStatus: {
            type: String,
            enum: ["pending", "parsing", "analyzing", "computing", "complete", "failed"],
            default: "pending",
        },
        ingestionProgress: { type: Number, default: 0 },
        ingestionPhase: { type: String },
        totalCommits: { type: Number, default: 0 },
        totalDevelopers: { type: Number, default: 0 },
        totalFiles: { type: Number, default: 0 },
        firstCommitDate: { type: Date },
        lastCommitDate: { type: Date },
    },
    { timestamps: true }
);

// ─── Developer (Star/Sun) ────────────────────────────────────────────────────

export interface IDeveloper extends Document {
    _id: Types.ObjectId;
    repositoryId: Types.ObjectId;
    name: string;
    emails: string[];
    primaryEmail: string;
    avatarUrl?: string;
    githubUsername?: string;
    stellarMass: number;
    normalizedMass: number;
    totalCommits: number;
    totalLinesAuthored: number;
    totalFilesOwned: number;
    longevityDays: number;
    collaborationEdgeCount: number;
    firstCommitDate: Date;
    lastCommitDate: Date;
    isActive: boolean;
    stellarType: "blue_giant" | "yellow_sun" | "orange_dwarf" | "red_giant" | "white_dwarf";
    galaxyIds: Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}

const DeveloperSchema = new Schema<IDeveloper>(
    {
        repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true, index: true },
        name: { type: String, required: true },
        emails: [{ type: String }],
        primaryEmail: { type: String, required: true },
        avatarUrl: { type: String },
        githubUsername: { type: String },
        stellarMass: { type: Number, default: 0 },
        normalizedMass: { type: Number, default: 0 },
        totalCommits: { type: Number, default: 0 },
        totalLinesAuthored: { type: Number, default: 0 },
        totalFilesOwned: { type: Number, default: 0 },
        longevityDays: { type: Number, default: 0 },
        collaborationEdgeCount: { type: Number, default: 0 },
        firstCommitDate: { type: Date },
        lastCommitDate: { type: Date },
        isActive: { type: Boolean, default: true },
        stellarType: {
            type: String,
            enum: ["blue_giant", "yellow_sun", "orange_dwarf", "red_giant", "white_dwarf"],
            default: "yellow_sun",
        },
        galaxyIds: [{ type: Schema.Types.ObjectId, ref: "Galaxy" }],
    },
    { timestamps: true }
);

DeveloperSchema.index({ repositoryId: 1, primaryEmail: 1 }, { unique: true });

// ─── Commit ──────────────────────────────────────────────────────────────────

export interface ICommitFile {
    path: string;
    linesAdded: number;
    linesDeleted: number;
    status: "added" | "modified" | "deleted" | "renamed";
    previousPath?: string;
}

export interface ICommit extends Document {
    _id: Types.ObjectId;
    repositoryId: Types.ObjectId;
    developerId: Types.ObjectId;
    hash: string;
    message: string;
    authorName: string;
    authorEmail: string;
    timestamp: Date;
    files: ICommitFile[];
    totalLinesAdded: number;
    totalLinesDeleted: number;
    totalFilesChanged: number;
    coAuthors: string[];
    isMergeCommit: boolean;
}

const CommitFileSchema = new Schema<ICommitFile>(
    {
        path: { type: String, required: true },
        linesAdded: { type: Number, default: 0 },
        linesDeleted: { type: Number, default: 0 },
        status: { type: String, enum: ["added", "modified", "deleted", "renamed"], default: "modified" },
        previousPath: { type: String },
    },
    { _id: false }
);

const CommitSchema = new Schema<ICommit>(
    {
        repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true, index: true },
        developerId: { type: Schema.Types.ObjectId, ref: "Developer", required: true, index: true },
        hash: { type: String, required: true },
        message: { type: String, default: "" },
        authorName: { type: String, required: true },
        authorEmail: { type: String, required: true },
        timestamp: { type: Date, required: true, index: true },
        files: [CommitFileSchema],
        totalLinesAdded: { type: Number, default: 0 },
        totalLinesDeleted: { type: Number, default: 0 },
        totalFilesChanged: { type: Number, default: 0 },
        coAuthors: [{ type: String }],
        isMergeCommit: { type: Boolean, default: false },
    },
    { timestamps: true }
);

CommitSchema.index({ repositoryId: 1, hash: 1 }, { unique: true });

// ─── FileNode (Planet) ──────────────────────────────────────────────────────

export interface IFileNode extends Document {
    _id: Types.ObjectId;
    repositoryId: Types.ObjectId;
    path: string;
    fileName: string;
    extension: string;
    fileType: "javascript" | "typescript" | "config" | "test" | "docs" | "style" | "data" | "other";
    currentOwnerIds: Types.ObjectId[];
    originalAuthorId?: Types.ObjectId;
    lastModifierId?: Types.ObjectId;
    totalModifications: number;
    totalLinesOfCode: number;
    galaxyId?: Types.ObjectId;
    isDeleted: boolean;
    createdAt: Date;
    lastModifiedAt: Date;
}

const FileNodeSchema = new Schema<IFileNode>(
    {
        repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true, index: true },
        path: { type: String, required: true },
        fileName: { type: String, required: true },
        extension: { type: String, default: "" },
        fileType: {
            type: String,
            enum: ["javascript", "typescript", "config", "test", "docs", "style", "data", "other"],
            default: "other",
        },
        currentOwnerIds: [{ type: Schema.Types.ObjectId, ref: "Developer" }],
        originalAuthorId: { type: Schema.Types.ObjectId, ref: "Developer" },
        lastModifierId: { type: Schema.Types.ObjectId, ref: "Developer" },
        totalModifications: { type: Number, default: 0 },
        totalLinesOfCode: { type: Number, default: 0 },
        galaxyId: { type: Schema.Types.ObjectId, ref: "Galaxy" },
        isDeleted: { type: Boolean, default: false },
        lastModifiedAt: { type: Date },
    },
    { timestamps: true }
);

FileNodeSchema.index({ repositoryId: 1, path: 1 }, { unique: true });

// ─── CollaborationEdge (Orbital Intersection) ──────────────────────────────

export interface ICollaborationEdge extends Document {
    _id: Types.ObjectId;
    repositoryId: Types.ObjectId;
    developerAId: Types.ObjectId;
    developerBId: Types.ObjectId;
    edgeType: "CO_AUTHOR" | "CO_MODIFIER" | "PR_REVIEWER" | "ISSUE_ASSIGNEE";
    weight: number;
    rawWeight: number;
    multiplier: number;
    sharedFiles: string[];
    sharedCommitCount: number;
    isBinaryStar: boolean;
    firstInteraction: Date;
    lastInteraction: Date;
    decayFactor: number;
}

const CollaborationEdgeSchema = new Schema<ICollaborationEdge>(
    {
        repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true, index: true },
        developerAId: { type: Schema.Types.ObjectId, ref: "Developer", required: true, index: true },
        developerBId: { type: Schema.Types.ObjectId, ref: "Developer", required: true, index: true },
        edgeType: {
            type: String,
            enum: ["CO_AUTHOR", "CO_MODIFIER", "PR_REVIEWER", "ISSUE_ASSIGNEE"],
            required: true,
        },
        weight: { type: Number, default: 0 },
        rawWeight: { type: Number, default: 0 },
        multiplier: { type: Number, default: 1.0 },
        sharedFiles: [{ type: String }],
        sharedCommitCount: { type: Number, default: 0 },
        isBinaryStar: { type: Boolean, default: false },
        firstInteraction: { type: Date },
        lastInteraction: { type: Date },
        decayFactor: { type: Number, default: 1.0 },
    },
    { timestamps: true }
);

CollaborationEdgeSchema.index(
    { repositoryId: 1, developerAId: 1, developerBId: 1, edgeType: 1 },
    { unique: true }
);

// ─── Galaxy (Service / Module) ──────────────────────────────────────────────

export interface IGalaxy extends Document {
    _id: Types.ObjectId;
    repositoryId: Types.ObjectId;
    name: string;
    detectionMethod: "explicit" | "structural" | "inferred" | "manual";
    filePaths: string[];
    developerIds: Types.ObjectId[];
    colorHue: number;
    totalFiles: number;
    totalDevelopers: number;
    centroidX: number;
    centroidY: number;
    centroidZ: number;
    driftVelocity: number;
    previousCentroidX: number;
    previousCentroidY: number;
    previousCentroidZ: number;
}

const GalaxySchema = new Schema<IGalaxy>(
    {
        repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true, index: true },
        name: { type: String, required: true },
        detectionMethod: {
            type: String,
            enum: ["explicit", "structural", "inferred", "manual"],
            required: true,
        },
        filePaths: [{ type: String }],
        developerIds: [{ type: Schema.Types.ObjectId, ref: "Developer" }],
        colorHue: { type: Number, default: 0 },
        totalFiles: { type: Number, default: 0 },
        totalDevelopers: { type: Number, default: 0 },
        centroidX: { type: Number, default: 0 },
        centroidY: { type: Number, default: 0 },
        centroidZ: { type: Number, default: 0 },
        driftVelocity: { type: Number, default: 0 },
        previousCentroidX: { type: Number, default: 0 },
        previousCentroidY: { type: Number, default: 0 },
        previousCentroidZ: { type: Number, default: 0 },
    },
    { timestamps: true }
);

GalaxySchema.index({ repositoryId: 1, name: 1 }, { unique: true });

// ─── MassSnapshot (Stellar Mass Over Time) ──────────────────────────────────

export interface IMassSnapshot extends Document {
    _id: Types.ObjectId;
    repositoryId: Types.ObjectId;
    developerId: Types.ObjectId;
    epoch: Date;
    stellarMass: number;
    normalizedMass: number;
    commits: number;
    linesAuthored: number;
    longevityDays: number;
    filesOwned: number;
    collaborationEdges: number;
}

const MassSnapshotSchema = new Schema<IMassSnapshot>(
    {
        repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true, index: true },
        developerId: { type: Schema.Types.ObjectId, ref: "Developer", required: true, index: true },
        epoch: { type: Date, required: true },
        stellarMass: { type: Number, default: 0 },
        normalizedMass: { type: Number, default: 0 },
        commits: { type: Number, default: 0 },
        linesAuthored: { type: Number, default: 0 },
        longevityDays: { type: Number, default: 0 },
        filesOwned: { type: Number, default: 0 },
        collaborationEdges: { type: Number, default: 0 },
    },
    { timestamps: true }
);

MassSnapshotSchema.index({ repositoryId: 1, developerId: 1, epoch: 1 }, { unique: true });

// ─── TemporalEvent (Digital Archaeology) ─────────────────────────────────────

export type TemporalEventType =
    | "STAR_BIRTH"
    | "WHITE_DWARF"
    | "SUPERNOVA"
    | "BINARY_FORMATION"
    | "GALAXY_SPLIT"
    | "GALAXY_MERGE"
    | "DEBT_CLEARANCE"
    | "BUS_FACTOR_ALERT";

export interface ITemporalEvent extends Document {
    _id: Types.ObjectId;
    repositoryId: Types.ObjectId;
    eventType: TemporalEventType;
    timestamp: Date;
    developerId?: Types.ObjectId;
    developerBId?: Types.ObjectId;
    galaxyId?: Types.ObjectId;
    targetGalaxyId?: Types.ObjectId;
    commitHash?: string;
    description: string;
    magnitude: number;
    metadata: Record<string, unknown>;
}

const TemporalEventSchema = new Schema<ITemporalEvent>(
    {
        repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true, index: true },
        eventType: {
            type: String,
            enum: [
                "STAR_BIRTH",
                "WHITE_DWARF",
                "SUPERNOVA",
                "BINARY_FORMATION",
                "GALAXY_SPLIT",
                "GALAXY_MERGE",
                "DEBT_CLEARANCE",
                "BUS_FACTOR_ALERT",
            ],
            required: true,
        },
        timestamp: { type: Date, required: true, index: true },
        developerId: { type: Schema.Types.ObjectId, ref: "Developer" },
        developerBId: { type: Schema.Types.ObjectId, ref: "Developer" },
        galaxyId: { type: Schema.Types.ObjectId, ref: "Galaxy" },
        targetGalaxyId: { type: Schema.Types.ObjectId, ref: "Galaxy" },
        commitHash: { type: String },
        description: { type: String, required: true },
        magnitude: { type: Number, default: 1.0 },
        metadata: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

TemporalEventSchema.index({ repositoryId: 1, eventType: 1 });

// ─── Model Exports ──────────────────────────────────────────────────────────

export const Repository =
    mongoose.models.Repository || mongoose.model<IRepository>("Repository", RepositorySchema);

export const Developer =
    mongoose.models.Developer || mongoose.model<IDeveloper>("Developer", DeveloperSchema);

export const Commit =
    mongoose.models.Commit || mongoose.model<ICommit>("Commit", CommitSchema);

export const FileNode =
    mongoose.models.FileNode || mongoose.model<IFileNode>("FileNode", FileNodeSchema);

export const CollaborationEdge =
    mongoose.models.CollaborationEdge ||
    mongoose.model<ICollaborationEdge>("CollaborationEdge", CollaborationEdgeSchema);

export const Galaxy =
    mongoose.models.Galaxy || mongoose.model<IGalaxy>("Galaxy", GalaxySchema);

export const MassSnapshot =
    mongoose.models.MassSnapshot ||
    mongoose.model<IMassSnapshot>("MassSnapshot", MassSnapshotSchema);

export const TemporalEvent =
    mongoose.models.TemporalEvent ||
    mongoose.model<ITemporalEvent>("TemporalEvent", TemporalEventSchema);
