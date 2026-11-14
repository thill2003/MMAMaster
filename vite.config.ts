import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  base: "./",
  plugins: [react(), tsconfigPaths()],
  // Everything in v0 is drawn procedurally. When real atlases land in assets/ (plan §8), point publicDir at it.
  publicDir: false,
  build: {
    target: "es2021",
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: { manualChunks: { phaser: ["phaser"] } },
    },
  },
  server: { host: true, port: 5173 },
});
