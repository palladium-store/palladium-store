import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111111', paper: '#ffffff', bone: '#f6f6f6', line: '#e8e8e8', mute: '#6b6b70',
        gold: { DEFAULT: '#f2cf46', deep: '#f2cf46', soft: '#fdf6dc' },
      },
      fontFamily: { display: ['var(--font-body)', 'system-ui', 'sans-serif'], sans: ['var(--font-body)', 'system-ui', 'sans-serif'] },
      letterSpacing: { tightest: '-0.03em' },
    },
  },
  plugins: [],
} satisfies Config;
