/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // middleware.js refreshes the Supabase session and therefore clones upload
    // bodies. Leave room for five 10 MB photos plus multipart form overhead.
    middlewareClientMaxBodySize: '55mb',
  },
};

export default nextConfig;
