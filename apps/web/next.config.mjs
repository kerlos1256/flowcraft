/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@flowcraft/shared-types'],
  // Keep Prisma (and its engine binary) out of the bundler so it's traced
  // correctly into the serverless functions on Vercel.
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },
};

export default nextConfig;
