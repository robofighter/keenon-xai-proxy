#!/usr/bin/env node
/**
 * xAI reverse proxy for Railway / Render / any non-RU host.
 * Forwards /* -> https://api.x.ai/*
 * Set on VPS: XAI_BASE_URL=https://YOUR-SERVICE.up.railway.app/v1
 */
import http from "node:http";

const PORT = Number(process.env.PORT || 8787);
const UPSTREAM = (process.env.XAI_UPSTREAM || "https://api.x.ai").replace(/\/$/, "");
const PROXY_TOKEN = (process.env.PROXY_TOKEN || "").trim();

process.on("uncaughtException", (err) => console.error("uncaughtException", err));
process.on("unhandledRejection", (err) => console.error("unhandledRejection", err));

const HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function unauthorized(res) {
  res.writeHead(401, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "unauthorized" }));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/" || url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, upstream: UPSTREAM }));
      return;
    }

    if (PROXY_TOKEN) {
      const auth = String(req.headers["x-proxy-token"] || "");
      const bearer = String(req.headers.authorization || "");
      const ok =
        auth === PROXY_TOKEN ||
        bearer === `Proxy ${PROXY_TOKEN}` ||
        bearer === `Bearer ${PROXY_TOKEN}`;
      // Allow real xAI bearer through; only require proxy token if header present mode:
      // If PROXY_TOKEN set, require x-proxy-token match (keeps xAI Authorization intact).
      if (auth !== PROXY_TOKEN) {
        unauthorized(res);
        return;
      }
    }

    const bodyBuf = await readBody(req);
    const target = `${UPSTREAM}${url.pathname}${url.search}`;
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (!k || HOP.has(k.toLowerCase())) continue;
      if (k.toLowerCase().startsWith("x-forwarded-")) continue;
      if (k.toLowerCase() === "x-proxy-token") continue;
      headers[k] = v;
    }

    const init = { method: req.method || "GET", headers };
    if (req.method && !["GET", "HEAD"].includes(req.method)) {
      init.body = bodyBuf;
    }

    const upstream = await fetch(target, init);
    // Node fetch decompresses; never forward upstream content-encoding / length.
    const buf = Buffer.from(await upstream.arrayBuffer());
    const outHeaders = {
      "content-type": upstream.headers.get("content-type") || "application/json",
      "content-length": String(buf.length),
      "cache-control": "no-store",
    };
    res.writeHead(upstream.status, outHeaders);
    res.end(buf);
  } catch (err) {
    console.error("proxy error", err);
    if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: String(err?.message || err) }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`keenon-xai-proxy on :${PORT} -> ${UPSTREAM}`);
});
