import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        maroon: {
          DEFAULT: "#790E11",
          700: "#790E11",
          800: "#6B0D10",
          900: "#5E0A0D",
        },
        brandOrange: {
          DEFAULT: "#FC830D",
          500: "#FC830D",
          600: "#E0720A",
        },
        brandAmber: {
          DEFAULT: "#FDAF18",
          50: "#FFF9ED",
          100: "#FFF1D6",
          400: "#FDAF18",
        },
        cream: {
          DEFAULT: "#FEFDF7",
          50: "#FEFDF7",
          100: "#FFF4E3",
          200: "#F6EADB",
        },
        leaf: {
          DEFAULT: "#075828",
          100: "#E3F3E6",
          700: "#075828",
        },
        ink: {
          DEFAULT: "#2A1010",
          700: "#4A3535",
          900: "#2A1010",
        },
        line: "#EAD9CC",
        chili: {
          DEFAULT: "#C63312",
          600: "#C63312",
        },
        primary: {
          DEFAULT: "#790E11",
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#FC830D",
          foreground: "#FFFFFF",
        },
        highlight: {
          DEFAULT: "#FDAF18",
          foreground: "#2A1010",
        },
        danger: {
          DEFAULT: "#C63312",
          foreground: "#FFFFFF",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          subtle: "#FEFDF7",
        },
        content: {
          DEFAULT: "#2A1010",
          muted: "#6B5858",
        },
      },
      borderRadius: {
        card: "8px",
        input: "6px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
