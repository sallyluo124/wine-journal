import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      "/tastings":     "http://localhost:8000",
      "/lookup":       "http://localhost:8000",
      "/detect":       "http://localhost:8000",
      "/pairings":     "http://localhost:8000",
      "/food-pairings":"http://localhost:8000",
      "/scan-label":        "http://localhost:8000",
      "/scan-menu":         "http://localhost:8000",
      "/scan-wine-menu":    "http://localhost:8000",
      "/menu-pairings":     "http://localhost:8000",
    },
  },
});
