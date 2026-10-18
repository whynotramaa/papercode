import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ChatMessage } from "./messages.js";

const IMAGE = /\.(png|jpe?g|gif|webp)$/i;
const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

export function withImages(text: string, cwd: string): ChatMessage["content"] {
  const images: { type: "image_url"; image_url: { url: string } }[] = [];
  for (const token of text.split(/\s+/)) {
    const raw = token.replace(/^['"]|['"]$/g, "");
    if (!IMAGE.test(raw)) continue;
    const file = path.resolve(cwd, raw.startsWith("~/") ? path.join(os.homedir(), raw.slice(2)) : raw);
    try {
      const data = fs.readFileSync(file).toString("base64");
      const ext = path.extname(file).slice(1).toLowerCase();
      images.push({ type: "image_url", image_url: { url: `data:${MIME[ext]};base64,${data}` } });
    } catch {}
  }
  return images.length ? [{ type: "text", text }, ...images] : text;
}
