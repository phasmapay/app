/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ghost: {
          bg: '#0a0a0a',
          card: '#141414',
          border: '#1f1f1f',
          purple: '#9945FF',
          green: '#14F195',
          red: '#FF4747',
          text: '#FFFFFF',
          muted: '#888888',
        },
      },
    },
  },
  plugins: [],
};
