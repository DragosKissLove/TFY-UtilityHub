/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: 'var(--accent)',
        'accent-light': 'var(--accent-strong)',
        'accent-dark': 'color-mix(in srgb, var(--accent) 70%, black)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
