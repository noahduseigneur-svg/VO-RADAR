import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.autoscout24.com' },
      { protocol: 'https', hostname: '**.autoscout24.fr' },
      { protocol: 'https', hostname: 'img.leboncoin.fr' },
      { protocol: 'https', hostname: 'static.leboncoin.fr' },
      { protocol: 'https', hostname: '**.mobile.de' },
      { protocol: 'https', hostname: '**.marktplaats.nl' },
      { protocol: 'https', hostname: '**.marktplaats.be' },
      { protocol: 'https', hostname: '**.aramis-auto.com' },
      { protocol: 'https', hostname: '**.bymycar.fr' },
      { protocol: 'https', hostname: '**.spoticar.fr' },
      { protocol: 'https', hostname: '**.ebayimg.com' },
    ],
  },
};

export default nextConfig;
