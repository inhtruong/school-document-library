/** Cosmetic accent colours only — subjects themselves come from the API, not this file. */
const SUBJECT_ACCENTS = [
  "#2647cc",
  "#0f7b6c",
  "#b45309",
  "#6d28d9",
  "#be123c",
  "#0369a1",
];

export function subjectAccent(subject: string): string {
  let hash = 0;
  for (let i = 0; i < subject.length; i += 1) {
    hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  }
  return SUBJECT_ACCENTS[hash % SUBJECT_ACCENTS.length];
}
