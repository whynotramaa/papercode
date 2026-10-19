import React, { useLayoutEffect, useRef, useState } from "react";
import { Box, Text, measureElement, useInput, type DOMElement } from "ink";
import { useTheme } from "../themes/context.js";

export function ScrollArea({ children, active = true, follow = true }: { children: React.ReactNode; active?: boolean; follow?: boolean }) {
  const theme = useTheme();
  const viewport = useRef<DOMElement>(null);
  const content = useRef<DOMElement>(null);
  const [size, setSize] = useState({ height: 0, content: 0 });
  const [top, setTop] = useState<number | null>(follow ? null : 0);
  const max = Math.max(0, size.content - size.height);
  const offset = Math.min(top ?? max, max);

  useLayoutEffect(() => {
    if (!viewport.current || !content.current) return;
    const height = measureElement(viewport.current).height;
    const full = measureElement(content.current).height;
    setSize((previous) => previous.height === height && previous.content === full ? previous : { height, content: full });
  });

  useInput((_input, key) => {
    const page = Math.max(1, size.height - 2);
    if (key.pageUp) setTop(Math.max(0, offset - page));
    if (key.pageDown) setTop(offset + page >= max ? null : offset + page);
  }, { isActive: active });

  return (
    <Box flexGrow={1} flexDirection="column" minHeight={0}>
      {top !== null && max > 0 && <Text color={theme.accent}>Scrollback · PgDn to return to latest</Text>}
      <Box ref={viewport} flexGrow={1} flexDirection="column" minHeight={0} overflow="hidden">
        <Box ref={content} flexShrink={0} flexDirection="column" marginTop={-offset}>{children}</Box>
      </Box>
    </Box>
  );
}
