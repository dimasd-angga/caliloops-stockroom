
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cf.shopee.co.id',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'bantudagang-media.s3-ap-southeast-1.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.tokopedia.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ecs7.tokopedia.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'sg-test-11.slatic.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'drive.google.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cbu01.alicdn.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'air.1688.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.1688.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.alicdn.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
