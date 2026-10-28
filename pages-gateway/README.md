# PinFlix external-DNS custom domain gateway

Purpose: keep the parent domain `pincodeit.com` DNS in Vercel, while serving the same PinFlix Next.js website from Cloudflare with no Vercel runtime.

Architecture:
- `pinflix-apk.pincodeit.com` CNAME managed in Vercel DNS
- Cloudflare Pages project `pinflix-apk-gateway` with a custom domain
- Cloudflare Pages Function `functions/[[path]].js` forwards incoming request through service binding `PINFLIX_APP` to Worker `pinflix-nextjs-preview` (the Next.js application)
- Full app, assets, API and media paths remain under one custom origin
- A binding is private account-internal Worker routing, not a Vercel proxy.

Cloudflare Pages production config must declare service `PINFLIX_APP` targeting `pinflix-nextjs-preview`. Project build root is `pages-gateway`, build `npm run build`, output `dist`.

Do **not** use a Vercel CNAME directly to `*.workers.dev`: Cloudflare Worker custom domains require an active zone on this plan. Pages allows external DNS CNAME once the domain has been attached to the Pages project. Keep original Vercel nameservers unchanged.

Release acceptance: test HTTPS home, /api/catalogue/, /_next/static, image routes, movie/TV details, HLS/MP4 and player Back, then repoint WebView APK and build through GitHub Actions.
