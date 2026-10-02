/** Zero-based page indices; null marks a gap between visible pages. */
export function foodPageRange(current: number, total: number): Array<number | null> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);

  const start = Math.max(1, Math.min(current - 1, total - 4));
  const pages: Array<number | null> = [0];
  if (start > 1) pages.push(null);
  for (let page = start; page < start + 3; page++) pages.push(page);
  if (start + 3 < total - 1) pages.push(null);
  pages.push(total - 1);
  return pages;
}
