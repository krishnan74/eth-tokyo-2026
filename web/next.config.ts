import path from "node:path";
import type { NextConfig } from "next";

// Dependencies live in the repo root's node_modules, and the shared core in ../core/cascade — the same
// module the terminal demo imports. Point the bundler at the repo root so both resolve.
const root = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  turbopack: { root },
  outputFileTracingRoot: root,
};

export default nextConfig;
