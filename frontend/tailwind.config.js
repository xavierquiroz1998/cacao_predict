/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        cacao: {
          50: '#fdf8f0',
          100: '#f9eddb',
          200: '#f2d7b0',
          300: '#e9bc7e',
          400: '#df9a4a',
          500: '#d4802a',
          600: '#b86420',
          700: '#974b1d',
          800: '#7b3d1f',
          900: '#66341d',
        },
      },
    },
  },
  plugins: [],
};
