/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: { formats: ['image/webp'], minimumCacheTTL: 31536000, remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/object/public/**' }] },
  experimental: { serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs', 'exceljs', 'nodemailer'] },
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ] }];
  },
};
export default nextConfig;
