/**
 * A planted bad screen — the exact shape that shipped on the owner's dashboard.
 * The Arabic guard test reads this file to prove its detector can catch the defect; it is never
 * mounted, and it lives outside the scanned trees on purpose.
 */
export function GlossedScreenFixture() {
  return (
    <div>
      <h3>ذكاء الإنتاج (Production Intel)</h3>
    </div>
  );
}
