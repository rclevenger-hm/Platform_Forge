export function normalizeUrl(value) {
  if (!value.trim()) return "";
  const u = new URL(value);
  if (
    !["http:", "https:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.search ||
    u.hash
  )
    throw Error("Use a plain HTTP(S) backend URL.");
  if (
    location.protocol === "https:" &&
    u.protocol === "http:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
  )
    throw Error("Use HTTPS for a remote backend.");
  return u.href.replace(/\/$/, "");
}
export async function request(settings, path, body, signal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abort, { once: true });
  try {
    const r = await fetch(`${settings.url || ""}/api/${path}`, {
      credentials: "include",
      method: body ? "POST" : "GET",
      headers: {
        "X-Forge-Client": "1",
        ...(settings.csrf ? { "X-CSRF-Token": settings.csrf } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(settings.token
          ? { Authorization: `Bearer ${settings.token}` }
          : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    if (!r.ok) {
      let message = `Backend returned ${r.status}`;
      try {
        message = (await r.json()).error || message;
      } catch {}
      const error = Error(message);
      error.status = r.status;
      throw error;
    }
    return await r.json();
  } catch (e) {
    if (e.name === "AbortError") throw Error("Request cancelled or timed out.");
    throw e;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
