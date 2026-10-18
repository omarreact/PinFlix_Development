# PinFlix — EBN Host PHP Edition

A separate PHP 8.2 + Vanilla JavaScript edition of the existing PinFlix project.
**Branch:** \`feature/ebn-php\` in \`omarreact/EBN_HOST\`. **Next.js \`main\` is unchanged.**

## Features

- Responsive dark cinema UI, movie and series collections, cards and hero
- CineplexBD-native catalogue/search attempts via fixed-origin PHP requests
- Provider title details, season/episode listings where exposed
- A dated 111-title metadata snapshot when provider access fails
- Category/year filters, instant search suggestions, browser-side My List/history
- HTML5 MP4 + hls.js player UI: controls, fullscreen, quality/audio tracks, subtitle toggles, resume
- Server-side poster proxy for approved image-only domains (avoids HTTPS mixed content)
- PHP API health, catalogue, search, detail, playback; no MySQL or Composer needed
- Playback **disabled by default** until provider licensing and approved HTTPS media are configured

## Requirements

PHP 8.2+ and LiteSpeed/Apache with \`.htaccess\` rewrites enabled. \`ext-curl\` and
\`ext-dom\` are recommended for live provider parsing; with missing extensions,
the application still exposes the dated fallback catalogue. PHP must have
file-cache write access under \`private/cache\` (or functions without persistence).
A browser with JavaScript is required.

## Deploy with cPanel File Manager

1. Keep the **Git checkout outside the public document root**. Download the
   \`feature/ebn-php\` branch, or use Git Version Control to check it out to a
   non-public folder. Do not connect the full Next.js repository to the domain root.
2. Back up the target website. Confirm the correct hostname, document root and TLS
   certificate in **cPanel → Domains**. Resolve any unexpected website/vhost mapping
   with EBN Host before deploying.
3. Copy **only the contents of \`php/\`** (including hidden \`.htaccess\`) to the
   intended domain's document root. Do not copy \`app/\`, \`components/\`,
   \`package.json\`, or \`.git/\` from the Next.js repository.
4. Ensure \`private/\` and \`tests/\` are blocked at the web-server layer. After
   deploying, verify \`/private/catalogue.json\` gives **403**, not source content.
   \`Options -Indexes\` prevents directory listing but is not a replacement for
   explicit authorization checks on private files.
5. The public directory root should show the PinFlix interface rather than an
   index of source files. Verify HTTPS and \`/api/?action=health\`.
6. Test catalogue, search, title, mobile display and media controls. If the provider
   cannot be reached from EBN, the dated snapshot appears and is clearly labeled.

Example target layout (subdomain document root, **not a Git repository**):

\`\`\`
<document-root>/
  .htaccess
  index.php
  api/index.php
  assets/app.css
  assets/app.js
  assets/player.js
  private/.htaccess
  private/provider.php
  private/catalogue.json
  private/media.example.json
\`\`\`

If cPanel Git **Pull or Deploy** is used, create a controlled deployment script
that copies only \`php/\` into the confirmed target location; never deploy an entire
checkout into \`public_html\`. Do not write a destructive \`.cpanel.yml\` without
confirming the actual document root and existing files.

## Playback and provider authorization

Provider permission has not been established. The API returns
\`authorization_required\` until **\`PINFLIX_PLAYBACK_AUTHORIZED=true\`** is set
as a private server environment variable. Even after that, no video appears unless
an operator provides a separate allowlisted file at \`private/media.json\`, using
\`media.example.json\` as a format reference, and sets \`PINFLIX_MEDIA_HOSTS\`
to a comma-separated list of permitted HTTPS hostnames.

Example \`PINFLIX_MEDIA_HOSTS=media.example.org\` is documentation **only**.
No media URL is included in the repository or bypasses provider authentication.
The PHP app does **not** proxy video or download streams through shared hosting.
Some legal HLS streams may require CORS; configure CORS on the authorized origin.

Do **not** enable external providers or mature categories without reviewing
provider rights and hosting policies.

## Local tests

\`\`\`sh
php php/tests/run.php
php -S 127.0.0.1:8080 -t php php/router.php
# Open http://127.0.0.1:8080/
# Smoke tests:
curl -i http://127.0.0.1:8080/api/?action=health
curl -i http://127.0.0.1:8080/private/catalogue.json  # must be 403
\`\`\`

Live provider connectivity is optional in deterministic PHP tests.
The local router blocks private paths because \`php -S\` does not interpret
Apache/LiteSpeed \`.htaccess\`.

## Security

The image proxy permits JPEG/PNG/WebP from only \`cineplexbd.net/uploads\`
and \`image.tmdb.org/t/p\`, with bounded responses and no redirects. The
metadata adapter has fixed upstream routes and bounded reads, not a general
remote-fetch endpoint. The API never sends provider cookies or credentials.

For production, also configure cPanel rate limiting, connection caps, server
access logs, backup/restore policies, and a valid HTTPS certificate.
