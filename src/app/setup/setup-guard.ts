export function validateSetupToken(
  token?: string | string[],
  expectedToken: string = process.env.SETUP_TOKEN || "",
  nodeEnv: string = process.env.NODE_ENV || "development"
): { allowed: boolean; status?: number } {
  if (nodeEnv !== "production" || !expectedToken || expectedToken.trim() === "") {
    return { allowed: true };
  }
  const actual = Array.isArray(token) ? token[0] : token;
  if (actual !== expectedToken) {
    return { allowed: false, status: 404 };
  }
  return { allowed: true };
}
