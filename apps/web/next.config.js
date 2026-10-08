/** @type {import('next').NextConfig} */
const nextConfig = {
  // The shared workspace package ships plain ESM source; let Next compile it.
  transpilePackages: ['@sproutcue/shared'],
  experimental: {
    // middleware.js refreshes the Supabase session and therefore clones upload
    // bodies. Leave room for up to 90 MB of photos plus multipart form overhead.
    middlewareClientMaxBodySize: '110mb',
  },
};

export default nextConfig;
