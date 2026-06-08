import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useKeyboard } from "@opentui/react";
import { Header } from "../components/header";
import { InputBar } from "../components/input-bar";
import { useAuth } from "../providers/auth";
import { useTheme } from "../providers/theme";
import { type AppMode, ModeContext } from "../providers/mode";
import { useKeyboardLayer } from "../providers/keyboard-layer";

export function Home() {
  const navigate = useNavigate();
  const { isSetup } = useAuth();
  const { colors } = useTheme();
  const { isTopLayer } = useKeyboardLayer();
  const [mode, setMode] = useState<AppMode>("BUILD");

  const toggleMode = useCallback(() => {
    setMode(prev => prev === "BUILD" ? "PLAN" : "BUILD");
  }, []);

  useKeyboard((key) => {
    if (!isTopLayer("base")) return;
    if (key.name === "tab" || (key.name === "m" && key.ctrl)) {
      key.preventDefault?.();
      toggleMode();
    }
  });

  const modeContextValue = useMemo(() => ({ mode, toggleMode }), [mode, toggleMode]);

  const handleSubmit = useCallback(
    (text: string) => {
      navigate("/new", { state: { message: text, mode } });
    },
    [navigate, mode],
  );

  return (
    <ModeContext.Provider value={modeContextValue}>
      <box
        alignItems="center"
        justifyContent="center"
        flexGrow={1}
        gap={2}
        position="relative"
        width="100%"
        height="100%"
      >
        <Header />
        {!isSetup && (
          <text fg={colors.dim}>
            No provider configured - type /login to get started
          </text>
        )}
        <box width="100%" maxWidth={78} paddingX={2}>
          <InputBar onSubmit={handleSubmit} />
        </box>
      </box>
    </ModeContext.Provider>
  );
}
