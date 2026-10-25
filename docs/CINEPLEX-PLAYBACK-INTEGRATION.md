# CineplexBD-only playback implementation

Updated: October 26, 2026

## Zero-configuration use

Clone the repository, run `npm install`, then `npm run dev` or
`npm start` (the latter builds automatically when no production build exists).
The application supports CineplexBD metadata, movie source resolution and TV
episode selection without `.env.local`, API keys, Firebase or a user-supplied
media proxy secret.

The default browser player uses same-origin MP4/HLS relay requests to the
Node.js host. This allows supported devices to use the same client regardless
of whether their browser handles cross-origin HTTP video URLs directly.

The relay is **not an open proxy**: source URLs are validated against a
narrow CineplexBD media host allowlist and stream requests require expiring
HMAC signatures. An automatically generated 32-byte server-side key is
stored in `.next/cache/pinflix-local-media-key` on the local host. It is not
committed to Git and never sent to the browser.

**Deployment caveat:** On multiple independent servers, requests may reach
different instances. Configure the same optional `MEDIA_PROXY_SECRET` on
every instance for consistent URL verification. Single-PC installs need no
manual setting. Public hosting also needs appropriate rate limits, HTTPS,
firewall and content permissions.

## Source handling

- Search: CineplexBD `search.php` and `search_ajax.php` JSON responses.
- Movie: metadata via `view.php?id=...`; playable URL from
  `player.php?id=...`, often its JavaScript `videoSrc` value.
- TV: metadata, seasons, episodes and HLS playlists from
  `watch.php?id=...&season=...&ep=...`.
- Video: the CineplexBD origin and its specifically identified MP4/HLS
  media hosts only; no external video fixtures, promotional reels or sample
  substitutions.
- HLS: all child variants, segments and URIs are rewritten to signed
  same-origin URLs. MP4 seeking forwards the browser's Range header.
- Captions: allowed CineplexBD VTT captions are relayed through the
  signed endpoint.
- An upstream `HEAD` request is not required for a movie URL to be offered:
  CineplexBD media hosts may reject HEAD while accepting GET. Playback still
  depends on the actual media GET succeeding.

## Optional operational controls

- `PINFLIX_PLAYBACK_DISABLED=true` disables playback deliberately.
- `PINFLIX_MEDIA_PROXY_DISABLED=true` disables same-origin relay.
- `PINFLIX_DOWNLOADS_AUTHORIZED=true` separately enables download UI/route
  for permitted content.
- `PINFLIX_MATURE_ENABLED=true` enables mature catalogue sections.
- `CINEPLEX_REQUEST_TIMEOUT_MS` sets request timeout within 1000–30000ms.

Legacy flags `CINEPLEX_PLAYBACK_AUTHORIZED` and
`PINFLIX_MEDIA_PROXY_ENABLED` are not needed by a fresh clone.
A custom `MEDIA_PROXY_SECRET` is **optional** unless the deployment uses
multiple independently running instances.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm test` and
`npm run build`; the GitHub provider-audit workflow runs all four.

The `/api/playback/?id=series-10527&season=1&episode=6` route should
resolve a signed source when the provider page supplies one. A `ready`
response confirms source parsing, not successful video decoding.

Availability still depends on live CineplexBD responses, expiring provider
tokens, host/network reachability, browser support and permitted access.
Hosting the app locally or publicly does not grant additional rights to
provider content. PinFlix does not bypass provider DRM or access controls.
