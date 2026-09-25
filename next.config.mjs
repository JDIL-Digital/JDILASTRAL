/** @type {import('next').NextConfig} */
const nextConfig = {
  // `standalone` emits a self-contained .next/standalone/ that
  // Replit's Cloud Run deploy target can copy into a slim container.
  output: "standalone",

  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60,
    unoptimized: false,
  },

  experimental: {
    // `@tanstack/react-table`'s current ESM build trips Next 14's
    // barrel-import transformer with:
    //   "Module parse failed: 'import' and 'export' may appear only
    //   with 'sourceType: module'"
    // Verified against @tanstack/react-table@8.20.5 + next@14.2.18.
    // Re-add it here once TanStack ships a fixed ESM entrypoint.
    // The two entries below carry the bulk of the tree-shake win.
    optimizePackageImports: ["recharts", "lucide-react"],
  },
};

export default nextConfig;
