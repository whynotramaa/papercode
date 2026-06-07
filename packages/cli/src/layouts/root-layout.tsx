import { Outlet } from "react-router";
import { AuthProvider } from "../providers/auth";
import { DialogProvider } from "../providers/dialog";
import { KeyboardLayerProvider } from "../providers/keyboard-layer";
import { ModelProvider } from "../providers/model";
import { ThemeProvider } from "../providers/theme";
import { ToastProvider } from "../providers/toast";
import { ThemedRoot } from "./themed-layout";

export function RootLayout() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <KeyboardLayerProvider>
          <AuthProvider>
            <ModelProvider>
              <DialogProvider>
                <ThemedRoot>
                  <Outlet />
                </ThemedRoot>
              </DialogProvider>
            </ModelProvider>
          </AuthProvider>
        </KeyboardLayerProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
