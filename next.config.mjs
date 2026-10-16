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

  // ──────────────────────────────────────────────────────────────────
  // Turbopack cache "Access is denied" on Windows
  // ──────────────────────────────────────────────────────────────────
  // There is no `memoryLimit` option on Next 16's `turbopack` config
  // (nor on the deprecated `experimental.turbo`) — both locations
  // emit "Unrecognized key" warnings. The real root cause of the
  // "Access is denied" on .next/dev/cache/turbopack is a Windows
  // file-handle race:
  //   • OneDrive / another cloud-sync tool is watching the project folder
  //   • Windows Defender real-time scan is reading cache files mid-write
  //   • A previous `next dev` process didn't exit cleanly and still
  //     holds a lock
  //
  // Fixes (apply in order of impact):
  //   1. Move the project OUT of a OneDrive-synced folder, or pause
  //      OneDrive for this folder in its tray-icon menu.
  //   2. Add a Windows Defender exclusion for the project directory:
  //      Settings → Virus & threat protection → Add an exclusion.
  //   3. If dev loops into the error, kill all `node` processes
  //      (`taskkill /F /IM node.exe`) and delete `.next` manually.
  //   4. Fallback: `NEXT_DISABLE_TURBOPACK=1 npm run dev` uses the
  //      stable webpack dev server, which doesn't use that cache path.
};

export default nextConfig;
