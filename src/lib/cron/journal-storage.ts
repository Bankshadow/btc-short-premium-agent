import fs from "fs/promises";
import path from "path";
import { getActiveJournalDataDir } from "./ensure-journal-dir";

const PROBE_FILE = ".journal-write-probe";
const DEFAULT_BLOB_PREFIX = "btc-desk-journal/";

function hasBlobCredentials(): boolean {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return true;
  if (!process.env.BLOB_STORE_ID?.trim()) return false;
  // OIDC token is injected at runtime on Vercel (not always visible in env ls).
  if (process.env.VERCEL === "1" || process.env.VERCEL_ENV) return true;
  return Boolean(process.env.VERCEL_OIDC_TOKEN?.trim());
}

/** Use Vercel Blob for journal JSON when credentials are available (auto on Vercel). */
export function isBlobJournalEnabled(): boolean {
  if (process.env.JOURNAL_BLOB_ENABLED === "false") return false;
  if (process.env.JOURNAL_BLOB_ENABLED === "true") return hasBlobCredentials();
  if (process.env.VERCEL === "1" || process.env.VERCEL_ENV) {
    return hasBlobCredentials();
  }
  return hasBlobCredentials();
}

function blobPrefix(): string {
  const custom = process.env.JOURNAL_BLOB_PREFIX?.trim();
  if (custom) return custom.endsWith("/") ? custom : `${custom}/`;
  return DEFAULT_BLOB_PREFIX;
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
}

function blobPathname(relativePath: string): string {
  return `${blobPrefix()}${normalizeRelativePath(relativePath)}`;
}

function localFilePath(relativePath: string): string {
  return path.join(getActiveJournalDataDir(), normalizeRelativePath(relativePath));
}

export function getJournalStorageLabel(): string {
  if (isBlobJournalEnabled()) {
    return `blob:${blobPrefix().replace(/\/$/, "")}`;
  }
  return getActiveJournalDataDir();
}

async function blobModule() {
  return import("@vercel/blob");
}

export async function ensureJournalStorageReady(): Promise<string> {
  if (isBlobJournalEnabled()) {
    const { put, del } = await blobModule();
    const probe = blobPathname(PROBE_FILE);
    await put(probe, new Date().toISOString(), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/plain",
    });
    await del(probe).catch(() => undefined);
    return getJournalStorageLabel();
  }

  const { ensureJournalDataDir } = await import("./ensure-journal-dir");
  return ensureJournalDataDir();
}

export async function readJournalText(relativePath: string): Promise<string | null> {
  if (isBlobJournalEnabled()) {
    const { get } = await blobModule();
    const result = await get(blobPathname(relativePath), { access: "private" });
    if (!result || result.statusCode === 304) return null;
    return new Response(result.stream).text();
  }

  try {
    return await fs.readFile(localFilePath(relativePath), "utf8");
  } catch {
    return null;
  }
}

export async function writeJournalText(
  relativePath: string,
  content: string,
): Promise<void> {
  await ensureJournalStorageReady();

  if (isBlobJournalEnabled()) {
    const { put } = await blobModule();
    const isJson = relativePath.endsWith(".json");
    await put(blobPathname(relativePath), content, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: isJson ? "application/json" : "text/plain",
    });
    return;
  }

  const filePath = localFilePath(relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

export async function readJournalJson<T>(
  relativePath: string,
  fallback: T,
): Promise<T> {
  const raw = await readJournalText(relativePath);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJournalJson<T>(
  relativePath: string,
  value: T,
): Promise<void> {
  await writeJournalText(relativePath, JSON.stringify(value, null, 2));
}
