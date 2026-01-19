/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark mode palette
        void: {
          DEFAULT: '#0A0A0A',
          50: '#0D0D0D',
          100: '#111111',
          200: '#1A1A1A',
          300: '#242424',
          400: '#2E2E2E',
        },
        // Accent - Opendoor inspired but more vibrant
        accent: {
          DEFAULT: '#0074E4',
          bright: '#00A3FF',
          glow: 'rgba(0, 116, 228, 0.5)',
          soft: 'rgba(0, 116, 228, 0.15)',
        },
        // Secondary accent - coral/orange for variety
        coral: {
          DEFAULT: '#FF6B4A',
          bright: '#FF8A70',
          glow: 'rgba(255, 107, 74, 0.5)',
        },
        // Legacy support
        opendoor: {
          blue: '#0074E4',
          'blue-dark': '#0059B3',
          'blue-light': '#E8F4FF',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'dot-pulse': 'dot-pulse 1.5s ease-in-out infinite',
        'scan': 'scan 3s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.8', filter: 'brightness(1.2)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'dot-pulse': {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.6' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      boxShadow: {
        'glow-sm': '0 0 20px rgba(0, 116, 228, 0.3)',
        'glow': '0 0 40px rgba(0, 116, 228, 0.4)',
        'glow-lg': '0 0 60px rgba(0, 116, 228, 0.5)',
        'glow-coral': '0 0 40px rgba(255, 107, 74, 0.4)',
      },
    },
  },
  plugins: [],
}
