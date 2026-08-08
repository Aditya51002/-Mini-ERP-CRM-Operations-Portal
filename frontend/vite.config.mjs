import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_API_PROXY_TARGET || env.VITE_API_URL || "http://localhost:4000";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": proxyTarget
      }
    }
  };
});
