/**
 * Universe Store (Zustand)
 *
 * Central state management for the 3D universe visualization.
 * Holds universe data, computed spatial layout, selection state,
 * view mode, and filter settings.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
    SpatialUniverse,
    SpatialDeveloper,
    SpatialGalaxy,
    computeSpatialLayout,
} from "@/utils/spatial-layout";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ViewLevel = "universe" | "galaxy" | "solar-system";

export interface TemporalEvent {
    id: string;
    eventType: string;
    timestamp: string;
    description: string;
    magnitude: number;
    developerId?: string;
    developerBId?: string;
    galaxyId?: string;
}

export interface UniverseStats {
    totalDevelopers: number;
    activeDevelopers: number;
    whiteDwarfs: number;
    totalEdges: number;
    binaryStars: number;
    totalGalaxies: number;
    totalEvents: number;
    totalFiles: number;
}

export interface RepositoryInfo {
    name: string;
    fullName: string;
    totalCommits: number;
    totalDevelopers: number;
    totalFiles: number;
    firstCommitDate: string;
    lastCommitDate: string;
}

interface UniverseStoreState {
    // ── Data ──
    isLoading: boolean;
    error: string | null;
    repository: RepositoryInfo | null;
    stats: UniverseStats | null;
    temporalEvents: TemporalEvent[];
    spatialData: SpatialUniverse | null;

    // ── View State ──
    viewLevel: ViewLevel;
    selectedDeveloperId: string | null;
    selectedGalaxyId: string | null;
    hoveredDeveloperId: string | null;
    showEdges: boolean;
    showPlanets: boolean;
    showNebulae: boolean;
    showLabels: boolean;

    // ── Camera Target ──
    cameraTarget: { x: number; y: number; z: number } | null;
    cameraDistance: number;

    // ── Actions ──
    loadUniverseData: (repositoryId: string) => Promise<void>;
    selectDeveloper: (id: string | null) => void;
    selectGalaxy: (id: string | null) => void;
    hoverDeveloper: (id: string | null) => void;
    setViewLevel: (level: ViewLevel) => void;
    toggleEdges: () => void;
    togglePlanets: () => void;
    toggleNebulae: () => void;
    toggleLabels: () => void;
    flyToPosition: (x: number, y: number, z: number, distance?: number) => void;
    resetView: () => void;

    // ── Getters ──
    getSelectedDeveloper: () => SpatialDeveloper | null;
    getSelectedGalaxy: () => SpatialGalaxy | null;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useUniverseStore = create<UniverseStoreState>()(
    immer((set, get) => ({
        // Initial state
        isLoading: true,
        error: null,
        repository: null,
        stats: null,
        temporalEvents: [],
        spatialData: null,

        viewLevel: "universe",
        selectedDeveloperId: null,
        selectedGalaxyId: null,
        hoveredDeveloperId: null,
        showEdges: true,
        showPlanets: true,
        showNebulae: true,
        showLabels: true,

        cameraTarget: null,
        cameraDistance: 200,

        // ── Load Data ──
        loadUniverseData: async (repositoryId: string) => {
            set((state) => {
                state.isLoading = true;
                state.error = null;
            });

            try {
                const response = await fetch(`/api/universe/${repositoryId}`);
                if (!response.ok) throw new Error("Failed to load universe data");
                const data = await response.json();

                const spatialData = computeSpatialLayout({
                    developers: data.developers,
                    galaxies: data.galaxies,
                    fileNodes: data.fileNodes,
                    collaborationEdges: data.collaborationEdges,
                });

                set((state) => {
                    state.repository = data.repository;
                    state.stats = data.stats;
                    state.temporalEvents = data.temporalEvents.map(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (e: any) => ({
                            id: e._id,
                            eventType: e.eventType,
                            timestamp: e.timestamp,
                            description: e.description,
                            magnitude: e.magnitude,
                            developerId: e.developerId,
                            developerBId: e.developerBId,
                            galaxyId: e.galaxyId,
                        })
                    );
                    state.spatialData = spatialData;
                    state.isLoading = false;
                });
            } catch (error) {
                set((state) => {
                    state.error = (error as Error).message;
                    state.isLoading = false;
                });
            }
        },

        // ── Selection ──
        selectDeveloper: (id: string | null) => {
            const state = get();
            if (id && state.spatialData) {
                const dev = state.spatialData.developers.find((d) => d.id === id);
                if (dev) {
                    set((s) => {
                        s.selectedDeveloperId = id;
                        s.selectedGalaxyId = null;
                        s.viewLevel = "solar-system";
                        s.cameraTarget = {
                            x: dev.position.x,
                            y: dev.position.y,
                            z: dev.position.z,
                        };
                        s.cameraDistance = 20;
                    });
                }
            } else {
                set((s) => {
                    s.selectedDeveloperId = null;
                    s.viewLevel = "universe";
                });
            }
        },

        selectGalaxy: (id: string | null) => {
            const state = get();
            if (id && state.spatialData) {
                const galaxy = state.spatialData.galaxies.find((g) => g.id === id);
                if (galaxy) {
                    set((s) => {
                        s.selectedGalaxyId = id;
                        s.selectedDeveloperId = null;
                        s.viewLevel = "galaxy";
                        s.cameraTarget = {
                            x: galaxy.position.x,
                            y: galaxy.position.y,
                            z: galaxy.position.z,
                        };
                        s.cameraDistance = galaxy.radius * 3;
                    });
                }
            } else {
                set((s) => {
                    s.selectedGalaxyId = null;
                    s.viewLevel = "universe";
                });
            }
        },

        hoverDeveloper: (id: string | null) => {
            set((s) => {
                s.hoveredDeveloperId = id;
            });
        },

        setViewLevel: (level: ViewLevel) => {
            set((s) => {
                s.viewLevel = level;
                if (level === "universe") {
                    s.selectedDeveloperId = null;
                    s.selectedGalaxyId = null;
                    s.cameraTarget = null;
                    s.cameraDistance = 200;
                }
            });
        },

        // ── Toggles ──
        toggleEdges: () => set((s) => { s.showEdges = !s.showEdges; }),
        togglePlanets: () => set((s) => { s.showPlanets = !s.showPlanets; }),
        toggleNebulae: () => set((s) => { s.showNebulae = !s.showNebulae; }),
        toggleLabels: () => set((s) => { s.showLabels = !s.showLabels; }),

        // ── Camera ──
        flyToPosition: (x, y, z, distance = 30) => {
            set((s) => {
                s.cameraTarget = { x, y, z };
                s.cameraDistance = distance;
            });
        },

        resetView: () => {
            set((s) => {
                s.viewLevel = "universe";
                s.selectedDeveloperId = null;
                s.selectedGalaxyId = null;
                s.hoveredDeveloperId = null;
                s.cameraTarget = null;
                s.cameraDistance = 200;
            });
        },

        // ── Getters ──
        getSelectedDeveloper: () => {
            const state = get();
            if (!state.selectedDeveloperId || !state.spatialData) return null;
            return (
                state.spatialData.developers.find(
                    (d) => d.id === state.selectedDeveloperId
                ) || null
            );
        },

        getSelectedGalaxy: () => {
            const state = get();
            if (!state.selectedGalaxyId || !state.spatialData) return null;
            return (
                state.spatialData.galaxies.find(
                    (g) => g.id === state.selectedGalaxyId
                ) || null
            );
        },
    }))
);
