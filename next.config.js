/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['canvas', 'tesseract.js']
  },
  api: {
    bodyParser: false,
    responseLimit: '50mb',
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    return config;
  },
}

module.exports = nextConfig
