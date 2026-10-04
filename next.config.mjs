/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: { formats: ['image/webp'], minimumCacheTTL: 31536000, remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/object/public/**' }] },
  experimental: { serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs', 'exceljs', 'nodemailer'] },
  // The KORU landing page is a self-contained static page in public/koru; this gives it the clean /koru address.
  async rewrites() {
    return [{ source: '/koru', destination: '/koru/index.html' }];
  },
  // The About and Returns pages were removed; old links land on the homepage instead of a 404.
  async redirects() {
    return [
      { source: '/pages/about', destination: '/', permanent: false },
      { source: '/pages/returns', destination: '/', permanent: false },
    ];
  },
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
      // Partial CSP: blocks framing, plugins, base-tag and cross-site form hijacking without touching scripts/styles (Next.js needs inline scripts).
      { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'" },
    ] }];
  },
};
export default nextConfig;
