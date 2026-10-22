/**
 * Slug generation and normalization utilities
 */

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, "-") // Replace spaces and non-word chars with -
    .replace(/^-+|-+$/g, ""); // Remove leading and trailing -
}

export async function generateUniqueSlug(
  baseName: string,
  checkExists: (slug: string) => Promise<boolean>,
  currentId?: string
): Promise<string> {
  const base = slugify(baseName) || "item";
  let slug = base;
  let counter = 1;

  while (await checkExists(slug)) {
    counter++;
    slug = `${base}-${counter}`;
  }

  return slug;
}
