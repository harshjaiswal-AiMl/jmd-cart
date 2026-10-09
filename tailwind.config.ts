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
        primary: {
          DEFAULT: "#12355B",
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#1B998B",
          foreground: "#FFFFFF",
        },
        highlight: {
          DEFAULT: "#F4A259",
          foreground: "#1F2933",
        },
        danger: {
          DEFAULT: "#C0392B",
          foreground: "#FFFFFF",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          subtle: "#EEF4F8",
        },
        content: {
          DEFAULT: "#1F2933",
          muted: "#52606D",
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
