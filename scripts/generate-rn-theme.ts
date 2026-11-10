import fs from "fs";
import path from "path";

const TOKENS_PATH = path.resolve(process.cwd(), "design.tokens.json");
const OUTPUT_PATH = path.resolve(process.cwd(), "apps/customer-mobile/src/theme/tokens.ts");

function generateTheme() {
  if (!fs.existsSync(TOKENS_PATH)) {
    throw new Error(`Design tokens file not found at ${TOKENS_PATH}`);
  }

  const raw = fs.readFileSync(TOKENS_PATH, "utf-8");
  const tokens = JSON.parse(raw);

  const fileContent = `/**
 * AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY
 * Generated from design.tokens.json via scripts/generate-rn-theme.ts
 * Run 'pnpm run generate:theme' to regenerate.
 */

export const THEME_VERSION = "${tokens.version}";

export const colors = ${JSON.stringify(tokens.colors, null, 2)} as const;

export const typography = ${JSON.stringify(tokens.typography, null, 2)} as const;

export const spacing = ${JSON.stringify(tokens.spacing, null, 2)} as const;

export const borderRadius = ${JSON.stringify(tokens.borderRadius, null, 2)} as const;

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
} as const;

export type Theme = typeof theme;
export default theme;
`;

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, fileContent, "utf-8");
  console.log(`[generate-rn-theme] Theme successfully generated at ${OUTPUT_PATH}`);
}

generateTheme();
