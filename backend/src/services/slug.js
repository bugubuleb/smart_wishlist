export function makeWishlistSlug(title) {
  const normalized = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const suffix = Math.random().toString(36).slice(2, 8);
  return `${normalized || "wishlist"}-${suffix}`;
}
