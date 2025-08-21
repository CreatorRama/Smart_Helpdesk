/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // <-- scans all React components
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
