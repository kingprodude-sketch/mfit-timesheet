/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf2pic', 'sharp', 'xlsx']
  }
}
module.exports = nextConfig
