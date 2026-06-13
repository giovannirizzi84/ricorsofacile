import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "tesseract.js"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
