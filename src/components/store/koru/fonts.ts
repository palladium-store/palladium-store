import { Archivo, Hanken_Grotesk, Spline_Sans_Mono } from 'next/font/google';

// Type for the KORU look: a wide display face, a quiet body face and a mono for small labels.
// Not preloaded: only the routes that wear the look use them, so every other page skips the download.
export const koruDisplay = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-koru-display', display: 'swap', preload: false });
export const koruBody = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-koru-body', display: 'swap', preload: false });
export const koruMono = Spline_Sans_Mono({ subsets: ['latin'], variable: '--font-koru-mono', display: 'swap', preload: false });
