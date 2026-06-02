/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        darkBg: "#111111",
        darkCard: "#1B1B1B",
        darkBorder: "#303030",
        eyYellow: "#FFE600",
        accentHover: "#FFD500",
        primaryText: "#F5F5F5",
        secondaryText: "#B0B0B0",
        charcoal: {
          950: "#090a0c",
          900: "#111317",
          850: "#171a20",
          800: "#1f232b",
          700: "#2b303a"
        },
        accent: {
          500: "#f4c84a",
          400: "#f7d56d",
          300: "#f9e08e"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(244, 200, 74, 0.16), 0 24px 60px rgba(0,0,0,0.34)"
      }
    }
  },
  plugins: []
};
