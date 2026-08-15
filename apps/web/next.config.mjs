/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The repo root is the tracing root: apps/web imports backend/core and
  // packages/shared from outside its own directory.
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,

  // Sibling workspaces ship raw TypeScript, so Next must compile them.
  transpilePackages: ['@swaram/shared', '@swaram/backend'],

  images: {
    // PRD §14: AVIF/WebP, lazy, blur-up.
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },

  experimental: {
    // Server Actions are used by the report flow's no-JS fallback.
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
