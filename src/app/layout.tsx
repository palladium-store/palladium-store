import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';
import './koru.css';
import { Suspense } from 'react';
import { ToastProvider } from '@/components/ui/toast';
import { NavProgress } from '@/components/store/nav-progress';

// Only the admin uses Manrope now (the storefront has its own type, see koru/fonts.ts), so it is not preloaded on every page.
const body = Manrope({ subsets: ['latin'], variable: '--font-body', display: 'swap', preload: false });
const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: 'Palladium | Premium Pickleball Equipment Philippines', template: '%s | Palladium' },
  description: 'Premium pickleball paddles, balls, grips and accessories designed in New Zealand. Shop Palladium with nationwide delivery in the Philippines.',
  openGraph: { type: 'website', siteName: 'Palladium', locale: 'en_PH', images: ['/products/logo.webp'] },
  twitter: { card: 'summary_large_image' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#111111' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-PH" className={body.variable}>
      <body><Suspense fallback={null}><NavProgress /></Suspense><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
