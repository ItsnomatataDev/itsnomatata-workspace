import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function readEnvFileValue(name: string) {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = join(process.cwd(), fileName);
    if (!existsSync(filePath)) continue;

    const line = readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith(`${name}=`));

    if (!line) continue;

    return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  }

  return undefined;
}

function addWebhookProxy(
  proxy: Record<string, string | ProxyOptions>,
  route: string,
  webhookUrl?: string,
) {
  if (!webhookUrl) return;

  try {
    const targetUrl = new URL(webhookUrl);
    proxy[route] = {
      target: targetUrl.origin,
      changeOrigin: true,
      secure: true,
      rewrite: () => targetUrl.pathname,
    };
  } catch {
    // Invalid webhook URLs are handled in the app with a clearer message.
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const chatWebhookUrl = readEnvFileValue("VITE_N8N_AI_WEBHOOK_URL") ??
    env.VITE_N8N_AI_WEBHOOK_URL;
  const documentUploadWebhookUrl =
    readEnvFileValue("VITE_N8N_AI_DOCUMENT_UPLOAD_WEBHOOK_URL") ??
      env.VITE_N8N_AI_DOCUMENT_UPLOAD_WEBHOOK_URL;
  const proxy: Record<string, string | ProxyOptions> = {};

  addWebhookProxy(proxy, "/api/ai", chatWebhookUrl);
  addWebhookProxy(
    proxy,
    "/api/ai/upload-document",
    documentUploadWebhookUrl,
  );

  return {
    plugins: [tailwindcss(), react()],
    define: {
      "import.meta.env.VITE_N8N_AI_WEBHOOK_URL": JSON.stringify(
        chatWebhookUrl,
      ),
      "import.meta.env.VITE_N8N_AI_DOCUMENT_UPLOAD_WEBHOOK_URL": JSON.stringify(
        documentUploadWebhookUrl,
      ),
    },
    server: {
      proxy: Object.keys(proxy).length ? proxy : undefined,
    },
  };
});
