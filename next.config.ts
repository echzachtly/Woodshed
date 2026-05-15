import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/woodshed-icon.svg",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
