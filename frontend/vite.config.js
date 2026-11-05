import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env files for the current mode
  const env = loadEnv(mode, process.cwd(), "");

  // The live Render backend URL — always used in production unless overridden by env var
  const PROD_API_BASE =
    "https://ai-disaster-intelligence-emergency.onrender.com";
  const PROD_WS_URL =
    "wss://ai-disaster-intelligence-emergency.onrender.com/ws/alerts";

  const isProduction = mode === "production";

  return {
    plugins: [react()],
    define: {
      // Bake the production URLs directly into the bundle.
      // The env var check is kept so local overrides still work (e.g. via .env.local).
      "import.meta.env.VITE_API_BASE":
        JSON.stringify(
          env.VITE_API_BASE || (isProduction ? PROD_API_BASE : "")
        ),
      "import.meta.env.VITE_WS_URL":
        JSON.stringify(
          env.VITE_WS_URL || (isProduction ? PROD_WS_URL : "")
        ),
    },
  };
});
