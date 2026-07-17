

export const VERSION = "0.1.0";


export const WORDMARK = [
  "█▀█ ▄▀█ █▀█ █▀▀ █▀█ █▀▀ █▀█ █▀▄ █▀▀",
  "█▀▀ █▀█ █▀▀ ██▄ █▀▄ █▄▄ █▄█ █▄▀ ██▄",
] as const;


export const MARK = "◆";

export const TAGLINE = "any model · your terminal";


const PET_EYES = { open: "o.o", blink: "-.-", wink: "o.-" } as const;

export type PetMood = keyof typeof PET_EYES;

export function pet(mood: PetMood = "open"): readonly [string, string] {
  return [" /\\_/\\ ", `( ${PET_EYES[mood]} )`];
}


export const PET_WIDTH = 7;


export const WORKING_VERBS = [
  "Thinking",
  "Weaving",
  "Composing",
  "Tracing",
  "Sketching",
  "Brewing",
  "Reasoning",
  "Drafting",
] as const;


export function workingVerb(seed: number): string {
  return WORKING_VERBS[Math.abs(seed) % WORKING_VERBS.length]!;
}
