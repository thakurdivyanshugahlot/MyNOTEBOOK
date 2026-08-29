/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#141414",
        paper: "#faf9f6",
        accent: "#e07a3f",
      },
    },
  },
  plugins: [],
};
