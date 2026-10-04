import { Archivo, Hanken_Grotesk, Spline_Sans_Mono } from 'next/font/google';

// Type for the storefront: a wide display face, a quiet body face and a mono for small labels.
// The display face is set wide and heavy, which the automatic fallback does not match; koru.css supplies a width-matched fallback instead.
export const koruDisplay = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-koru-display', display: 'swap', adjustFontFallback: false });
export const koruBody = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-koru-body', display: 'swap' });
export const koruMono = Spline_Sans_Mono({ subsets: ['latin'], variable: '--font-koru-mono', display: 'swap' });
