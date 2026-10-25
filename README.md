# PinFlix — a world of stories

A cinematic Next.js movie and TV catalogue with seven homepage sections, fast text-first directories, unified search, personal watchlists, and a persistent in-page player.

The UI uses a Obsidian Frost charcoal design system with cool periwinkle and teal accents, locally bundled Inter fonts, responsive discovery rails, and desktop/tablet/mobile layouts. It preserves the supplied provider integration and never presents unavailable streams as playable.

## Install and run — no configuration required

Requires Node.js **24** and npm. Movies, TV episode listings, search and
CineplexBD source resolution do not need API keys, a `.env.local` file,
`MEDIA_PROXY_SECRET`, Firebase, or an account.

```powershell
git clone https://github.com/omarreact/PinFlix_Development.git
cd PinFlix_Development
npm install
npm run dev
```

Or run `npm start` instead of `npm run dev`. On the first production start,
PinFlix builds automatically if no build exists.

Open **http://localhost:3000** on the host computer. For phones/tablets on
the same Wi-Fi, open **http://YOUR-PC-LAN-IP:3000**; the application binds to
all interfaces and detects the host's private IP for Next.js development assets.
Use `ipconfig` on Windows to find your address. A mobile-data device outside
the Wi-Fi requires a separately reachable server address, domain or hosting:
`localhost` on a phone is that phone, not your PC.

All playable media originates from CineplexBD pages / their identified media
hosts. The app never substitutes sample films from other providers.
A private stream-signing key is generated automatically under
`.next/cache/` (gitignored). Only multi-instance deployments need an optional
shared `MEDIA_PROXY_SECRET`. Downloads remain opt-in.

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

See [network and troubleshooting guide](docs/LOCAL-CINEPLEXBD-LAN.md).
Playback requires the original provider to be reachable and the video to be
available for the viewer's network. Use only content you are authorized to
access and embed.

## Included

- Cinematic homepage: featured carousel, latest movies, CineplexBD-only imagery (no unrelated promotional video), latest series, Marvel/DC collections, decade browsing, rediscovery picks.
- `/movies` and `/series`: text-only lists with URL-preserved search/filter/sort state and server-side pagination.
- Movie and series detail pages: source-gated in-page playback, season/episode selection, resume progress, and related titles.
- Shared player: MP4/HLS, actual stream track menus, seek/speed/volume controls, fullscreen, theater mode, persistent mini-player, and supported picture-in-picture.
- `/my-list`: Watch Later and Continue Watching, with local persistence and removal controls.
- `/login` and `/profile`: guest preferences and optional Firebase email/password accounts with explicit library-merge choices.
- About, services, privacy, and terms pages.

## Integration status

The CineplexBD-only client, HLS/MP4 media relay, and responsive Next.js UI
operate without manual configuration. No browser access to provider cookies or
standalone streaming API credentials is required. Downloads, mature categories
and optional Firebase account sync have separate controls.

GitHub CI verifies TypeScript, lint, unit tests and a Next.js production build.
Real-world playback still depends on a reachable provider URL, valid upstream
media, viewer permissions, device decoding and the provider network.
No DRM or upstream access restrictions are bypassed.

## Source structure

- `app/` — App Router pages and API routes.
- `components/` — reusable discovery, account, library, and playback components.
- `lib/` — schemas, catalogue filters, preferences, storage, account adapter, provider normalization.
- `data/` — supplied catalogue snapshot and artwork references.
- `public/` — bundled artwork and licensed Inter font files.
- `tests/` — player, provider, directory, search, and library-merge tests.

The original legacy deployment files remain for compatibility. Normal operation uses standard Next.js scripts. Do not place source under a publicly served document root.
