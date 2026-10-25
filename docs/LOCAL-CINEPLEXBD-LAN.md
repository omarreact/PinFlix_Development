# PinFlix — run on any PC and watch in any modern browser

## Fresh installation

Requires Node.js 24 and npm:

```powershell
git clone https://github.com/omarreact/PinFlix_Development.git
cd PinFlix_Development
npm install
npm run dev
```

Alternatively use `npm start` instead of `npm run dev`. The initial `npm start`
builds the Next.js site automatically when a production build is missing.
No `.env.local` file, Firebase account, API token or proxy secret is required
for the CineplexBD catalogue and permitted stream URLs.

### Open the website

- Host PC: `http://localhost:3000/`
- Other devices on the host's Wi-Fi: `http://<PC-LAN-IP>:3000/` (for example `http://192.168.1.10:3000/`, only when the PC has that address)
- A remote mobile-data device must connect to a **publicly reachable HTTPS domain or server** serving this app. It cannot reach another computer using `localhost` or its private 192.168.x.x IP over mobile data.

Both development and production scripts bind to `0.0.0.0`.
The development server detects the host's private LAN IPv4 addresses for
Next.js's `allowedDevOrigins` setting instead of hardcoding one address.

Do not expose the Next.js **development server** to an untrusted network.
For any public-facing deployment, use a production build behind HTTPS,
appropriate firewalls and request limits. Internet access depends on hosting,
not on whether CineplexBD itself is reachable over the viewer's mobile SIM.

## Where the videos come from

The only accepted video sources are CineplexBD and the identified related
media servers. Search, movie details and TV episodes are read from CineplexBD
pages and their native endpoints.

- Movie: `/player.php?id=...` with an MP4 assigned through `videoSrc`
- Series: `/watch.php?id=...&season=...&ep=...`, often an HLS `master.m3u8` file
- Search suggestions: `/search_ajax.php?q=...&limit=...`
- Media: same-origin `/api/stream/` proxy for signed HLS playlists, segments, MP4 and subtitles

A **private local signing key is generated automatically** under
`.next/cache/pinflix-local-media-key`. You do not need to create, copy,
manage or expose a `MEDIA_PROXY_SECRET`. Media relay destinations are
strictly allowlisted, and media requests require valid expiring signatures.
Signed URLs are regenerated as needed.

For larger deployments with multiple independent servers/instances, configure
one shared `MEDIA_PROXY_SECRET` on all replicas to maintain consistent
signature verification. This is **optional** for downloaded/local use.

The provider must actually deliver the source stream; the app does not
invent an MP4, substitute an unrelated sample video, or bypass upstream DRM.

## Optional configuration

Copy `.env.example` to `.env.local` **only if you need optional controls**:

- `PINFLIX_PLAYBACK_DISABLED=true`: intentionally disable video playback
- `PINFLIX_MEDIA_PROXY_DISABLED=true`: intentionally disable the proxy
- `PINFLIX_DOWNLOADS_AUTHORIZED=true`: allow downloads only where permitted
- `PINFLIX_MATURE_ENABLED=true`: allow mature catalogue categories
- `CINEPLEX_REQUEST_TIMEOUT_MS=8000`: metadata/media response-header timeout

Older `CINEPLEX_PLAYBACK_AUTHORIZED` and
`PINFLIX_MEDIA_PROXY_ENABLED` flags are no longer required for watching.
The optional `npm run setup:lan` command maintains backward compatibility,
but is not part of the fresh-install instructions.

## Troubleshooting

Check the app's actual playback status by visiting, for example:

`http://localhost:3000/api/playback/?id=series-10527&season=1&episode=6`

A `ready` response confirms that a CineplexBD media URL was resolved and
signed. It does not guarantee the remote server permits playback or that
the device can decode the file.

If a video stalls, verify its source from the same PC/network as the Node.js
server. A source that works in the phone's mobile browser may still be
unreachable from a different server or hosting provider.

If another device cannot open the app, verify the PC's actual LAN IPv4 with
`ipconfig`, Windows Firewall on the Private network, and Wi-Fi client
isolation. The PC's service must remain running.

## Rights and limitations

Only embed, stream or download provider content that you are permitted to
access and reuse. Running locally does not grant distribution rights.
