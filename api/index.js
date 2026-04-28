#thisisnewcode

export const config = { runtime: "edge" };

const BASE = cleanBase(process.env.TARGET_DOMAIN);

export default async function handler(req) {
  if (!BASE) {
    return new Response("Missing TARGET_DOMAIN", { status: 500 });
  }

  try {
    const url = resolveUrl(req.url);
    const controller = new AbortController();

    // timeout ساده
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: req.method,
      headers: forwardHeaders(req.headers),
      body: shouldSendBody(req.method) ? req.body : undefined,
      redirect: "manual",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return new Response(response.body, {
      status: response.status,
      headers: sanitizeResponseHeaders(response.headers),
    });

  } catch (err) {
    console.error("proxy failure:", err);
    return new Response("Upstream request failed", { status: 502 });
  }
}

/* helpers */

function cleanBase(input) {
  return input ? input.replace(/\/$/, "") : "";
}

function resolveUrl(original) {
  const idx = original.indexOf("/", 8);
  return BASE + (idx === -1 ? "/" : original.slice(idx));
}

function shouldSendBody(method) {
  return !["GET", "HEAD"].includes(method);
}

function forwardHeaders(headers) {
  const out = new Headers();

  for (const [k, v] of headers.entries()) {
    if (k.startsWith("x-vercel-")) continue;
    if (k === "host") continue;
    out.set(k, v);
  }

  return out;
}

function sanitizeResponseHeaders(headers) {
  const out = new Headers(headers);
  out.delete("content-encoding"); // جلوگیری از مشکلات edge
  return out;
}
