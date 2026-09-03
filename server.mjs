import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  IP_POST_LIMIT,
  NAME_RECORD_LIMIT,
  RATE_LIMIT_WINDOW_MS,
  createFixedWindowLimiter,
  getClientIp,
  isAllowedName,
  normalizeEntries,
  normalizeName,
  normalizeNameKey,
  toRetryAfterSeconds,
  validateRecord,
} from "./src/shared/leaderboard-limits.cjs";

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.dirname(__filename);
const dataDir = path.join(rootDir, "data");
const leaderboardFile = path.join(dataDir, "leaderboard.json");

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 8080);

const MAX_BODY_BYTES = 16_000;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

let writeQueue = Promise.resolve();

const ipLimiter = createFixedWindowLimiter({
  limit: IP_POST_LIMIT,
  windowMs: RATE_LIMIT_WINDOW_MS,
});

const nameLimiter = createFixedWindowLimiter({
  limit: NAME_RECORD_LIMIT,
  windowMs: RATE_LIMIT_WINDOW_MS,
});

const queueWrite = (task) => {
  writeQueue = writeQueue.then(task, task);
  return writeQueue;
};

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
};

const sendText = (res, statusCode, message, extraHeaders = {}) => {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(message);
};

const ensureLeaderboardFile = async () => {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(leaderboardFile);
  } catch {
    await fs.writeFile(leaderboardFile, "[]\n", "utf8");
  }
};

const readLeaderboard = async () => {
  await ensureLeaderboardFile();
  try {
    const raw = await fs.readFile(leaderboardFile, "utf8");
    return normalizeEntries(JSON.parse(raw));
  } catch {
    return [];
  }
};

const writeLeaderboard = async (entries) => {
  await ensureLeaderboardFile();
  const normalized = normalizeEntries(entries);
  await fs.writeFile(leaderboardFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
};

const readRequestJson = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });

const handleLeaderboard = async (req, res) => {
  if (req.method === "GET") {
    const entries = await readLeaderboard();
    sendJson(res, 200, entries);
    return;
  }

  if (req.method === "POST") {
    const ip = getClientIp(req.headers["x-forwarded-for"], req.socket);
    const ipVerdict = ipLimiter.consume(ip);
    if (!ipVerdict.allowed) {
      sendText(res, 429, "Too many leaderboard requests", {
        "Retry-After": String(toRetryAfterSeconds(ipVerdict.retryAfterMs)),
      });
      return;
    }

    let payload;
    try {
      payload = await readRequestJson(req);
    } catch (error) {
      sendText(res, error.message === "Payload too large" ? 413 : 400, error.message);
      return;
    }

    const action = String(payload.action || "record").toLowerCase();

    if (action === "record") {
      const candidateName = normalizeName(typeof payload.name === "string" ? payload.name : "");
      const candidateScore = Number.isFinite(payload.score)
        ? Math.max(0, Math.floor(payload.score))
        : 0;
      if (isAllowedName(candidateName) && candidateScore > 0) {
        const nameVerdict = nameLimiter.consume(normalizeNameKey(candidateName));
        if (!nameVerdict.allowed) {
          sendText(res, 429, "Too many submissions for this name", {
            "Retry-After": String(toRetryAfterSeconds(nameVerdict.retryAfterMs)),
          });
          return;
        }
      }
    }

    if (action !== "record") {
      throw new Error("Unsupported leaderboard action");
    }
    const verdict = validateRecord(payload);
    if (!verdict.ok) throw new Error(verdict.error);

    const entries = await queueWrite(async () => {
      const current = await readLeaderboard();
      return writeLeaderboard([...current, verdict.entry]);
    }).catch((error) => {
      if (
        error.message === "Invalid player name"
        || error.message === "Invalid score"
        || error.message === "Invalid difficulty"
        || error.message === "Implausible run data"
        || error.message === "Unsupported leaderboard action"
      ) {
        throw error;
      }
      throw error;
    });

    sendJson(res, 200, entries);
    return;
  }

  sendText(res, 405, "Method Not Allowed");
};

const toSafeFilePath = (pathname) => {
  let decodedPathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const requested = decodedPathname === "/" ? "index.html" : decodedPathname.replace(/^\/+/, "");
  const normalized = path.normalize(path.join(rootDir, requested));
  if (!normalized.startsWith(rootDir)) {
    return null;
  }
  return normalized;
};

const serveStatic = async (res, url) => {
  const filePath = toSafeFilePath(url.pathname);
  if (!filePath) {
    sendText(res, 403, "Forbidden");
    return;
  }

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    sendText(res, 404, "Not Found");
    return;
  }

  const finalPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
  try {
    await fs.access(finalPath);
  } catch {
    sendText(res, 404, "Not Found");
    return;
  }

  const ext = path.extname(finalPath).toLowerCase();
  const contentType = contentTypes[ext] || "application/octet-stream";
  // HTML/JS/CSS change often during dev and already carry cache-busting
  // version query strings; force revalidation so stale code is never used.
  const revalidate = new Set([".html", ".js", ".css"]);
  const cacheControl = revalidate.has(ext) ? "no-cache" : "public, max-age=3600";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
  });

  const stream = createReadStream(finalPath);
  stream.on("error", () => {
    if (!res.headersSent) {
      sendText(res, 500, "Server Error");
      return;
    }
    res.destroy();
  });
  stream.pipe(res);
};

const server = createServer(async (req, res) => {
  if (!req.url) {
    sendText(res, 400, "Bad Request");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/leaderboard") {
    try {
      await handleLeaderboard(req, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Leaderboard API failure";
      if (
        message === "Invalid player name"
        || message === "Invalid score"
        || message === "Invalid difficulty"
        || message === "Implausible run data"
        || message === "Unsupported leaderboard action"
      ) {
        sendText(res, 400, message);
        return;
      }
      console.error("[Leaderboard] Request failed", error);
      sendText(res, 500, "Leaderboard service unavailable");
    }
    return;
  }

  await serveStatic(res, url);
});

server.listen(port, host, () => {
  console.info(`Finn server running at http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
});
