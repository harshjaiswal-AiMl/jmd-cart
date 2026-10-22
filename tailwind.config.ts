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
        // Stitch Design Tokens (Primary Brand Theme)
        primary: {
          DEFAULT: "#5c0c1e",
          container: "#7a2433",
          fixed: "#ffdadc",
          "fixed-dim": "#ffb2b9",
          foreground: "#FFFFFF",
        },
        "on-primary": {
          DEFAULT: "#ffffff",
          container: "#ff909c",
          fixed: "#40000f",
          "fixed-variant": "#7f2836",
        },
        secondary: {
          DEFAULT: "#914d00",
          container: "#fc9430",
          fixed: "#ffdcc3",
          "fixed-dim": "#ffb77d",
          foreground: "#FFFFFF",
        },
        "on-secondary": {
          DEFAULT: "#ffffff",
          container: "#663500",
          fixed: "#2f1500",
          "fixed-variant": "#6e3900",
        },
        tertiary: {
          DEFAULT: "#003612",
          container: "#004f1e",
          fixed: "#9cf7a7",
          "fixed-dim": "#81da8d",
          foreground: "#FFFFFF",
        },
        "on-tertiary": {
          DEFAULT: "#ffffff",
          container: "#6bc379",
          fixed: "#002108",
          "fixed-variant": "#005320",
        },
        surface: {
          DEFAULT: "#fcf9f8",
          dim: "#dcd9d9",
          bright: "#fcf9f8",
          subtle: "#fcf9f8",
          variant: "#e4e2e1",
          container: "#f0eded",
          "container-lowest": "#ffffff",
          "container-low": "#f6f3f2",
          "container-high": "#eae7e7",
          "container-highest": "#e4e2e1",
        },
        "on-surface": {
          DEFAULT: "#1b1c1c",
          variant: "#554243",
        },
        outline: {
          DEFAULT: "#887273",
          variant: "#dbc0c1",
        },
        error: {
          DEFAULT: "#ba1a1a",
          container: "#ffdad6",
        },
        "on-error": {
          DEFAULT: "#ffffff",
          container: "#93000a",
        },

        // Legacy / Staff Dashboard Tokens (Backward Compatibility)
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
        content: {
          DEFAULT: "#2A1010",
          muted: "#6B5858",
        },
      },
      spacing: {
        "space-xs": "0.25rem",
        "space-sm": "0.5rem",
        "space-md": "0.75rem",
        "space-lg": "1rem",
        "space-xl": "1.5rem",
        margin: "1rem",
        "margin-desktop": "2rem",
        gutter: "0.75rem",
        "gutter-desktop": "1.25rem",
      },
      borderRadius: {
        card: "8px",
        input: "6px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        headline: ["var(--font-epilogue)", "Epilogue", "sans-serif"],
        body: ["var(--font-inter)", "Inter", "sans-serif"],
        "headline-lg-mobile": ["var(--font-epilogue)", "Epilogue", "sans-serif"],
        "headline-lg": ["var(--font-epilogue)", "Epilogue", "sans-serif"],
        "headline-md": ["var(--font-epilogue)", "Epilogue", "sans-serif"],
        "headline-sm": ["var(--font-epilogue)", "Epilogue", "sans-serif"],
        "body-lg": ["var(--font-inter)", "Inter", "sans-serif"],
        "body-md": ["var(--font-inter)", "Inter", "sans-serif"],
        "body-sm": ["var(--font-inter)", "Inter", "sans-serif"],
        "label-lg": ["var(--font-inter)", "Inter", "sans-serif"],
        "label-md": ["var(--font-inter)", "Inter", "sans-serif"],
        "label-sm": ["var(--font-inter)", "Inter", "sans-serif"],
        "price-lg": ["var(--font-inter)", "Inter", "sans-serif"],
        "price-md": ["var(--font-inter)", "Inter", "sans-serif"],
      },
      fontSize: {
        "headline-lg-mobile": ["24px", { lineHeight: "32px", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "40px", fontWeight: "700" }],
        "body-sm": ["12px", { lineHeight: "16px", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "price-md": ["15px", { lineHeight: "18px", fontWeight: "700" }],
        "label-sm": ["11px", { lineHeight: "14px", letterSpacing: "0.02em", fontWeight: "700" }],
        "label-lg": ["14px", { lineHeight: "18px", fontWeight: "600" }],
        "headline-sm": ["16px", { lineHeight: "22px", fontWeight: "600" }],
        "label-md": ["12px", { lineHeight: "16px", fontWeight: "600" }],
        "headline-md": ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "price-lg": ["18px", { lineHeight: "22px", fontWeight: "700" }],
      },
    },
  },
  plugins: [],
};

export default config;
