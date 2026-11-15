import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app";
import { applyHudColors, applyType } from "@/ui";

import "@/ui/styles.css";

applyType(document.documentElement);
applyHudColors(document.documentElement);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
