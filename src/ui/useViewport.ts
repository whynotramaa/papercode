import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { measureElement, useStdout, type DOMElement } from "ink";

export type Viewport = { columns: number; rows: number };


export function useViewport(): Viewport {
  const { stdout } = useStdout();
  const [size, setSize] = useState<Viewport>({
    columns: stdout?.columns ?? 80,
    rows: stdout?.rows ?? 24,
  });

  useEffect(() => {
    if (!stdout) return;
    const onResize = () => setSize({ columns: stdout.columns ?? 80, rows: stdout.rows ?? 24 });
    stdout.on("resize", onResize);
    onResize();
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  return size;
}


export function listCapacity(rows: number, reserved: number): number {
  return Math.max(3, rows - reserved);
}

export function useElementWidth() {
  const ref = useRef<DOMElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (ref.current) setWidth(Math.floor(measureElement(ref.current).width));
  });
  return { ref, width };
}
