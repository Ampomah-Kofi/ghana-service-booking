import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Photo uploads: two client-resized renditions (≤ 300 KB + ≤ 900 KB) plus multipart overhead.
      bodySizeLimit: "1500kb",
    },
  },
};

export default nextConfig;
