import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: false,
  experimental: {
    // Server Actions submit whole chart notes; the default 1 MB body cap is tight.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
