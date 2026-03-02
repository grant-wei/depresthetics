import { create } from "zustand";

export type PensieveMode = "drifting" | "focused" | "threading" | "immersed";

interface PensieveState {
  /* --- Core state --- */
  mode: PensieveMode;
  currentId: string;
  threadHistory: string[];
  holdProgress: number;
  queue: string[];
  queueIndex: number;
  showClassicGrid: boolean;

  /* --- Transitions --- */
  setQueue: (ids: string[]) => void;
  advanceQueue: () => string | null;
  focus: (id: string) => void;
  thread: (neighborId: string) => void;
  surface: () => void;
  surfaceAll: () => void;
  startImmerse: () => void;
  setHoldProgress: (progress: number) => void;
  completeImmerse: () => void;
  releaseImmerse: () => void;
  idleTimeout: () => void;
  toggleGrid: () => void;
  reset: () => void;
}

export const usePensieveStore = create<PensieveState>((set, get) => ({
  mode: "drifting",
  currentId: "",
  threadHistory: [],
  holdProgress: 0,
  queue: [],
  queueIndex: 0,
  showClassicGrid: false,

  setQueue: (ids) => set({ queue: ids, queueIndex: 0 }),

  advanceQueue: () => {
    const { queue, queueIndex } = get();
    if (queue.length === 0) return null;
    const nextIndex = (queueIndex + 1) % queue.length;
    const nextId = queue[nextIndex];
    set({ queueIndex: nextIndex, currentId: nextId });
    return nextId;
  },

  /** DRIFTING + click/hover → FOCUSED */
  focus: (id) => {
    const { mode } = get();
    if (mode === "drifting" || mode === "focused") {
      set({ mode: "focused", currentId: id, holdProgress: 0 });
    }
  },

  /** FOCUSED + click neighbor → THREADING (push to history) */
  thread: (neighborId) => {
    const { mode, currentId, threadHistory } = get();
    if (mode === "focused" || mode === "threading") {
      set({
        mode: "threading",
        threadHistory: [...threadHistory, currentId],
        currentId: neighborId,
        holdProgress: 0,
      });
    }
  },

  /** Escape → pop one level */
  surface: () => {
    const { mode, threadHistory } = get();
    if (mode === "immersed") {
      // Back to previous mode (focused or threading)
      set({
        mode: threadHistory.length > 0 ? "threading" : "focused",
        holdProgress: 0,
      });
      return;
    }
    if (mode === "threading" && threadHistory.length > 0) {
      const prev = threadHistory[threadHistory.length - 1];
      set({
        mode: threadHistory.length > 1 ? "threading" : "focused",
        currentId: prev,
        threadHistory: threadHistory.slice(0, -1),
        holdProgress: 0,
      });
      return;
    }
    // FOCUSED → DRIFTING
    set({ mode: "drifting", holdProgress: 0, threadHistory: [] });
  },

  /** Clear all thread history, return to DRIFTING */
  surfaceAll: () => {
    set({ mode: "drifting", threadHistory: [], holdProgress: 0 });
  },

  /** Begin hold/pull interaction */
  startImmerse: () => {
    const { mode } = get();
    if (mode === "focused" || mode === "threading") {
      set({ mode: "immersed", holdProgress: 0 });
    }
  },

  setHoldProgress: (progress) => set({ holdProgress: progress }),

  /** holdProgress reached 1.0 → open lightbox */
  completeImmerse: () => {
    // Caller opens lightbox; we stay in immersed until release
  },

  /** Mouse released before complete → spring back */
  releaseImmerse: () => {
    const { threadHistory } = get();
    set({
      mode: threadHistory.length > 0 ? "threading" : "focused",
      holdProgress: 0,
    });
  },

  /** 5s idle in FOCUSED → back to DRIFTING */
  idleTimeout: () => {
    const { mode } = get();
    if (mode === "focused") {
      set({ mode: "drifting", holdProgress: 0, threadHistory: [] });
    }
  },

  toggleGrid: () => set((s) => ({ showClassicGrid: !s.showClassicGrid })),

  /** Reset to initial state (called on Gallery mount) */
  reset: () => set({
    mode: "drifting",
    currentId: "",
    threadHistory: [],
    holdProgress: 0,
    queueIndex: 0,
    showClassicGrid: false,
  }),
}));
