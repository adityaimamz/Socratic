import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.SAFE_EXAM_TEST_BUILD === "1" ? ".next-e2e" : ".next",
  poweredByHeader: false,
  // Reuse the page shell in browser memory; live data still validates via its API.
  experimental: { staleTimes: { dynamic: 30 } },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" }
    ] }];
  }
};
export default config;
