import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img-b.udemycdn.com",
      },
      {
        protocol: "https",
        hostname: "img-c.udemycdn.com",
      },
      {
        protocol: "https",
        hostname: "udemycdn.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // The site is fully localized under /[locale]. The old English-only routes
  // (/ and /course/...) are permanently redirected to their /en equivalents so
  // existing links and indexed URLs keep working without duplicate content.
  async redirects() {
    return [
      { source: "/", destination: "/en", permanent: true },
      { source: "/course/:path*", destination: "/en/course/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
