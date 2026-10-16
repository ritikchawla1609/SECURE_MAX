/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['ethers'],
  },
  images: {
    remotePatterns: [],
  },
  // Fail fast if critical env vars are missing
  env: {
    SECUREMAX_BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
