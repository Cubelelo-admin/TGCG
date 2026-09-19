import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The standalone rules page was merged into /policies.
      { source: "/rules", destination: "/policies", permanent: true },
    ];
  },
};

export default nextConfig;
