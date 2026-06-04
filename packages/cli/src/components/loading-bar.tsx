import { useState, useEffect } from "react";
import { useTheme } from "../providers/theme";

const BG = "⠒";

type PixelGrid = number[][];

function toBraille(pixels: PixelGrid, startCol: number): string {
  const dotMap = [
    [0x01, 0x08],
    [0x02, 0x10],
    [0x04, 0x20],
    [0x40, 0x80],
  ] as const;
  let bits = 0;
  for (let row = 0; row < 4; row++) {
    for (let dc = 0; dc < 2; dc++) {
      if (pixels[row]?.[startCol + dc]) bits |= dotMap[row][dc];
    }
  }
  return String.fromCodePoint(0x2800 + bits);
}

function renderLetter(pixels: PixelGrid): string {
  let out = "";
  for (let c = 0; c < pixels[0].length; c += 2) out += toBraille(pixels, c);
  return out;
}

const FONT: Record<string, PixelGrid> = {
  L: [[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,1,1,0]],
  O: [[0,1,1,0],[1,0,0,1],[1,0,0,1],[0,1,1,0]],
  A: [[0,1,1,0],[1,0,0,1],[1,1,1,1],[1,0,0,1]],
  D: [[1,1,1,0],[1,0,0,1],[1,0,0,1],[1,1,1,0]],
  I: [[1,1,1,0],[0,1,0,0],[0,1,0,0],[1,1,1,0]],
  N: [[1,0,0,1],[1,1,0,1],[1,0,1,1],[1,0,0,1]],
  G: [[0,1,1,0],[1,0,0,0],[1,0,1,1],[0,1,1,1]],
};

const SP = "⠀";
const SEG_CHARS = [...("LOADING".split("").map(c => renderLetter(FONT[c])).join(SP))];
const SEG_LEN = SEG_CHARS.length;

type Props = { width?: number };

export function LoadingBar({ width = SEG_LEN + 12 }: Props) {
  const { colors } = useTheme();
  const [tick, setTick] = useState(0);

  const range = Math.max(1, width - SEG_LEN);
  const cycle = 2 * range;

  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % cycle), 80);
    return () => clearInterval(id);
  }, [cycle]);

  const pos = tick <= range ? tick : cycle - tick;

  const bar = Array.from({ length: width }, (_, i) => {
    const si = i - pos;
    return si >= 0 && si < SEG_LEN ? SEG_CHARS[si] : BG;
  }).join("");

  return <text fg={colors.primary}>{bar}</text>;
}
