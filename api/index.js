export const config = { runtime: "edge" };

const BASE_URL = normalizeBase(process.env.TARGET_DOMAIN);

const HOP_BY_HOP = [
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
];

export default async function handler(request) {
  if (!BASE_URL) {
    return respond("Server misconfigured", 500);
  }

  try {
    const destination = buildTargetUrl(request.url);
    const headers = buildForwardHeaders(request.headers);

    const init = createRequestInit(request, headers);

    const response = await fetch(destination, init);
    return response;
  } catch (e) {
    console.error("[edge-relay]", e);
    return respond("Upstream error", 502);
  }
}

/* ---------------- utils ---------------- */

function normalizeBase(input) {
  if (!input) return "";
  return input.endsWith("/") ? input.slice(0, -1) : input;
}

function buildTargetUrl(originalUrl) {
  const pathIndex = originalUrl.indexOf("/", 8);
  const path = pathIndex === -1 ? "/" : originalUrl.substring(pathIndex);
  return BASE_URL + path;
}

function buildForwardHeaders(incoming) {
  const result = new Headers();
  let ip = extractClientIp(incoming);

  for (const [key, value] of incoming.entries()) {
    if (shouldSkipHeader(key)) continue;
    result.set(key, value);
  }

  if (ip) {
    result.set("x-forwarded-for", ip);
  }

  return result;
}

function shouldSkipHeader(name) {
  return (
    HOP_BY_HOP.includes(name) ||
    name.startsWith("x-vercel-") ||
    name === "x-real-ip" ||
    name === "x-forwarded-for"
  );
}

function extractClientIp(headers) {
  return (
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for") ||
    null
  );
}

function createRequestInit(req, headers) {
  const method = req.method;
  const allowBody = !["GET", "HEAD"].includes(method);

  return {
    method,
    headers,
    body: allowBody ? req.body : undefined,
    duplex: "half",
    redirect: "manual",
  };
}

function respond(message, status = 200) {
  return new Response(message, { status });
}
