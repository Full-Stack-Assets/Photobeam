import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Capacitor copies the `dist/` output into the native iOS shell (webDir in
// capacitor.config.ts). Keep the base relative so assets resolve from file://.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
});
