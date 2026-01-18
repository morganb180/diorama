/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        opendoor: {
          blue: '#0074E4',
          'blue-dark': '#0059B3',
          'blue-light': '#E8F4FF',
        },
        studio: {
          cream: '#FAF8F5',
          paper: '#F5F2ED',
          warm: '#EDE8E0',
          shadow: 'rgba(0, 40, 80, 0.08)',
        },
        style: {
          diorama: '#D4A574',
          simcity: '#4ECDC4',
          simpsons: '#FFD93D',
        }
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'isometric-grid': `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 15L60 45L30 60L0 45L0 15Z' fill='none' stroke='%230074E4' stroke-opacity='0.04' stroke-width='0.5'/%3E%3C/svg%3E")`,
        'grid-dots': `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='10' cy='10' r='1' fill='%230074E4' fill-opacity='0.1'/%3E%3C/svg%3E")`,
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'build': 'build 2s ease-out forwards',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-10px) rotate(1deg)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        build: {
          '0%': { transform: 'scale(0.8) translateY(20px)', opacity: '0' },
          '60%': { transform: 'scale(1.02) translateY(-5px)', opacity: '1' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        'pedestal': '0 30px 60px -15px rgba(0, 40, 80, 0.15), 0 10px 20px -10px rgba(0, 40, 80, 0.1)',
        'card': '0 4px 20px -2px rgba(0, 40, 80, 0.08)',
        'glow': '0 0 40px rgba(0, 116, 228, 0.15)',
      },
    },
  },
  plugins: [],
}
