import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// GitHub project Pages: https://shalom-lab.github.io/rpost/
// SPA route fallbacks: scripts/pages-routes.mjs after build
export default defineConfig({
  base: "/rpost/",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
