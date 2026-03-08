import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
