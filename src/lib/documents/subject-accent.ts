/** Cosmetic accent colours only — subjects themselves come from the API, not this file. */
const SUBJECT_ACCENTS = [
  "#2647cc",
  "#0f7b6c",
  "#b45309",
  "#6d28d9",
  "#be123c",
  "#0369a1",
];

function hashSubject(subject: string): number {
  let hash = 0;
  for (let i = 0; i < subject.length; i += 1) {
    hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function subjectAccent(subject: string): string {
  return SUBJECT_ACCENTS[hashSubject(subject) % SUBJECT_ACCENTS.length];
}

/**
 * Deterministic lucide icon name for a subject (UI-2) — a small, generic
 * "academic subject" icon set, not a per-subject-name mapping table. Not
 * meant to be a perfect fit for every subject (e.g. "Sigma" for a subject
 * that isn't math is fine); the point is a consistent, recognizable visual
 * identity per subject without a hardcoded name→icon dictionary that would
 * need updating every time a new Subject is added to the taxonomy. Uses
 * the SAME hash as `subjectAccent()` (just a different modulus) so a given
 * subject always gets the same icon+color pairing, computed once here
 * rather than duplicating the hash function.
 */
const SUBJECT_ICON_NAMES = [
  "Sigma",
  "BookOpen",
  "FlaskConical",
  "Globe",
  "Landmark",
  "Palette",
  "Music",
  "Languages",
] as const;

export type SubjectIconName = (typeof SUBJECT_ICON_NAMES)[number];

export function subjectIconName(subject: string): SubjectIconName {
  return SUBJECT_ICON_NAMES[hashSubject(subject) % SUBJECT_ICON_NAMES.length];
}
