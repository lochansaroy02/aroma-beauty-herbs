import type { NextConfig } from "next";

/**
 * next/image refuses any host not listed here, and this app can serve media
 * from two places at once: our own API (MEDIA_DRIVER=local) and ImageKit
 * (MEDIA_DRIVER=imagekit). Existing rows keep the disk they were uploaded to,
 * so after a driver switch BOTH hosts appear on the same page — hence both are
 * always allowed rather than one being chosen by the current driver.
 */
const mediaBase =
  process.env.MEDIA_BASE_URL ?? process.env.API_URL ?? "http://localhost:4000";

const { protocol, hostname, port } = new URL(mediaBase);

/**
 * Where the product photos come from.
 *
 * The catalogue is Barber Syndicate's, and so are its images — next/image
 * refuses any host not listed here, so without this every product renders as a
 * broken frame. Kept as its own origin rather than folded into MEDIA_BASE_URL
 * because the two are genuinely different systems: this one we only read.
 */
const shopImages = new URL(
  process.env.SHOP_IMAGE_BASE ?? "https://barbersyndicate.in"
);

/** Defaults to every ik.imagekit.io account; set it for a custom domain. */
const imageKitEndpoint =
  process.env.IMAGEKIT_URL_ENDPOINT ?? "https://ik.imagekit.io";

const imageKit = new URL(imageKitEndpoint);

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
      {
        protocol: imageKit.protocol.replace(":", "") as "http" | "https",
        hostname: imageKit.hostname,
        pathname: "/**",
      },
      {
        protocol: shopImages.protocol.replace(":", "") as "http" | "https",
        hostname: shopImages.hostname,
        pathname: "/**",
      },
    ],
    ...(isLocalHost ? { dangerouslyAllowLocalIP: true } : {}),
  },
};

export default nextConfig;
