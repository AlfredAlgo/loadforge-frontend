/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
    reactStrictMode: true,
    output: "standalone",
    // pdf-parse (via pdfjs-dist) resolves its worker script relative to its
    // own module path at runtime. Webpack/Turbopack bundling the route
    // rewrites that path into a .next/server chunk that doesn't exist,
    // throwing "Setting up fake worker failed: Cannot find module
    // '.../pdf.worker.mjs'" on every PDF upload. Keeping these packages
    // external makes Next require() them from node_modules as-is instead,
    // the same way they work outside a bundler.
    serverExternalPackages: ["pdf-parse", "mammoth", "tesseract.js"],
};

export default config;
