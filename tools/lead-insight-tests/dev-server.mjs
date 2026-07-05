/* Local dev server for the Lead Insight Generator — no dependencies.
 *
 *   node tools/lead-insight-tests/dev-server.mjs
 *
 * Serves the static site from the repo root and mounts the real serverless
 * function at /api/classify (same module Netlify runs). Reads
 * ANTHROPIC_API_KEY from the environment, or from a git-ignored .env file
 * in the repo root (line: ANTHROPIC_API_KEY=sk-ant-...).
 *
 * Then open: http://localhost:8888/resources/free-tool/lead-insight/
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import handler from "../../netlify/functions/classify.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = 8888;

// Load .env from the repo root if the env var isn't already set.
if (!process.env.ANTHROPIC_API_KEY) {
  try {
    const env = await readFile(join(ROOT, ".env"), "utf8");
    const match = env.match(/^\s*ANTHROPIC_API_KEY\s*=\s*["']?([^\s"']+)/m);
    if (match) process.env.ANTHROPIC_API_KEY = match[1];
  } catch { /* no .env — fine */ }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".pdf": "application/pdf",
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // The serverless function, invoked exactly as Netlify would.
  if (url.pathname === "/api/classify") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const request = new Request(`http://localhost:${PORT}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: chunks.length ? Buffer.concat(chunks) : undefined,
    });
    const response = await handler(request, { ip: req.socket.remoteAddress });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    return;
  }

  // Static files with directory-index resolution.
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) pathname += "index.html";
  const file = normalize(join(ROOT, pathname));
  if (!file.startsWith(normalize(ROOT))) {
    res.writeHead(403).end("forbidden");
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("not found");
  }
}).listen(PORT, () => {
  const keyState = process.env.ANTHROPIC_API_KEY ? "API key loaded" : "NO API KEY — /api/classify will return 500";
  console.log(`Lead Insight dev server → http://localhost:${PORT}/resources/free-tool/lead-insight/  (${keyState})`);
});
