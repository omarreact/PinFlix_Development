# PinFlix: CineplexBD-only local network setup

Updated: 25 October 2026

This branch uses **CineplexBD only** for the movie and TV catalog and for all actual video playback. Local artwork copies are used only when mapped from original CineplexBD /uploads/ URLs. When the provider lists a poster on an unrelated host, PinFlix intentionally shows a fallback instead of downloading it. The UI does not autoplay an unrelated Cloudflare promotional reel or inject Big Buck Bunny/Mux sample videos.

## Scope

- Host computer: Windows, Node.js **24.x**, installed npm
- Host binds: `0.0.0.0:3000`
- Open on host: `http://localhost:3000/`
- Open on another device on the same Wi-Fi/LAN: `http://192.168.1.10:3000/` **only if your PC's actual LAN IPv4 address is 192.168.1.10**.
- Vercel is **not** required for local-network playback. Do not configure public DNS or router port forwarding.
- Local HTTP avoids the HTTPS mixed-content constraint of the public Vercel site. It does not guarantee upstream reachability or permission.

## Windows PowerShell install

```powershell
git clone https://github.com/omarreact/PinFlix_Development.git
cd PinFlix_Development
git fetch origin
git switch --track origin/fix/pinflix-audit-playback-20261025
npm ci
# If you have a previous working .env.local, copy it privately into this folder.
# Otherwise, run the explicit local setup option below.
npm run setup:lan -- --enable-playback
npm run dev
```

The package's `dev` and `start` commands listen on `0.0.0.0`. Do not create duplicate Windows firewall rules if one already exists. **Allow port 3000 only for your trusted Private LAN profile and your local subnet** (for example `192.168.1.0/24`), not for Public networks or the internet. Do not forward the port on your router. If your PC has a different IPv4 address, find it with `ipconfig` and use that address instead.

For an approved and stable local build use:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run start
```

## Server-only .env.local variables

```dotenv
CINEPLEX_REQUEST_TIMEOUT_MS=8000
CINEPLEX_PLAYBACK_AUTHORIZED=false
PINFLIX_MEDIA_PROXY_ENABLED=false
MEDIA_PROXY_SECRET=
PINFLIX_DOWNLOADS_AUTHORIZED=false
PINFLIX_OFFLINE_CATALOGUE=false
```

**How this relates to your working `PinFlix(2).zip`:** The uploaded archive already had `CINEPLEX_PLAYBACK_AUTHORIZED=true`, `PINFLIX_DOWNLOADS_AUTHORIZED=true`, and `PINFLIX_MATURE_ENABLED=true` in its local environment. The newer signed proxy requires two additional settings: `PINFLIX_MEDIA_PROXY_ENABLED=true` and a private `MEDIA_PROXY_SECRET`. If you copy your previous `.env.local` into the new project and run `npm run setup:lan` (without arguments), the helper preserves your existing playback, download, and mature-content choices, enables the proxy for existing playback opt-in, and generates a secret locally. The script never prints the secret. If installing fresh, `npm run setup:lan -- --enable-playback` performs an **explicit local opt-in**; use that option only where you have permission to stream through the custom app. `npm run setup:lan -- --disable-playback` turns it off.

Search, browsing and local CineplexBD snapshot fallback do not need playback credentials. **Playback intentionally stays unavailable** until you have explicit authorization for your intended reuse and change the two playback flags to `true`.

Only for streaming that the provider has authorized you to play through your own interface, set:

```dotenv
CINEPLEX_PLAYBACK_AUTHORIZED=true
PINFLIX_MEDIA_PROXY_ENABLED=true
MEDIA_PROXY_SECRET=<generated-64-character-hex-secret>
```

Generate a unique secret locally with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Never commit the real secret, put it in a `NEXT_PUBLIC_` variable, or paste it into chat. Restart the dev server after editing `.env.local`. Downloads remain independently disabled unless they have separate permission and `PINFLIX_DOWNLOADS_AUTHORIZED=true`.

## Why the old ZIP looked different

The older ZIP used an implicit-allow playback check (`CINEPLEX_PLAYBACK_AUTHORIZED` only blocked when set to `false`) and returned unrelated sample video streams whenever no real CineplexBD source was found. Therefore its player appearing functional does not by itself demonstrate valid CineplexBD playback. The new code fails closed when unauthorized, never substitutes a different video, and no longer rejects the observed tokenized CineplexBD MP4 solely because its origin does not support an HTTP `HEAD` request. A parsed source still needs to succeed on an actual media `GET` request for video to play.

## Current provider page parsing

- Search: `/search.php?q=...` with JSON suggestion fallback `/search_ajax.php?q=...&limit=12`
- Movie metadata: `/view.php?id=...`
- Movie player: `/player.php?id=...`
- TV details/episodes: `/watch.php?id=...&season=...&ep=...`
- Direct MP4: player JavaScript `videoSrc` value, only from explicitly allowlisted CineplexBD-associated origins
- TV HLS: media source listed in watch page `<video><source src="/hls/t/.../master.m3u8"></video>`

Media URLs may carry expiring provider query tokens. They are parsed at playback time, not hardcoded in the repo. No Mux sample, Google sample, Cloudflare promotional clip, TMDB network images, Movibox or unrelated video host is used. HLS.js is a local JavaScript **player library**, not a video provider.

## Check local network reachability

1. Confirm the PC and phone are on the same router/LAN; disable mobile data on the phone temporarily during the test if necessary.
2. Use `ipconfig` on the PC and confirm its Wi-Fi/Ethernet IPv4 address.
3. In PC Chrome, open `http://localhost:3000/api/health/`.
4. On your other LAN device, open `http://192.168.1.10:3000/api/health/` (replace IP with PC's real IPv4 address).
5. Browse `/movies/`, `/series/` and search a title.
6. Check `/api/suggest/?q=loki`; an offline snapshot may be used if CineplexBD is unavailable. An offline snapshot is not a stream source.
7. For authorized playback, inspect `/api/playback/?id=movie-79203` and `/api/playback/?id=series-10527&season=1&episode=6`.
8. A stream URL only plays if the CineplexBD origin is reachable **from the host PC**, the item exists, and all required rights/connection checks pass.

## Troubleshooting

- **Page opens on PC but not phone:** verify PC IPv4 address, firewall Private inbound rule and Wi-Fi client isolation.
- **No images:** only native CineplexBD upload posters/local CineplexBD-derived copies are allowed. Other image hosts are intentionally rejected.
- **Catalog fallback:** upstream connection failed or offline mode is enabled; increase timeout up to 30000ms if needed.
- **Playback authorization required:** rights flag is off. This is deliberate, not a CineplexBD API-key error.
- **Secure media playback not configured:** proxy flag/secret is missing; do not enable until authorized.
- **Media unavailable or stalls:** test upstream access on your PC and check the original source page and DevTools Network, without disclosing cookies or session tokens.
- **Phone cannot seek:** check media server Range support (`206 Partial Content`); some provider servers may not support seeking consistently.
- **Don't expect a Vercel preview to connect through your home BDIX network.** Vercel servers are remote; the local Node server makes outbound provider requests over the host PC's network.

## Safety and limits

Only use media you are authorized to access and embed. A local-only site is still subject to provider access terms and content rights. PinFlix never removes upstream DRM. Use a VPN or public hosting only if you independently understand your source licensing and exposure; the setup above is intentionally limited to LAN.