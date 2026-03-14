/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['xlsx']
  },
  webpack: (config) => {
    config.resolve.alias['pdfjs-dist'] = 'pdfjs-dist/legacy/build/pdf.js'
    return config
  }
}
module.exports = nextConfig
