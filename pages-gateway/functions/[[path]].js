/**
 * Cloudflare Pages custom-domain front door to the PinFlix Next.js Worker.
 * No Vercel runtime traffic. A service binding invokes the exact Worker.
 */
export async function onRequest(context) {
  const upstream = context.env.PINFLIX_APP;
  if (!upstream || typeof upstream.fetch !== "function") {
    return new Response("PinFlix service binding is not configured", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }
  const response = await upstream.fetch(context.request);
  const headers = new Headers(response.headers);
  headers.set("x-pinflix-edge", "cloudflare-pages-worker");
  headers.delete("x-powered-by");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
