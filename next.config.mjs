import { networkInterfaces } from "node:os";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

// Allow the host machine's actual private LAN IPv4 addresses during development.
// This avoids hardcoding one person's IP, without trusting arbitrary internet hosts.
const localNetworkOrigins = Object.values(networkInterfaces())
  .flat()
  .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
  .map((entry) => entry.address)
  .filter((ip) =>
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip),
  );

const config = {
  trailingSlash: true,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: { agentUpgrade: "security" },
  allowedDevOrigins: ["localhost", "127.0.0.1", ...localNetworkOrigins],
  serverExternalPackages: ["cheerio"],
  // An unrelated lockfile in the Windows user profile must not become
  // PinFlix’s workspace root; resolve from this config, not the shell cwd.
  turbopack: { root: projectRoot },
  outputFileTracingRoot: projectRoot,
  async redirects() {
    return [
      {
        source: "/library",
        destination: "/my-list/",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};
export default config;
