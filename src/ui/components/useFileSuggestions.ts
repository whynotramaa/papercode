import { useEffect, useState } from "react";
import fg from "fast-glob";
import { DEFAULT_IGNORES } from "../../tools/glob.js";


let cached: string[] | undefined;
let loading: Promise<string[]> | undefined;

function loadFiles(cwd: string): Promise<string[]> {
  if (cached) return Promise.resolve(cached);
  loading ??= fg("**/*", {
    cwd,
    ignore: DEFAULT_IGNORES,
    onlyFiles: true,
    dot: false,
    followSymbolicLinks: false,
    suppressErrors: true,
  })
    .then((files) => {
      cached = files.sort();
      return cached;
    })
    .catch(() => []);
  return loading;
}


export function fuzzyMatch(candidate: string, query: string): boolean {
  if (!query) return true;
  const c = candidate.toLowerCase();
  const q = query.toLowerCase();
  let i = 0;
  for (const ch of c) {
    if (ch === q[i]) i++;
    if (i === q.length) return true;
  }
  return false;
}


export function rankFiles(files: string[], query: string, limit = 8): string[] {
  if (!query) return files.slice(0, limit);
  const q = query.toLowerCase();

  return files
    .filter((f) => fuzzyMatch(f, q))
    .sort((a, b) => {
      const score = (f: string) => {
        const lower = f.toLowerCase();
        const base = lower.split("/").pop() ?? lower;
        if (base.startsWith(q)) return 0;
        if (base.includes(q)) return 1;
        if (lower.includes(q)) return 2;
        return 3;
      };
      return score(a) - score(b) || a.length - b.length;
    })
    .slice(0, limit);
}

export function useFileSuggestions(cwd: string, query: string | null): string[] {
  const [files, setFiles] = useState<string[]>(cached ?? []);

  useEffect(() => {
    if (query === null || cached) return;
    let live = true;
    void loadFiles(cwd).then((f) => live && setFiles(f));
    return () => {
      live = false;
    };
  }, [cwd, query]);

  return query === null ? [] : rankFiles(files, query);
}
