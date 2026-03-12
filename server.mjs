import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.dirname(__filename);
const dataDir = path.join(rootDir, "data");
const leaderboardFile = path.join(dataDir, "leaderboard.json");

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 8080);

const maxEntries = 10;
const maxBodyBytes = 16_000;
const blockedNameFragments = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "dick",
  "pussy",
  "fucker",
  "bastard",
  "whore",
  "slut",
  "nigger",
  "nigga",
  "retard",
  "motherfucker",
];

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

const sendText = (res, statusCode, message) => {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(message);
};

const isAllowedName = (name) => {
  if (!/^[A-Za-z]{1,10}$/.test(name)) return false;
  const normalized = name.toLowerCase();
  return !blockedNameFragments.some((fragment) => normalized.includes(fragment));
};

const sanitizeEntries = (payload) => {
  if (!Array.isArray(payload)) return [];

  return payload
    .map((entry) => ({
      name: typeof entry.name === "string" ? entry.name.slice(0, 10) : "",
      score: Number.isFinite(entry.score) ? Math.max(0, Math.floor(entry.score)) : 0,
      ts: Number.isFinite(entry.ts) ? entry.ts : Date.now(),
    }))
    .filter((entry) => isAllowedName(entry.name));
};

const normalizeEntries = (entries) => {
  const byPlayer = new Map();
  for (const entry of sanitizeEntries(entries)) {
    const key = entry.name.toLowerCase();
    const existing = byPlayer.get(key);
    if (!existing || entry.score > existing.score || (entry.score === existing.score && entry.ts < existing.ts)) {
      byPlayer.set(key, entry);
    }
  }

  return [...byPlayer.values()]
    .sort((a, b) => b.score - a.score || a.ts - b.ts)
    .slice(0, maxEntries);
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
      if (body.length > maxBodyBytes) {
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
    let payload;
    try {
      payload = await readRequestJson(req);
    } catch (error) {
      sendText(res, error.message === "Payload too large" ? 413 : 400, error.message);
      return;
    }

    const name = typeof payload.name === "string" ? payload.name.trim().slice(0, 10) : "";
    const score = Number.isFinite(payload.score) ? Math.max(0, Math.floor(payload.score)) : 0;
    const ts = Number.isFinite(payload.ts) ? payload.ts : Date.now();

    if (!isAllowedName(name)) {
      sendText(res, 400, "Invalid player name");
      return;
    }

    if (score <= 0) {
      const entries = await readLeaderboard();
      sendJson(res, 200, entries);
      return;
    }

    const entries = await queueWrite(async () => {
      const current = await readLeaderboard();
      return writeLeaderboard([...current, { name, score, ts }]);
    });
    sendJson(res, 200, entries);
    return;
  }

  sendText(res, 405, "Method Not Allowed");
};

const toSafeFilePath = (pathname) => {
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const normalized = path.normalize(path.join(rootDir, requested));
  if (!normalized.startsWith(rootDir)) {
    return null;
  }
  return normalized;
};

const serveStatic = async (req, res, url) => {
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

  let finalPath = filePath;
  if (stat.isDirectory()) {
    finalPath = path.join(filePath, "index.html");
  }

  try {
    await fs.access(finalPath);
  } catch {
    sendText(res, 404, "Not Found");
    return;
  }

  const ext = path.extname(finalPath).toLowerCase();
  const contentType = contentTypes[ext] || "application/octet-stream";
  const cacheControl = ext === ".html" ? "no-cache" : "public, max-age=3600";

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
    await handleLeaderboard(req, res);
    return;
  }

  await serveStatic(req, res, url);
});

server.listen(port, host, () => {
  console.log(`Finn server running at http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
});
