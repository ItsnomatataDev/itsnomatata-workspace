#!/usr/bin/env node
/**
 * Remove Content Studio media from Supabase (DB + storage) for a clean re-upload.
 *
 * Storage bucket: content-review-assets
 * Tables: content_review_assets, content_client_media
 *
 * Prerequisites (.env):
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   DEFAULT_ORGANIZATION_ID (optional filter)
 *
 * Usage:
 *   node scripts/cleanup-content-review-media.mjs --dry-run
 *   node scripts/cleanup-content-review-media.mjs --videos-only --dry-run
 *   node scripts/cleanup-content-review-media.mjs --videos-only --confirm
 *   node scripts/cleanup-content-review-media.mjs --client-id=<uuid> --confirm
 *   node scripts/cleanup-content-review-media.mjs --draft-id=<uuid> --confirm
 *   node scripts/cleanup-content-review-media.mjs --all-media --confirm
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BUCKET = "content-review-assets";

function loadEnv() {
  const env = {};
  for (const file of [".env.local", ".env"]) {
    const path = join(ROOT, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      value = value.replace(/^["']|["']$/g, "");
      env[key] = value;
    }
  }
  return env;
}

function parseArgs(argv) {
  const flags = {
    dryRun: false,
    confirm: false,
    videosOnly: false,
    allMedia: false,
    clientId: null,
    draftId: null,
    orgId: null,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--confirm") flags.confirm = true;
    else if (arg === "--videos-only") flags.videosOnly = true;
    else if (arg === "--all-media") flags.allMedia = true;
    else if (arg.startsWith("--client-id=")) flags.clientId = arg.slice("--client-id=".length);
    else if (arg.startsWith("--draft-id=")) flags.draftId = arg.slice("--draft-id=".length);
    else if (arg.startsWith("--organization-id=")) {
      flags.orgId = arg.slice("--organization-id=".length);
    }
  }
  if (!flags.videosOnly && !flags.allMedia && !flags.clientId && !flags.draftId) {
    flags.videosOnly = true;
  }
  return flags;
}

function isVideoRow(row) {
  if (row.asset_type === "video") return true;
  if (String(row.mime_type ?? "").startsWith("video/")) return true;
  if (/\.(mp4|mov|webm|m4v|mkv|avi|3gp)(\?|#|$)/i.test(String(row.file_name ?? ""))) {
    return true;
  }
  return false;
}

async function removeStoragePaths(supabase, paths) {
  const unique = [...new Set(paths.filter(Boolean))];
  const chunkSize = 100;
  let removed = 0;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { error } = await supabase.storage.from(BUCKET).remove(chunk);
    if (error) throw error;
    removed += chunk.length;
  }
  return removed;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const orgId = flags.orgId || env.DEFAULT_ORGANIZATION_ID || null;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  if (!flags.dryRun && !flags.confirm) {
    console.error(
      "Refusing to delete without --confirm. Run with --dry-run first to preview, then add --confirm.",
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let assetQuery = supabase
    .from("content_review_assets")
    .select(
      "id, draft_id, file_name, storage_path, asset_type, mime_type, compression_status, organization_id",
    );

  if (orgId) assetQuery = assetQuery.eq("organization_id", orgId);
  let skipAssets = false;
  if (flags.clientId) {
    const { data: drafts, error: draftError } = await supabase
      .from("content_review_drafts")
      .select("id")
      .eq("client_id", flags.clientId);
    if (draftError) throw draftError;
    const draftIds = (drafts ?? []).map((d) => d.id);
    if (draftIds.length === 0) {
      console.log("No drafts for client — nothing to delete in content_review_assets.");
      skipAssets = true;
    } else {
      assetQuery = assetQuery.in("draft_id", draftIds);
    }
  }
  if (flags.draftId) assetQuery = assetQuery.eq("draft_id", flags.draftId);

  let assets = [];
  if (!skipAssets) {
    const { data, error: assetError } = await assetQuery;
    if (assetError) throw assetError;
    assets = data ?? [];
  }

  const assetRows = assets.filter((row) =>
    flags.allMedia ? true : flags.videosOnly ? isVideoRow(row) : true,
  );

  let libraryQuery = supabase
    .from("content_client_media")
    .select(
      "id, client_id, file_name, storage_path, asset_type, mime_type, compression_status, organization_id",
    );
  if (orgId) libraryQuery = libraryQuery.eq("organization_id", orgId);
  if (flags.clientId) libraryQuery = libraryQuery.eq("client_id", flags.clientId);

  const { data: libraryRows, error: libraryError } = await libraryQuery;
  if (libraryError) throw libraryError;

  const libraryFiltered = (libraryRows ?? []).filter((row) =>
    flags.allMedia ? true : flags.videosOnly ? isVideoRow(row) : true,
  );

  const storagePaths = [
    ...assetRows.map((r) => r.storage_path),
    ...libraryFiltered.map((r) => r.storage_path),
  ].filter((p) => typeof p === "string" && p.trim());

  console.log("\nContent Studio media cleanup");
  console.log("  Bucket:", BUCKET);
  console.log("  Mode:", flags.dryRun ? "DRY RUN" : "DELETE");
  console.log(
    "  Scope:",
    flags.allMedia
      ? "all media"
      : flags.videosOnly
        ? "videos only"
        : "filtered",
  );
  if (orgId) console.log("  Organization:", orgId);
  if (flags.clientId) console.log("  Client:", flags.clientId);
  if (flags.draftId) console.log("  Draft:", flags.draftId);
  console.log("");
  console.log(`  content_review_assets rows: ${assetRows.length}`);
  console.log(`  content_client_media rows: ${libraryFiltered.length}`);
  console.log(`  storage paths (from DB):   ${storagePaths.length}`);
  console.log("");

  if (assetRows.length > 0) {
    console.log("Sample post assets:");
    for (const row of assetRows.slice(0, 8)) {
      console.log(
        `  - ${row.file_name} (${row.asset_type}, ${row.compression_status}) ${row.storage_path ?? "(no path)"}`,
      );
    }
    if (assetRows.length > 8) console.log(`  ... and ${assetRows.length - 8} more`);
    console.log("");
  }

  if (flags.dryRun) {
    console.log("Dry run complete. Re-run with --confirm to delete the rows and storage files above.");
    return;
  }

  const assetIds = assetRows.map((r) => r.id);
  if (assetIds.length > 0) {
    const { error } = await supabase.from("content_review_assets").delete().in("id", assetIds);
    if (error) throw error;
    console.log(`Deleted ${assetIds.length} content_review_assets row(s).`);
  }

  const libraryIds = libraryFiltered.map((r) => r.id);
  if (libraryIds.length > 0) {
    const { error } = await supabase.from("content_client_media").delete().in("id", libraryIds);
    if (error) throw error;
    console.log(`Deleted ${libraryIds.length} content_client_media row(s).`);
  }

  if (storagePaths.length > 0) {
    const removed = await removeStoragePaths(supabase, storagePaths);
    console.log(`Removed ${removed} file(s) from storage bucket ${BUCKET}.`);
  }

  console.log("\nDone. Re-upload videos from your computer (not from library) for full quality.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
