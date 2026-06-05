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
};

export default nextConfig;
