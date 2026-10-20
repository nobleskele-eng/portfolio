const isDev = process.env.NODE_ENV !== "production";

// Every origin the page loads from. Anything not listed here is blocked by the
// browser, so a new image/video/script host has to be added below.
const csp = [
  "default-src 'self'",
  // Next.js injects inline hydration scripts; dev also needs eval for HMR.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  // data: for the paper tile; Spotify album art; Discord avatars.
  "img-src 'self' data: blob: https://*.scdn.co https://*.spotifycdn.com https://cdn.discordapp.com https://media.stayvyxed.com",
  "media-src 'self' https://media.stayvyxed.com",
  "font-src 'self'",
  `connect-src 'self' https://va.vercel-scripts.com${isDev ? " ws:" : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // The site never uses next/image, so turn off the /_next/image optimizer
  // endpoint — the source of several unpatched Next 14 advisories.
  images: { unoptimized: true },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Presence data is live and per-moment; never let a cache hold it.
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
