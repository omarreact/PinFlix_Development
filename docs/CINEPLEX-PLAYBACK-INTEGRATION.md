# CineplexBD playback integration: audit-driven fixes

Updated: 2026-10-25  
Target: Vercel project `pf` (connected to `omarreact/PinFlix_Development`; a recent preview deployed from `standalone-cloudflare`).

## Implemented in this branch

- Watch episode resolver uses `watch.php?id=...&season=...&ep=...` (not `series_id` or a fragment-only episode).
- Search JSON parser accepts an array or `{results: [...]}`. Existing server-side `search_ajax.php` fallback remains.
- Series detail scraper recognizes season dropdowns and episode links without legacy `.ep-card` classes.
- The playback rights gate now fails closed unless `CINEPLEX_PLAYBACK_AUTHORIZED=true`.
- The optional streaming relay additionally requires `PINFLIX_MEDIA_PROXY_ENABLED=true` and a server-only `MEDIA_PROXY_SECRET` of at least 32 characters. Relay URLs are HMAC-signed, tied to content/episode/source, and expire after 6 hours.
- HLS master/media segments and URI-bearing playlist lines are individually re-signed.
- Missing movie/series sources report "unavailable", not fake playable Big Buck Bunny/Mux sample videos. The test fixture mode is limited to non-production.
- Downloads require separate `PINFLIX_DOWNLOADS_AUTHORIZED=true`.
- Upstream request timeout is configurable with `CINEPLEX_REQUEST_TIMEOUT_MS` (1000–30000 ms, default 4500 for metadata).

## Environment settings

| Variable | Default | Usage |
|---|---|---|
| CINEPLEX_REQUEST_TIMEOUT_MS | 4500 | Bound server-side fetch calls |
| CINEPLEX_PLAYBACK_AUTHORIZED | false | Only true after rights/embedding approval |
| PINFLIX_MEDIA_PROXY_ENABLED | false | Extra explicit streaming relay approval |
| MEDIA_PROXY_SECRET | unset | Private HMAC signing key, 32+ characters |
| PINFLIX_DOWNLOADS_AUTHORIZED | false | Separate download rights |
| PINFLIX_TEST_MEDIA | false | Development fixtures only, blocked in production |

Never add `NEXT_PUBLIC_` to the signing secret. The existence of a media URL does **not** prove redistribution rights. Explicit flags indicate that the operator has verified those rights; they do not constitute legal permission by themselves.

## External source observations, not deployment guarantees

- An external MP4 URL under `http://103.136.200.124:8086/...` was seen for DeSu7 (ID 79203). Public access, streaming rights, cross-origin compatibility, Range support, and Vercel reachability were **not** established.
- A Loki (series ID 10527) watch page displayed six Season 2 episode links and a playback error. Its actual media URL and availability remain unknown.
- An uploaded CineplexBD search-page HTML snapshot showed `search_ajax.php` and card links. Whether the endpoint responds from Vercel, and permission to reuse its catalog, remain unverified.
- If the origin is reachable only over BDIX or certain Bangladeshi ISPs, Vercel serverless functions might not be able to connect.
- No DRM/cookie restriction bypass or arbitrary third-party video rehosting is implemented or authorized by this change.

## Release verification

1. Run `npm ci && npm run typecheck && npm run lint && npm test && npm run build`.
2. On a preview, `/api/playback/?id=movie-79203` should report `authorization_required` without the rights flag.
3. `/api/stream/?id=movie-79203&url=https://example.com/video.mp4` must reject unsigned calls with HTTP 403.
4. Test `/api/suggest/?q=loki` and verify whether results are live or cached; avoid treating offline snapshot content as live inventory.
5. Only with written permission and an authorized test fixture, verify actual media requests, seeking/ranges, mobile playback, and season/episode accuracy.
6. Never promote preview to production solely because the Next.js build passed.
