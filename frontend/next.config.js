/** @type {import('next').NextConfig} */
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

// Parse backend host for remotePatterns (supports http and https)
const backendUrlObj = new URL(BACKEND_URL);

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: backendUrlObj.protocol.replace(':', ''),
        hostname: backendUrlObj.hostname,
        ...(backendUrlObj.port ? { port: backendUrlObj.port } : {}),
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: '/tmp/:path*',
        destination: `${BACKEND_URL}/tmp/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
