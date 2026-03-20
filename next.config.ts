import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fqfufzrebrxubrechdal.supabase.co",
      },
      {
        protocol: "https",
        hostname: "www.thesmackdownhotel.com",
      },
      {
        protocol: "https",
        hostname: "thesmackdownhotel.com",
      },
    ],
  },
};

export default nextConfig;
