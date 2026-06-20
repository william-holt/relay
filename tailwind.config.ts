import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          DEFAULT: "#0c1322",
          800: "#141d30",
          700: "#1c2740",
          600: "#27324d",
        },
        canvas: "#f6f7f9",
        accent: {
          DEFAULT: "#4f46e5",
          hover: "#4338ca",
          soft: "#eef2ff",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
        pop: "0 8px 28px rgba(16, 24, 40, 0.12)",
      },
      borderRadius: {
        xl: "0.875rem",
      },
    },
  },
  plugins: [],
};

export default config;
