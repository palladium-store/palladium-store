import type { Metadata, Viewport } from 'next';
import { Archivo_Black, Montserrat } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/toast';

const display = Archivo_Black({ weight: '400', subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Montserrat({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: 'Palladium | Premium Pickleball Equipment Philippines', template: '%s | Palladium' },
  description: 'Premium pickleball paddles, balls, grips and accessories designed in New Zealand. Shop Palladium with nationwide delivery in the Philippines.',
  openGraph: { type: 'website', siteName: 'Palladium', locale: 'en_PH', images: ['/products/logo.webp'] },
  twitter: { card: 'summary_large_image' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b0b0c' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-PH" className={`${display.variable} ${body.variable}`}>
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
