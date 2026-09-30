import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b0b0c', paper: '#ffffff', bone: '#f5f4f0', line: '#e4e2dc', mute: '#6b6b70',
        gold: { DEFAULT: '#e6b422', deep: '#b98a00', soft: '#fff4cc' },
      },
      fontFamily: { display: ['var(--font-display)', 'Arial Black', 'sans-serif'], sans: ['var(--font-body)', 'system-ui', 'sans-serif'] },
      letterSpacing: { tightest: '-0.05em' },
    },
  },
  plugins: [],
} satisfies Config;
