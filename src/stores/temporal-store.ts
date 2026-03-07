/**
 * Temporal Store (Zustand)
 *
 * Manages the temporal dimension — digital archaeology engine.
 * Controls time scrubbing, playback, epoch-reactive filtering,
 * and archaeology mode for the 3D universe.
 *
 * All Three.js objects subscribe to currentEpoch to determine
 * visibility, size, color, and animation state.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

// ─── Types ───────────────────────────────────────────────────────────────────

export type PlaybackSpeed = 1 | 10 | 50 | 100;

export interface EpochCommitVolume {
  /** ISO week start date */
  weekStart: string;
  /** Number of commits that week */
  count: number;
  /** Total lines changed that week */
  linesChanged: number;
}

export interface TimelineEvent {
  id: string;
  eventType: string;
  timestamp: string;
  description: string;
  magnitude: number;
  developerId?: string;
  developerBId?: string;
  galaxyId?: string;
}

export interface MassSnapshotEntry {
  developerId: string;
  epoch: string;
  stellarMass: number;
  normalizedMass: number;
  commits: number;
  linesAuthored: number;
}

export interface TemporalStoreState {
  // ── Timeline bounds ──
  timelineStart: number; // timestamp ms
  timelineEnd: number; // timestamp ms
  isInitialized: boolean;

  // ── Playback state ──
  currentEpoch: number; // timestamp ms — the "camera" in time
  playbackSpeed: PlaybackSpeed;
  isPlaying: boolean;
  isLiveMode: boolean; // true = showing current state (no filtering)

  // ── Commit volume waveform ──
  commitVolume: EpochCommitVolume[];

  // ── Events on the timeline ──
  timelineEvents: TimelineEvent[];

  // ── Mass snapshots for sparklines ──
  massSnapshots: MassSnapshotEntry[];

  // ── Archaeology mode ──
  archaeologyMode: boolean;
  fossilThresholdDays: number; // files unchanged for this many days = "fossil"

  // ── Computed caches (updated when epoch changes) ──
  visibleDeveloperIds: Set<string>;
  visibleFileIds: Set<string>;
  activeEventIds: Set<string>;

  // ── Developer temporal data (for epoch filtering) ──
  developerFirstCommit: Map<string, number>; // devId → timestamp
  developerLastCommit: Map<string, number>;
  fileCreatedAt: Map<string, number>; // fileId → timestamp
  fileLastModified: Map<string, number>;

  // ── Actions ──
  initTimeline: (params: {
    firstCommitDate: string;
    lastCommitDate: string;
    commitVolume: EpochCommitVolume[];
    events: TimelineEvent[];
    massSnapshots: MassSnapshotEntry[];
    developerTimestamps: Array<{
      id: string;
      firstCommit: string;
      lastCommit: string;
    }>;
    fileTimestamps: Array<{
      id: string;
      createdAt: string;
      lastModified: string;
    }>;
  }) => void;

  setEpoch: (epoch: number) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  togglePlayback: () => void;
  play: () => void;
  pause: () => void;
  jumpToNextEvent: () => void;
  jumpToPreviousEvent: () => void;
  jumpToEvent: (eventId: string) => void;
  goLive: () => void;
  toggleArchaeologyMode: () => void;
  setFossilThreshold: (days: number) => void;

  // ── Getters ──
  getEpochProgress: () => number; // 0..1
  getEpochDate: () => Date;
  isDeveloperVisible: (devId: string) => boolean;
  isDeveloperWhiteDwarf: (devId: string) => boolean;
  isFileVisible: (fileId: string) => boolean;
  isFileFossil: (fileId: string) => boolean;
  getEventsAtEpoch: () => TimelineEvent[];
  getNearestEvent: (direction: "next" | "prev") => TimelineEvent | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const WHITE_DWARF_THRESHOLD_MS = 180 * 24 * 60 * 60 * 1000; // 180 days
const FOSSIL_DEFAULT_DAYS = 730; // 2 years

// ─── Store ───────────────────────────────────────────────────────────────────

export const useTemporalStore = create<TemporalStoreState>()(
  immer((set, get) => ({
    // Initial state
    timelineStart: 0,
    timelineEnd: Date.now(),
    isInitialized: false,

    currentEpoch: Date.now(),
    playbackSpeed: 1,
    isPlaying: false,
    isLiveMode: true,

    commitVolume: [],
    timelineEvents: [],
    massSnapshots: [],

    archaeologyMode: false,
    fossilThresholdDays: FOSSIL_DEFAULT_DAYS,

    visibleDeveloperIds: new Set<string>(),
    visibleFileIds: new Set<string>(),
    activeEventIds: new Set<string>(),

    developerFirstCommit: new Map<string, number>(),
    developerLastCommit: new Map<string, number>(),
    fileCreatedAt: new Map<string, number>(),
    fileLastModified: new Map<string, number>(),

    // ── Initialize ──
    initTimeline: (params) => {
      const start = new Date(params.firstCommitDate).getTime();
      const end = new Date(params.lastCommitDate).getTime();

      const devFirst = new Map<string, number>();
      const devLast = new Map<string, number>();
      for (const d of params.developerTimestamps) {
        devFirst.set(d.id, new Date(d.firstCommit).getTime());
        devLast.set(d.id, new Date(d.lastCommit).getTime());
      }

      const fileCreated = new Map<string, number>();
      const fileMod = new Map<string, number>();
      for (const f of params.fileTimestamps) {
        fileCreated.set(f.id, new Date(f.createdAt).getTime());
        fileMod.set(f.id, new Date(f.lastModified).getTime());
      }

      set((s) => {
        s.timelineStart = start;
        s.timelineEnd = end;
        s.currentEpoch = end;
        s.isLiveMode = true;
        s.isInitialized = true;
        s.commitVolume = params.commitVolume;
        s.timelineEvents = params.events;
        s.massSnapshots = params.massSnapshots;
        s.developerFirstCommit = devFirst;
        s.developerLastCommit = devLast;
        s.fileCreatedAt = fileCreated;
        s.fileLastModified = fileMod;

        // Initial visibility = all
        s.visibleDeveloperIds = new Set(devFirst.keys());
        s.visibleFileIds = new Set(fileCreated.keys());
        s.activeEventIds = new Set<string>();
      });
    },

    // ── Epoch control ──
    setEpoch: (epoch: number) => {
      const state = get();
      const clamped = Math.max(
        state.timelineStart,
        Math.min(epoch, state.timelineEnd),
      );

      // Recompute visibility
      const visDevs = new Set<string>();
      for (const [id, firstTs] of state.developerFirstCommit) {
        if (firstTs <= clamped) visDevs.add(id);
      }

      const visFiles = new Set<string>();
      for (const [id, createdTs] of state.fileCreatedAt) {
        if (createdTs <= clamped) visFiles.add(id);
      }

      // Events within 30 days of current epoch are "active"
      const eventWindow = 30 * 24 * 60 * 60 * 1000;
      const activeEvents = new Set<string>();
      for (const evt of state.timelineEvents) {
        const evtTs = new Date(evt.timestamp).getTime();
        if (Math.abs(evtTs - clamped) < eventWindow) {
          activeEvents.add(evt.id);
        }
      }

      set((s) => {
        s.currentEpoch = clamped;
        s.isLiveMode = clamped >= state.timelineEnd - 1000;
        s.visibleDeveloperIds = visDevs;
        s.visibleFileIds = visFiles;
        s.activeEventIds = activeEvents;
      });
    },

    setPlaybackSpeed: (speed) =>
      set((s) => {
        s.playbackSpeed = speed;
      }),

    togglePlayback: () => {
      const state = get();
      if (state.isPlaying) {
        set((s) => {
          s.isPlaying = false;
        });
      } else {
        // Single atomic update — reset epoch if at end, then start playing
        set((s) => {
          if (s.currentEpoch >= s.timelineEnd - 1000) {
            s.currentEpoch = s.timelineStart;
          }
          s.isPlaying = true;
          s.isLiveMode = false;
        });
      }
    },

    play: () =>
      set((s) => {
        s.isPlaying = true;
        s.isLiveMode = false;
      }),
    pause: () =>
      set((s) => {
        s.isPlaying = false;
      }),

    jumpToNextEvent: () => {
      const evt = get().getNearestEvent("next");
      if (evt) {
        const ts = new Date(evt.timestamp).getTime();
        get().setEpoch(ts);
      }
    },

    jumpToPreviousEvent: () => {
      const evt = get().getNearestEvent("prev");
      if (evt) {
        const ts = new Date(evt.timestamp).getTime();
        get().setEpoch(ts);
      }
    },

    jumpToEvent: (eventId: string) => {
      const state = get();
      const evt = state.timelineEvents.find((e) => e.id === eventId);
      if (evt) {
        const ts = new Date(evt.timestamp).getTime();
        get().setEpoch(ts);
      }
    },

    goLive: () => {
      const state = get();
      set((s) => {
        s.isPlaying = false;
        s.isLiveMode = true;
        s.currentEpoch = s.timelineEnd;
        s.visibleDeveloperIds = new Set(s.developerFirstCommit.keys());
        s.visibleFileIds = new Set(s.fileCreatedAt.keys());
        s.activeEventIds = new Set<string>();
      });
    },

    toggleArchaeologyMode: () =>
      set((s) => {
        s.archaeologyMode = !s.archaeologyMode;
      }),
    setFossilThreshold: (days) =>
      set((s) => {
        s.fossilThresholdDays = days;
      }),

    // ── Getters ──
    getEpochProgress: () => {
      const s = get();
      if (s.timelineEnd === s.timelineStart) return 1;
      return (
        (s.currentEpoch - s.timelineStart) / (s.timelineEnd - s.timelineStart)
      );
    },

    getEpochDate: () => new Date(get().currentEpoch),

    isDeveloperVisible: (devId: string) => {
      const s = get();
      if (s.isLiveMode) return true;
      return s.visibleDeveloperIds.has(devId);
    },

    isDeveloperWhiteDwarf: (devId: string) => {
      const s = get();
      if (s.isLiveMode) return false;
      const lastCommit = s.developerLastCommit.get(devId);
      if (!lastCommit) return false;
      return s.currentEpoch - lastCommit > WHITE_DWARF_THRESHOLD_MS;
    },

    isFileVisible: (fileId: string) => {
      const s = get();
      if (s.isLiveMode) return true;
      return s.visibleFileIds.has(fileId);
    },

    isFileFossil: (fileId: string) => {
      const s = get();
      const lastMod = s.fileLastModified.get(fileId);
      if (!lastMod) return false;
      const thresholdMs = s.fossilThresholdDays * 24 * 60 * 60 * 1000;
      const referenceTime = s.isLiveMode ? s.timelineEnd : s.currentEpoch;
      return referenceTime - lastMod > thresholdMs;
    },

    getEventsAtEpoch: () => {
      const s = get();
      return s.timelineEvents.filter((e) => s.activeEventIds.has(e.id));
    },

    getNearestEvent: (direction) => {
      const s = get();
      const sorted = [...s.timelineEvents]
        .map((e) => ({ ...e, ts: new Date(e.timestamp).getTime() }))
        .sort((a, b) => a.ts - b.ts);

      if (direction === "next") {
        return sorted.find((e) => e.ts > s.currentEpoch + 1000) || null;
      } else {
        const before = sorted.filter((e) => e.ts < s.currentEpoch - 1000);
        return before.length > 0 ? before[before.length - 1] : null;
      }
    },
  })),
);
