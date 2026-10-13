"use client";

import { useSyncExternalStore } from "react";

/**
 * What the help layer is doing: nothing, "explain this screen" (every
 * explainable block gets a marker; pick one to read about it), or a guided
 * tour through the page's blocks.
 */
export type ExplainState =
  | { mode: "off" }
  | { mode: "explain"; selected: string | null }
  | { mode: "tour"; steps: string[]; index: number; route: string };

let state: ExplainState = { mode: "off" };
const listeners = new Set<() => void>();

function set(next: ExplainState) {
  state = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const OFF: ExplainState = { mode: "off" };

export function useExplainState(): ExplainState {
  return useSyncExternalStore(subscribe, () => state, () => OFF);
}

export const explain = {
  get: () => state,
  stop: () => set(OFF),
  toggleExplain: () => set(state.mode === "explain" ? OFF : { mode: "explain", selected: null }),
  startExplain: () => set({ mode: "explain", selected: null }),
  select: (topic: string | null) => state.mode === "explain" && set({ ...state, selected: topic }),
  /** `steps`: an intro (`"@page"`) and/or topic ids, in order. */
  startTour: (steps: string[], route: string) => (steps.length ? set({ mode: "tour", steps, index: 0, route }) : set(OFF)),
  go: (index: number) => {
    if (state.mode !== "tour") return;
    if (index < 0) return;
    if (index >= state.steps.length) set(OFF);
    else set({ ...state, index });
  },
};

const SEEN_KEY = "wealthtracker:help-seen";

/** Whether this device has opened help before (the help button glows until then). */
export function helpSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markHelpSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Storage blocked: the glow just shows again next time.
  }
}
