export function slugifyTopic(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      // Remove any character that's not a-z, 0-9, space, or hyphen
      .replace(/[^a-z0-9\s-]/g, "")
      // Collapse whitespace into single hyphens
      .replace(/\s+/g, "-")
      // Collapse multiple hyphens
      .replace(/-+/g, "-")
      // Keep slugs reasonably short
      .slice(0, 80) || "untitled"
  );
}


