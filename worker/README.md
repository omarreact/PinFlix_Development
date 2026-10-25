# PinFlix Standalone (Cloudflare Worker)

Standalone deployment URL (public access still requires checking):
https://pinflix-standalone.farukkhanone.workers.dev/

Repository branch:
https://github.com/omarreact/PinFlix_Development/tree/standalone-cloudflare

## Architecture
This branch preserves the original Next.js code and adds a self-contained Cloudflare Worker in `worker/index.mjs`. **No changes to the existing cPanel site or Next.js main branch are required.** Cloudflare hosts the UI and serverless requests without running Node.js or PHP on cPanel.

- Catalogue: public `http://cineplexbd.net/index.php`, `category.php`, `tvs.php`, `search_ajax.php`
- Series listing fallback: `http://cds3.cineplexbd.net/`
- Media source: public movie/series pages on `cineplexbd.net`, with exact-host allowlist including `vod.cineplexbd.net:8081` and `cds3.cineplexbd.net`.
- **Never call or scrape `http://vod.cineplexbd.net:8081/admin`**. It is an admin interface.
- Stream delivery: first resolve a publicly supplied source URL, then proxy HLS manifests/segments or MP4 ranges through restricted paths. No arbitrary proxying and no access or DRM bypass.
- Real-time mode: **no bundled movie catalogue, downloaded copies, fabricated season lists, or database storage**.
- Dark charcoal, periwinkle and teal UI; movie/TV navigation, search, dynamic series episodes, responsive cards, native video and HLS.js player.

## Important, observed limitations
1. The public Worker URL returned **Cloudflare 1010** to a GitHub Actions automated request (browser-signature block). This does not conclusively describe mobile browser access; production accessibility is **unverified**.
2. Previous attempts to reach `cineplexbd.net` from GitHub timed out; `vod.cineplexbd.net:8081` playlists also timed out from external infrastructure. Cloudflare edge access to those origins is **unverified**.
3. A successful deployment or mock test does **not** establish playback. If the provider blocks outbound connections, withdraws URLs, requires authenticated access, or supplies no episode list, the application honestly reports unavailable. No fake entries, no trailer fallbacks.
4. The design expects rights to embed/redistribute any third-party content being served. Use provider-authorized streams only.
5. Serving media through Cloudflare Workers can consume bandwidth and account quota.

## Validation
`node --check worker/index.mjs`
`node --test tests/standalone-worker.test.mjs`

The worker is isolated from the existing PHP cPanel hosting and does not require manually configuring Node.js or PHP.

## Latest live verification (2026-10-15 UTC)

- Standalone Worker homepage and `/api/status` returned HTTP 200 with browser-style headers. Headless/default clients were previously blocked by Cloudflare 1010.
- Cloudflare Worker could not connect to the direct `cineplexbd.net` site, `cds3.cineplexbd.net`, or `vod.cineplexbd.net:8081`.
- An optional fallback to the user's previously working cPanel PHP API was added without embedding its UI. However, live checks of `http://pinflix.akogs-fashion.com/api.php` and `/site/api.php` both returned HTTP 404 (including health and catalogue calls). The former source was confirmed unreachable/missing at this date.
- Thus the standalone frontend is deployed and application tests pass, but **live catalogue and playback do not work until a reachable authorized media API or PHP gateway is available**. The project does not fake successful streams or invent episode data.
- The Worker does not access the VOD `/admin` dashboard.
