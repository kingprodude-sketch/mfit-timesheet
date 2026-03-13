/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['canvas', 'pdfjs-dist', 'xlsx']
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false
    return config
  }
}
module.exports = nextConfig
