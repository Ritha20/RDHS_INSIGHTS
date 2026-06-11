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
    },
  },
  plugins: [],
}

export default config
