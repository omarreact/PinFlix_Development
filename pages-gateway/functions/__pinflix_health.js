// Explicit diagnostic route; bypass Next.js's trailing-slash redirects.
export async function onRequest(context) {
  const service = context.env.PINFLIX_APP;
  if (!service || typeof service.fetch !== "function") {
    return Response.json({gateway:"ok",nextjs:"binding_missing"}, {status:503,headers:{"cache-control":"no-store"}});
  }
  try {
    const request = new Request(new URL("/api/health", context.request.url), {method:"GET", headers:{"accept":"application/json"}});
    const response = await service.fetch(request);
    return Response.json({gateway:"ok",nextjs:response.status === 200 ? "ready" : "unavailable",worker_status:response.status}, {status:response.status === 200 ? 200 : 503,headers:{"cache-control":"no-store"}});
  } catch (error) {
    console.error("PinFlix health upstream error", String(error));
    return Response.json({gateway:"ok",nextjs:"unavailable"}, {status:502,headers:{"cache-control":"no-store"}});
  }
}
