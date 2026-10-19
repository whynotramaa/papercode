

export const VERSION = "0.1.0";


const LETTERS: Record<string, readonly string[]> = {
  P: ["████ ", "█   █", "████ ", "█    ", "█    "],
  A: [" ███ ", "█   █", "█████", "█   █", "█   █"],
  E: ["█████", "█    ", "████ ", "█    ", "█████"],
  R: ["████ ", "█   █", "████ ", "█  █ ", "█   █"],
  C: [" ████", "█    ", "█    ", "█    ", " ████"],
  O: [" ███ ", "█   █", "█   █", "█   █", " ███ "],
  D: ["████ ", "█   █", "█   █", "█   █", "████ "],
};

export const WORDMARK = Array.from({ length: 5 }, (_, row) =>
  [..."PAPERCODE"].map((letter) => LETTERS[letter]![row]!).join(" "),
);

export const WORKING_VERBS = ["Thinking", "Working", "Reasoning"] as const;


export function workingVerb(seed: number): string {
  return WORKING_VERBS[Math.abs(seed) % WORKING_VERBS.length]!;
}
