/**
 * AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY
 * Generated from design.tokens.json via scripts/generate-rn-theme.ts
 * Run 'pnpm run generate:theme' to regenerate.
 */

export const THEME_VERSION = "1.0.0";

export const colors = {
  "primary": {
    "default": "#5c0c1e",
    "container": "#7a2433",
    "fixed": "#ffdadc",
    "fixedDim": "#ffb2b9",
    "foreground": "#ffffff"
  },
  "secondary": {
    "default": "#914d00",
    "container": "#fc9430",
    "fixed": "#ffdcc3",
    "fixedDim": "#ffb77d",
    "foreground": "#ffffff"
  },
  "tertiary": {
    "default": "#003612",
    "container": "#004f1e",
    "fixed": "#9cf7a7",
    "fixedDim": "#81da8d",
    "foreground": "#ffffff"
  },
  "surface": {
    "default": "#fcf9f8",
    "dim": "#dcd9d9",
    "bright": "#fcf9f8",
    "variant": "#e4e2e1",
    "container": "#f0eded",
    "containerLowest": "#ffffff",
    "containerLow": "#f6f3f2",
    "containerHigh": "#eae7e7",
    "containerHighest": "#e4e2e1"
  },
  "onSurface": {
    "default": "#1b1c1c",
    "variant": "#554243"
  },
  "outline": {
    "default": "#887273",
    "variant": "#dbc0c1"
  },
  "error": {
    "default": "#ba1a1a",
    "container": "#ffdad6"
  },
  "onError": {
    "default": "#ffffff",
    "container": "#93000a"
  },
  "maroon": "#790E11",
  "orange": "#FC830D",
  "amber": "#FDAF18",
  "leaf": "#075828",
  "cream": "#FFF9F1"
} as const;

export const typography = {
  "fontFamilyHeadline": "Epilogue",
  "fontFamilyBody": "Inter",
  "sizes": {
    "xs": 12,
    "sm": 14,
    "base": 16,
    "lg": 18,
    "xl": 20,
    "2xl": 24,
    "3xl": 30
  }
} as const;

export const spacing = {
  "xs": 4,
  "sm": 8,
  "md": 12,
  "lg": 16,
  "xl": 24,
  "2xl": 32
} as const;

export const borderRadius = {
  "sm": 6,
  "md": 8,
  "lg": 12,
  "xl": 16,
  "full": 9999
} as const;

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
} as const;

export type Theme = typeof theme;
export default theme;
