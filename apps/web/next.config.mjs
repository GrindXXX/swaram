/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Sibling workspaces ship raw TypeScript, so Next must compile them.
  transpilePackages: ['@swaram/shared', '@swaram/backend'],

  images: {
    // PRD §14: AVIF/WebP, lazy, blur-up.
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },

  experimental: {
    // The repo root is the tracing root: apps/web imports sibling packages.
    outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
    // Server Actions are used by the report flow's no-JS fallback.
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
