import type { NextConfig } from "next";

// Force project root so resolution doesn't use a parent directory (e.g. C:\Users\ricar\) when another package.json exists there
const projectRoot = process.cwd();

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  webpack: (config) => {
    config.context = projectRoot;
    return config;
  },
};

export default nextConfig;
