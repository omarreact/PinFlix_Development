// Read-only release gate: only the isolated Cloudflare Workers staging hostname.
const origin = new URL("https://cf-migrate-pinflix-stage.farukkhanone.workers.dev");
const checks = [{ path: "/", kind: "html" }, { path: "/api/health", kind: "json" }];
let failures = 0;
for (const { path, kind } of checks) {
  try {
    const response = await fetch(new URL(path, origin), {
      method: "GET", redirect: "manual", signal: AbortSignal.timeout(20000),
      headers: { "user-agent": "Cloudflare-Stage-ReadOnly-Gate/1.0" },
    });
    const body = (await response.text()).slice(0, 100000);
    let contentOk = false;
    if (kind === "html") {
      contentOk = (response.headers.get("content-type") || "").includes("text/html") && body.toLowerCase().includes("<html") && !/preview pending/i.test(body);
    } else {
      try {
        const data = JSON.parse(body);
        contentOk = data.service === "PinFlix" && data.ok === true;
      } catch { contentOk = false; }
    }
    const pass = response.status === 200 && contentOk;
    console.log(`${pass ? "PASS" : "FAIL"} ${path}: HTTP ${response.status}; content=${kind}; valid=${contentOk}`);
    if (!pass) failures++;
  } catch (e) {
    console.error(`FAIL ${path}: ${e instanceof Error ? e.message : String(e)}`);
    failures++;
  }
}

try {
  const response = await fetch(new URL("/api/catalogue?sort=recent", origin), { redirect: "manual", signal: AbortSignal.timeout(20000) });
  const body = response.status === 200 ? await response.json() : null;
  const pass = response.status === 200 && body !== null && typeof body === "object";
  console.log(`${pass ? "PASS" : "FAIL"} /api/catalogue: HTTP ${response.status}; JSON=${body !== null}`);
  if (!pass) failures++;
} catch (e) {
  console.error(`FAIL /api/catalogue: ${e instanceof Error ? e.message : String(e)}`);
  failures++;
}
try {
  const response = await fetch(new URL("/api/library", origin), { redirect: "manual", signal: AbortSignal.timeout(20000) });
  const pass = response.status === 401;
  console.log(`${pass ? "PASS" : "FAIL"} /api/library anonymous denial: HTTP ${response.status}`);
  if (!pass) failures++;
} catch (e) {
  console.error(`FAIL /api/library: ${e instanceof Error ? e.message : String(e)}`);
  failures++;
}

if (failures) {
  console.error(`Cloudflare staging gate failed (${failures} check(s)); do NOT attach a production domain.`);
  process.exitCode = 1;
}
