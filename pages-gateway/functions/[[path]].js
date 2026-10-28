/**
 * PinFlix Cloudflare-only gateway to the independently deployed Next.js Worker.
 * Called by functions/index.js for "/" and this catch-all for all nested paths.
 */
export async function onRequest(context) {
  const requestUrl = new URL(context.request.url);
  const upstream = context.env.PINFLIX_APP;
  const ready = upstream && typeof upstream.fetch === "function";
  if (requestUrl.pathname === "/__pinflix_health") {
    return Response.json({
      service: "pinflix-cloudflare-gateway",
      gateway: "ok",
      nextjs_binding: ready ? "available" : "missing",
    }, {status: ready ? 200 : 503, headers: {"cache-control": "no-store"}});
  }
  if (!ready) {
    return new Response("PinFlix Next.js binding unavailable", {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-pinflix-edge": "missing-binding"
      }
    });
  }
  try {
    const response = await upstream.fetch(context.request);
    const headers = new Headers(response.headers);
    headers.set("x-pinflix-edge", "cloudflare-pages-worker");
    headers.delete("x-powered-by");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (err) {
    console.error("PinFlix upstream binding failed", String(err));
    return new Response("PinFlix Next.js temporarily unavailable", {
      status: 502,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-pinflix-edge": "upstream-error"
      }
    });
  }
}
