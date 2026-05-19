import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: [
    "@vue/compiler-sfc",
    "@babel/parser",
    "@babel/traverse",
    "@babel/generator",
    "@babel/types",
  ],
};

export default nextConfig;
