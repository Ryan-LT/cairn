/** What the in-app feedback is about (labels in `t.feedback.kinds`). */
export const FEEDBACK_KINDS = ["idea", "bug", "praise", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/** Longest message accepted, in characters (also enforced by the database). */
export const FEEDBACK_MAX_LENGTH = 4000;
