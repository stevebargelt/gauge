import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getPlanUsage } from "./plan-usage.js";
import { samplePlanUsage } from "./sample-data.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(HERE, "..", "public");
const STATIC_FILES: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
};

export type AppServerOptions = {
  sample?: boolean;
};

export function createAppServer(options: AppServerOptions = {}) {
  return createServer(async (req, res) => {
    try {
      await route(req, res, options);
    } catch (error) {
      console.error(error);
      json(res, 500, { error: "The plan-limit collector failed." });
    }
  });
}

async function route(req: IncomingMessage, res: ServerResponse, options: AppServerOptions): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method !== "GET") {
    json(res, 405, { error: "Method not allowed." });
    return;
  }

  if (url.pathname === "/health") {
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/usage/limits") {
    const refresh = url.searchParams.get("refresh") === "1";
    const data = options.sample ? samplePlanUsage() : await getPlanUsage(refresh);
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(data));
    return;
  }

  const asset = STATIC_FILES[url.pathname];
  if (!asset) {
    json(res, 404, { error: "Not found." });
    return;
  }
  const content = await readFile(join(PUBLIC_DIR, asset.file));
  res.writeHead(200, {
    "Content-Type": asset.type,
    "Cache-Control": asset.file === "index.html" ? "no-store" : "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
    // The panel intentionally uses narrowly generated inline styles for its
    // numeric bar widths and fixed provider-color custom properties. Scripts
    // remain same-origin only; allowing inline styles is required for those
    // visual data encodings to render.
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'",
  });
  res.end(content);
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(value));
}

const launchedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (launchedDirectly) {
  const host = process.env.PLAN_LIMITS_HOST ?? "127.0.0.1";
  const port = Number(process.env.PLAN_LIMITS_PORT ?? "4312");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PLAN_LIMITS_PORT: ${process.env.PLAN_LIMITS_PORT}`);
  }
  const sample = process.argv.includes("--sample") || process.env.PLAN_LIMITS_SAMPLE === "1";
  const server = createAppServer({ sample });
  server.listen(port, host, () => {
    console.log(`Live usage plan limits: http://${host}:${port}${sample ? " (sample data)" : ""}`);
  });
}
