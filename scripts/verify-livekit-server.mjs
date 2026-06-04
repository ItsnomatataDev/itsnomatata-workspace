#!/usr/bin/env node
/**
 * Checks meet.itsnomatata.com reachability (DNS, TLS, HTTPS, WebSocket upgrade).
 * Usage: node scripts/verify-livekit-server.mjs [host]
 */

const host = (process.argv[2] || "meet.itsnomatata.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
const httpsUrl = `https://${host}/`;
const wssUrl = `wss://${host}`;

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`OK: ${message}`);
}

async function main() {
  console.log(`Checking LiveKit host ${host}...\n`);

  try {
    const dns = await import("node:dns/promises");
    const addresses = await dns.resolve4(host).catch(() => []);
    if (addresses.length === 0) {
      fail(`No A record for ${host}`);
    } else {
      ok(`DNS A → ${addresses.join(", ")}`);
    }
  } catch (error) {
    fail(`DNS lookup failed: ${error instanceof Error ? error.message : error}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(httpsUrl, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "*/*" },
    });
    ok(`HTTPS ${response.status} from ${httpsUrl}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(
      `HTTPS unreachable (${message}). On the VPS: start LiveKit + nginx, open 443/tcp, ensure DNS points to this server.`,
    );
  } finally {
    clearTimeout(timeout);
  }

  const wsController = new AbortController();
  const wsTimeout = setTimeout(() => wsController.abort(), 12_000);

  try {
    const wsResponse = await fetch(httpsUrl, {
      method: "GET",
      signal: wsController.signal,
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
      },
    });
    const upgrade = wsResponse.headers.get("upgrade");
    if (upgrade?.toLowerCase() === "websocket") {
      ok(`WebSocket upgrade supported at ${wssUrl}`);
    } else {
      fail(
        `HTTPS works but WebSocket upgrade header missing. Fix nginx proxy_set_header Upgrade/Connection for ${host}.`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`WebSocket probe failed: ${message}`);
  } finally {
    clearTimeout(wsTimeout);
  }

  console.log("\nNext: Supabase secrets LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET must match livekit.yaml.");
  console.log("Then: npm run deploy:livekit-functions");
}

await main();
