import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const webhookUrl = env.VITE_N8N_AI_WEBHOOK_URL;

  let proxy;

  if (webhookUrl) {
    try {
      const targetUrl = new URL(webhookUrl);
      proxy = {
        "/api/ai": {
          target: targetUrl.origin,
          changeOrigin: true,
          secure: true,
          rewrite: () => targetUrl.pathname,
        },
      };
    } catch {
      proxy = undefined;
    }
  }

  return {
    plugins: [tailwindcss(), react()],
    server: {
      proxy,
    },
  };
});
