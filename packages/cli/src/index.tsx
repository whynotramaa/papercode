import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { createMemoryRouter } from "react-router";
import { RootLayout } from "./layouts/root-layout";
import { RouterProvider } from "react-router/dom";
import { Home } from "./screens/home";
import { NewSession } from "./screens/new-session";
import { Session } from "./screens/session";
import { getMachineId } from "./lib/machine-id";
import { setMachineId } from "./lib/api-client";

const router = createMemoryRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {index: true, element: <Home />},
      {path: "new", element: <NewSession />},
      {path: "sessions/new", element: <NewSession />},
      {path: "sessions/:id", element: <Session />},
    ]
  }
])

function App() {
  return <RouterProvider router={router} />
}

const machineId = await getMachineId()
setMachineId(machineId)

const renderer = await createCliRenderer({
  targetFps: 60,
  exitOnCtrlC: false,
});
createRoot(renderer).render(<App />);
