import { TextAttributes } from "@opentui/core";
import { useCallback } from "react";
import { useNavigate } from "react-router";
import { Header } from "../components/header";
import { InputBar } from "../components/input-bar";
import { useAuth } from "../providers/auth";

export function Home() {
  const navigate = useNavigate();
  const { isSetup } = useAuth();

  const handleSubmit = useCallback(
    (text: string) => {
      navigate("/sessions/new", {state: {message: text}})
    },
    [navigate]
  )

  return (
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
        <text attributes={TextAttributes.DIM}>
          No provider configured — type /login to get started
        </text>
      )}
      <box width="100%" maxWidth={78} paddingX={2}>
        <InputBar onSubmit={handleSubmit} />
      </box>
    </box>
  );
}
