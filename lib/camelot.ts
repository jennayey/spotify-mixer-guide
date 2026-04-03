export type CamelotLetter = "A" | "B";

/**
 * Convert musical key + mode integers to Camelot notation.
 *
 * key: 0-11 where 0=C, 1=C#/Db, ... 11=B
 * mode: 0=minor, 1=major
 */
export function keyModeToCamelot(key: number, mode: 0 | 1): string {
  const majorByPitchClass = [
    "8B", // C
    "3B", // C#/Db
    "10B", // D
    "5B", // Eb
    "12B", // E
    "7B", // F
    "2B", // F#/Gb
    "9B", // G
    "4B", // Ab
    "11B", // A
    "6B", // Bb
    "1B", // B
  ];

  const minorByPitchClass = [
    "5A", // C
    "12A", // C#/Db
    "7A", // D
    "2A", // Eb
    "9A", // E
    "4A", // F
    "11A", // F#/Gb
    "6A", // G
    "1A", // Ab
    "8A", // A
    "3A", // Bb
    "10A", // B
  ];

  if (!Number.isInteger(key) || key < 0 || key > 11) return "—";
  if (mode !== 0 && mode !== 1) return "—";

  return mode === 1 ? majorByPitchClass[key] : minorByPitchClass[key];
}

// Alias to match the naming used by the UI requirement.
export const getCamelotKey = keyModeToCamelot;

export function camelotKeyToSortIndex(camelotKey: string): number {
  const match = camelotKey.match(/^(\d{1,2})([AB])$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const num = Number(match[1]);
  const letter = match[2] as CamelotLetter;
  return num * 2 + (letter === "A" ? 0 : 1);
}

