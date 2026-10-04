import { Archivo, Hanken_Grotesk, Spline_Sans_Mono } from 'next/font/google';

// Type for the storefront: a wide display face, a quiet body face and a mono for small labels.
export const koruDisplay = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-koru-display', display: 'swap' });
export const koruBody = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-koru-body', display: 'swap' });
export const koruMono = Spline_Sans_Mono({ subsets: ['latin'], variable: '--font-koru-mono', display: 'swap' });
