import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#080808',
        surface: '#111111',
        border: '#1f1f1f',
        gold: '#F5C518',
        'gold-dim': '#b8941a',
        muted: '#555555',
        danger: '#ef4444',
        success: '#22c55e',
        warn: '#eab308',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Bebas Neue', 'sans-serif'],
      },
      backgroundImage: {
        'gold-glow': 'radial-gradient(ellipse at center, #F5C51820, transparent 70%)',
      },
      animation: {
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
      keyframes: {
        'pulse-gold': {
          '0%, 100%': { borderColor: '#F5C518', boxShadow: '0 0 0 0 #F5C51840' },
          '50%': { borderColor: '#F5C518', boxShadow: '0 0 20px 4px #F5C51840' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
