"use client";

import { useCallback, useSyncExternalStore } from "react";

import { PRIVACY_CLASS as CLASS, PRIVACY_STORAGE_KEY } from "./privacy-boot";

const EVENT = "cairn:privacy";

function read(): boolean {
  try {
    return window.localStorage.getItem(PRIVACY_STORAGE_KEY) === "1";
  } catch {
    return document.documentElement.classList.contains(CLASS);
  }
}

export function setPrivacyMode(on: boolean): void {
  document.documentElement.classList.toggle(CLASS, on);
  try {
    if (on) window.localStorage.setItem(PRIVACY_STORAGE_KEY, "1");
    else window.localStorage.removeItem(PRIVACY_STORAGE_KEY);
  } catch {
    // Storage blocked: the class still applies for this page.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== PRIVACY_STORAGE_KEY) return;
    document.documentElement.classList.toggle(CLASS, e.newValue === "1");
    onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** `[hidden, toggle]`: whether amounts are blurred on this device. */
export function usePrivacyMode(): readonly [boolean, () => void] {
  const on = useSyncExternalStore(subscribe, read, () => false);
  const toggle = useCallback(() => setPrivacyMode(!read()), []);
  return [on, toggle] as const;
}
