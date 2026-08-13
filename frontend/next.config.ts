import type { NextConfig } from "next";

/**
 * Media is served by our own API off its local disk, at
 * `${MEDIA_BASE_URL}/media/...`. next/image refuses any host not listed here,
 * so this has to track wherever the API is reachable — set MEDIA_BASE_URL to
 * the public origin (https://api.yourdomain.com, or the domain nginx serves
 * /media from) when you move to the VPS.
 */
const mediaBase =
  process.env.MEDIA_BASE_URL ?? process.env.API_URL ?? "http://localhost:4000";

const { protocol, hostname, port } = new URL(mediaBase);

/**
 * Next 16 refuses to optimise images from a private IP unless told otherwise —
 * an SSRF guard, since an attacker-supplied URL could otherwise make the server
 * fetch things only it can reach. Here the host is our own API, and on a
 * single-VPS deploy it stays private, so the relaxation is correct. It is
 * scoped to local hosts on purpose: point MEDIA_BASE_URL at a public domain and
 * this switches itself back off.
 */
const isLocalHost =
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "::1" ||
  /^10\./.test(hostname) ||
  /^192\.168\./.test(hostname) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: protocol.replace(":", "") as "http" | "https",
        hostname,
        ...(port ? { port } : {}),
        pathname: "/media/**",
      },
    ],
    ...(isLocalHost ? { dangerouslyAllowLocalIP: true } : {}),
  },
};

export default nextConfig;
