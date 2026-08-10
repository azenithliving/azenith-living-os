// Deterministic, SAFE page generator for consistent image fetching per room+style.
// Always returns a page in the [1, MAX_SAFE_PAGE] range so Pexels never returns
// an empty result due to over-pagination.

const MAX_SAFE_PAGE = 80;
const MIN_SAFE_PAGE = 1;

export function getSafeDeterministicPage(room: string, style: string): number {
  let hash = 0;
  const str = `${room}-${style}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return (Math.abs(hash) % MAX_SAFE_PAGE) + MIN_SAFE_PAGE;
}
