# Next.js security upgrade — 26 October 2026

## Source and target

- Application: PinFlix `omarreact/PinFlix_Development`
- Command executed on Node.js 24 GitHub Actions runner:
  `./node_modules/.bin/next upgrade --agent=security`
- CLI result: exit code 0; recommended Next.js **16.4.0 → 16.4.3**
- The CLI generated an agent upgrade task requiring the same-major security patch
  and `experimental.agentUpgrade: "security"` in the Next.js configuration.
- Changes applied: `next@16.4.3` and `eslint-config-next@16.4.3`,
  with npm-generated `package-lock.json` updates. Other runtime
  package versions were preserved.
- `next.config.mjs` now sets the recommended security agent-upgrade policy.
- The temporary GitHub Actions upgrade workflow was removed after execution.

## Verification

Executed on the patched dependency tree:
```sh
npm run typecheck
npm run lint
npm test
npm run build
```
All four commands passed on the Node.js 24 upgrade runner. ESLint reported
three existing warnings but no errors. No feature/UI/CineplexBD provider source
code was modified by the security patch.

## Advisory context

October 2026 security advisories identify vulnerabilities in Next.js 16.x
versions through 16.4.0. The first fixed stable release was 16.4.1; 16.4.3
includes the security fixes:

- https://nextjs.org/blog/nextjs-security-update-october-14-2026
- https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr
- https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw
- https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r

The patched package is not active until the application is reinstalled,
rebuilt and restarted or redeployed. No live video playback or public Vercel
deployment is covered by this security-only CI verification.
