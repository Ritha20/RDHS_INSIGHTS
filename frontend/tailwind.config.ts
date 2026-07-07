import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        nisr: {
          navy: '#1B3C74',
          'navy-dark': '#0D2550',
          'navy-light': '#2A509A',
          cyan: '#0099D4',
          'cyan-dark': '#0077A8',
          'cyan-light': '#4AB8E0',
          sky: '#E8F4FB',
        },
        rwanda: {
          green: '#1B3C74',
          'green-dark': '#0D2550',
          'green-light': '#0099D4',
          blue: '#0099D4',
          amber: '#f59e0b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Layered elevation scale for the report-builder chrome.
        'elev-1': '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
        'elev-2': '0 4px 12px -2px rgba(15,23,42,0.08), 0 2px 6px -2px rgba(15,23,42,0.06)',
        'elev-3': '0 12px 28px -6px rgba(15,23,42,0.14), 0 6px 12px -6px rgba(15,23,42,0.08)',
        'elev-4': '0 24px 48px -12px rgba(15,23,42,0.22), 0 12px 24px -8px rgba(15,23,42,0.12)',
        glow: '0 0 0 1px rgba(0,153,212,0.15), 0 8px 24px -6px rgba(0,153,212,0.35)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(0,153,212,0.0)' },
          '50%': { opacity: '0.85', boxShadow: '0 0 0 6px rgba(0,153,212,0.12)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'flow-dash': {
          '0%': { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' },
        },
      },
      animation: {
        shimmer: 'shimmer 2.2s linear infinite',
        'glow-pulse': 'glow-pulse 1.8s ease-in-out infinite',
        'slide-up': 'slide-up 0.25s cubic-bezier(0.4,0,0.2,1)',
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.18s cubic-bezier(0.4,0,0.2,1)',
        'flow-dash': 'flow-dash 1s linear infinite',
      },
      backgroundImage: {
        'grid-slate': 'linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)',
        'shimmer-band': 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
      },
    },
  },
  plugins: [],
}

export default config
