import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    // The public site (app/(public)) and the registration/admin app (app/(app)) have separate root
    // layouts, so unmatched URLs need a global 404 (app/global-not-found.tsx).
    globalNotFound: true,
  },
  async redirects() {
    return [
      // The standalone rules page was merged into /policies.
      { source: "/rules", destination: "/policies", permanent: true },
      // Pages of the old single-event site, now under the Raipur event section.
      { source: "/race-information", destination: "/raipur/race-info", permanent: false },
      { source: "/gallery", destination: "/raipur/gallery", permanent: false },
      { source: "/faq", destination: "/raipur/rules#faq", permanent: false },
    ];
  },
};

export default nextConfig;
