import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the build works under GitHub Pages' /AusEdit/ path.
  base: "./",
  // libraw-wasm loads its worker and .wasm relative to its own files, which
  // dev-mode pre-bundling would break.
  optimizeDeps: { exclude: ["libraw-wasm"] },
});
