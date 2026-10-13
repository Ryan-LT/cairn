"use client";

import { helpPageOf, isHelpTopic } from "@/shared/config/help";
import { stripLocale } from "@/shared/lib/use-app-pathname";

import { findTargets } from "../lib/targets";
import { explain, markHelpSeen } from "./store";

/** Walk through this page: an intro, then every explainable block in reading order. */
export function startPageTour(): void {
  markHelpSeen();
  const route = stripLocale(window.location.pathname);
  const topics = findTargets()
    .map((x) => x.topic)
    .filter(isHelpTopic);
  explain.startTour(helpPageOf(route) ? ["@page", ...topics] : topics, route);
}

export function startExplain(): void {
  markHelpSeen();
  explain.startExplain();
}
