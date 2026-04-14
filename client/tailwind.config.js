/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--brand-primary, #2563eb)',
          'primary-hover': 'var(--brand-primary-hover, #1d4ed8)',
          secondary: 'var(--brand-secondary, #1e40af)',
        },
      },
    },
  },
  plugins: [],
};
