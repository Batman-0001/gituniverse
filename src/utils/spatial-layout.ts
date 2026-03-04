/**
 * Spatial Layout Engine
 *
 * Computes 3D positions for all entities in the universe:
 * - Galaxies positioned in a golden-spiral pattern
 * - Developer suns positioned within their galaxy cluster
 * - Commit planets positioned in orbital rings around their developer sun
 * - Collaboration edges connect developer positions
 */

import * as THREE from "three";

// ─── Constants ───────────────────────────────────────────────────────────────

const GALAXY_SPREAD = 80;
const DEVELOPER_SPREAD = 15;
const PLANET_ORBIT_MIN = 3.0;
const PLANET_ORBIT_MAX = 12.0;
const UNASSIGNED_RING_RADIUS = 120;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SpatialDeveloper {
    id: string;
    name: string;
    position: THREE.Vector3;
    radius: number;
    normalizedMass: number;
    stellarType: string;
    isActive: boolean;
    totalCommits: number;
    totalLinesAuthored: number;
    totalFilesOwned: number;
    longevityDays: number;
    collaborationEdgeCount: number;
    primaryEmail: string;
    galaxyIds: string[];
}

export interface SpatialPlanet {
    id: string;
    path: string;
    fileName: string;
    fileType: string;
    position: THREE.Vector3;
    orbitRadius: number;
    orbitAngle: number;
    orbitInclination: number;
    orbitSpeed: number;
    radius: number;
    totalModifications: number;
    totalLinesOfCode: number;
    ownerId: string;
    hasRings: boolean;
}

export interface SpatialEdge {
    id: string;
    sourceId: string;
    targetId: string;
    sourcePosition: THREE.Vector3;
    targetPosition: THREE.Vector3;
    weight: number;
    edgeType: string;
    isBinaryStar: boolean;
    sharedFileCount: number;
}

export interface SpatialGalaxy {
    id: string;
    name: string;
    position: THREE.Vector3;
    colorHue: number;
    totalFiles: number;
    totalDevelopers: number;
    detectionMethod: string;
    radius: number;
}

export interface SpatialUniverse {
    developers: SpatialDeveloper[];
    planets: SpatialPlanet[];
    edges: SpatialEdge[];
    galaxies: SpatialGalaxy[];
    bounds: {
        min: THREE.Vector3;
        max: THREE.Vector3;
        center: THREE.Vector3;
        radius: number;
    };
}

// ─── Seeded Random (Deterministic Positioning) ───────────────────────────────

function seededRandom(seed: string): () => number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }

    return () => {
        hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
        hash = Math.imul(hash ^ (hash >>> 13), 0x45d9f3b);
        hash = (hash ^ (hash >>> 16)) >>> 0;
        return hash / 4294967296;
    };
}

// ─── Galaxy Positioning ──────────────────────────────────────────────────────

function positionGalaxies(
    galaxies: Array<{
        _id: string;
        name: string;
        colorHue: number;
        totalFiles: number;
        totalDevelopers: number;
        detectionMethod: string;
        centroidX: number;
        centroidY: number;
        centroidZ: number;
    }>
): SpatialGalaxy[] {
    if (galaxies.length === 0) return [];

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    return galaxies.map((galaxy, index) => {
        const radius = GALAXY_SPREAD + index * 25;
        const theta = index * goldenAngle;
        const phi = Math.acos(1 - (2 * (index + 0.5)) / Math.max(galaxies.length, 1));

        const position = new THREE.Vector3(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.sin(phi) * Math.sin(theta) * 0.3, // Flatten Y for readability
            radius * Math.cos(phi)
        );

        // Galaxy visual radius based on file count
        const visualRadius = Math.max(8, Math.sqrt(galaxy.totalFiles) * 2);

        return {
            id: galaxy._id,
            name: galaxy.name,
            position,
            colorHue: galaxy.colorHue,
            totalFiles: galaxy.totalFiles,
            totalDevelopers: galaxy.totalDevelopers,
            detectionMethod: galaxy.detectionMethod,
            radius: visualRadius,
        };
    });
}

// ─── Developer Positioning ───────────────────────────────────────────────────

function positionDevelopers(
    developers: Array<{
        _id: string;
        name: string;
        normalizedMass: number;
        stellarType: string;
        isActive: boolean;
        totalCommits: number;
        totalLinesAuthored: number;
        totalFilesOwned: number;
        longevityDays: number;
        collaborationEdgeCount: number;
        primaryEmail: string;
        galaxyIds: string[];
    }>,
    spatialGalaxies: SpatialGalaxy[]
): SpatialDeveloper[] {
    const galaxyMap = new Map(spatialGalaxies.map((g) => [g.id, g]));

    // Group developers by their primary galaxy
    const galaxyDevelopers = new Map<string, typeof developers>();
    const unassigned: typeof developers = [];

    for (const dev of developers) {
        const primaryGalaxyId = dev.galaxyIds?.[0];
        if (primaryGalaxyId && galaxyMap.has(primaryGalaxyId)) {
            if (!galaxyDevelopers.has(primaryGalaxyId)) {
                galaxyDevelopers.set(primaryGalaxyId, []);
            }
            galaxyDevelopers.get(primaryGalaxyId)!.push(dev);
        } else {
            unassigned.push(dev);
        }
    }

    const spatialDevelopers: SpatialDeveloper[] = [];

    // Position developers within their galaxy
    for (const [galaxyId, devs] of galaxyDevelopers) {
        const galaxy = galaxyMap.get(galaxyId)!;
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));

        devs.forEach((dev, index) => {
            const rng = seededRandom(dev._id);
            const spread = DEVELOPER_SPREAD + galaxy.radius * 0.5;
            const r = spread * (0.3 + 0.7 * Math.sqrt((index + 1) / devs.length));
            const theta = index * goldenAngle;
            const yOffset = (rng() - 0.5) * spread * 0.3;

            const position = new THREE.Vector3(
                galaxy.position.x + r * Math.cos(theta),
                galaxy.position.y + yOffset,
                galaxy.position.z + r * Math.sin(theta)
            );

            const radius = Math.max(0.5, Math.cbrt(dev.normalizedMass) * 0.4);

            spatialDevelopers.push({
                id: dev._id,
                name: dev.name,
                position,
                radius,
                normalizedMass: dev.normalizedMass,
                stellarType: dev.stellarType,
                isActive: dev.isActive,
                totalCommits: dev.totalCommits,
                totalLinesAuthored: dev.totalLinesAuthored,
                totalFilesOwned: dev.totalFilesOwned,
                longevityDays: dev.longevityDays,
                collaborationEdgeCount: dev.collaborationEdgeCount,
                primaryEmail: dev.primaryEmail,
                galaxyIds: dev.galaxyIds || [],
            });
        });
    }

    // Position unassigned developers in an outer ring
    unassigned.forEach((dev, index) => {
        const rng = seededRandom(dev._id);
        const angle = (index / Math.max(unassigned.length, 1)) * Math.PI * 2;
        const r = UNASSIGNED_RING_RADIUS + rng() * 20;

        const position = new THREE.Vector3(
            r * Math.cos(angle),
            (rng() - 0.5) * 10,
            r * Math.sin(angle)
        );

        const radius = Math.max(0.5, Math.cbrt(dev.normalizedMass) * 0.4);

        spatialDevelopers.push({
            id: dev._id,
            name: dev.name,
            position,
            radius,
            normalizedMass: dev.normalizedMass,
            stellarType: dev.stellarType,
            isActive: dev.isActive,
            totalCommits: dev.totalCommits,
            totalLinesAuthored: dev.totalLinesAuthored,
            totalFilesOwned: dev.totalFilesOwned,
            longevityDays: dev.longevityDays,
            collaborationEdgeCount: dev.collaborationEdgeCount,
            primaryEmail: dev.primaryEmail,
            galaxyIds: dev.galaxyIds || [],
        });
    });

    return spatialDevelopers;
}

// ─── Planet Positioning ──────────────────────────────────────────────────────

function positionPlanets(
    fileNodes: Array<{
        _id: string;
        path: string;
        fileName: string;
        fileType: string;
        currentOwnerIds: string[];
        totalModifications: number;
        totalLinesOfCode: number;
    }>,
    developerMap: Map<string, SpatialDeveloper>
): SpatialPlanet[] {
    const planets: SpatialPlanet[] = [];

    // Group files by their primary owner
    const ownerFiles = new Map<string, typeof fileNodes>();
    for (const file of fileNodes) {
        const ownerId = file.currentOwnerIds?.[0];
        if (ownerId && developerMap.has(ownerId)) {
            if (!ownerFiles.has(ownerId)) {
                ownerFiles.set(ownerId, []);
            }
            ownerFiles.get(ownerId)!.push(file);
        }
    }

    for (const [ownerId, files] of ownerFiles) {
        const owner = developerMap.get(ownerId)!;

        files.forEach((file, index) => {
            const rng = seededRandom(file.path);

            // Orbital parameters
            const orbitRadius =
                PLANET_ORBIT_MIN +
                (PLANET_ORBIT_MAX - PLANET_ORBIT_MIN) *
                (index / Math.max(files.length - 1, 1));
            const orbitAngle = rng() * Math.PI * 2;
            const orbitInclination = (rng() - 0.5) * 0.08; // ±0.04 radians — very tight, coplanar orbits
            const orbitSpeed = 0.1 + rng() * 0.3;

            // Planet size based on lines of code (capped)
            const radius = Math.max(
                0.25,
                Math.min(1.2, Math.cbrt(file.totalLinesOfCode) * 0.08)
            );

            // Position on orbit
            const x =
                owner.position.x +
                orbitRadius * Math.cos(orbitAngle) * Math.cos(orbitInclination);
            const y =
                owner.position.y +
                orbitRadius * Math.sin(orbitInclination);
            const z =
                owner.position.z +
                orbitRadius * Math.sin(orbitAngle) * Math.cos(orbitInclination);

            planets.push({
                id: file._id,
                path: file.path,
                fileName: file.fileName,
                fileType: file.fileType,
                position: new THREE.Vector3(x, y, z),
                orbitRadius,
                orbitAngle,
                orbitInclination,
                orbitSpeed,
                radius,
                totalModifications: file.totalModifications,
                totalLinesOfCode: file.totalLinesOfCode,
                ownerId,
                hasRings: file.totalModifications > 50,
            });
        });
    }

    return planets;
}

// ─── Edge Positioning ────────────────────────────────────────────────────────

function positionEdges(
    edges: Array<{
        _id: string;
        developerAId: string;
        developerBId: string;
        weight: number;
        edgeType: string;
        isBinaryStar: boolean;
        sharedFiles: string[];
    }>,
    developerMap: Map<string, SpatialDeveloper>
): SpatialEdge[] {
    return edges
        .filter(
            (edge) =>
                developerMap.has(edge.developerAId) && developerMap.has(edge.developerBId)
        )
        .map((edge) => {
            const source = developerMap.get(edge.developerAId)!;
            const target = developerMap.get(edge.developerBId)!;

            return {
                id: edge._id,
                sourceId: edge.developerAId,
                targetId: edge.developerBId,
                sourcePosition: source.position.clone(),
                targetPosition: target.position.clone(),
                weight: edge.weight,
                edgeType: edge.edgeType,
                isBinaryStar: edge.isBinaryStar,
                sharedFileCount: edge.sharedFiles?.length || 0,
            };
        });
}

// ─── Compute Bounds ──────────────────────────────────────────────────────────

function computeBounds(developers: SpatialDeveloper[], galaxies: SpatialGalaxy[]) {
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

    const allPositions = [
        ...developers.map((d) => d.position),
        ...galaxies.map((g) => g.position),
    ];

    if (allPositions.length === 0) {
        return {
            min: new THREE.Vector3(-50, -50, -50),
            max: new THREE.Vector3(50, 50, 50),
            center: new THREE.Vector3(0, 0, 0),
            radius: 100,
        };
    }

    for (const pos of allPositions) {
        min.min(pos);
        max.max(pos);
    }

    const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
    const radius = new THREE.Vector3().subVectors(max, min).length() * 0.5;

    return { min, max, center, radius: Math.max(radius, 50) };
}

// ─── Main Layout Function ────────────────────────────────────────────────────

export function computeSpatialLayout(data: {
    developers: Array<{
        _id: string;
        name: string;
        normalizedMass: number;
        stellarType: string;
        isActive: boolean;
        totalCommits: number;
        totalLinesAuthored: number;
        totalFilesOwned: number;
        longevityDays: number;
        collaborationEdgeCount: number;
        primaryEmail: string;
        galaxyIds: string[];
    }>;
    galaxies: Array<{
        _id: string;
        name: string;
        colorHue: number;
        totalFiles: number;
        totalDevelopers: number;
        detectionMethod: string;
        centroidX: number;
        centroidY: number;
        centroidZ: number;
    }>;
    fileNodes: Array<{
        _id: string;
        path: string;
        fileName: string;
        fileType: string;
        currentOwnerIds: string[];
        totalModifications: number;
        totalLinesOfCode: number;
    }>;
    collaborationEdges: Array<{
        _id: string;
        developerAId: string;
        developerBId: string;
        weight: number;
        edgeType: string;
        isBinaryStar: boolean;
        sharedFiles: string[];
    }>;
}): SpatialUniverse {
    // Step 1: Position galaxies
    const spatialGalaxies = positionGalaxies(data.galaxies);

    // Step 2: Position developers within galaxies
    const spatialDevelopers = positionDevelopers(data.developers, spatialGalaxies);

    // Step 3: Build developer lookup
    const developerMap = new Map(spatialDevelopers.map((d) => [d.id, d]));

    // Step 4: Position planets around their owner suns
    const spatialPlanets = positionPlanets(data.fileNodes, developerMap);

    // Step 5: Position collaboration edges
    const spatialEdges = positionEdges(data.collaborationEdges, developerMap);

    // Step 6: Compute bounds
    const bounds = computeBounds(spatialDevelopers, spatialGalaxies);

    return {
        developers: spatialDevelopers,
        planets: spatialPlanets,
        edges: spatialEdges,
        galaxies: spatialGalaxies,
        bounds,
    };
}
