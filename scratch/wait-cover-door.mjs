/**
 * Waiting for the build that lets the storefront ask for the five new rooms.
 *
 * The door's own answer is the marker: `bathroom` only appears when the deployed code knows
 * `BANK_ROOM_ONLY_TYPES`, and the old build could not print it however full the bank is.
 *
 *   node scratch/wait-cover-door.mjs
 */
const BASE = "https://azenith-living.vercel.app";

for (let attempt = 0; attempt < 40; attempt++) {
  try {
    const res = await fetch(`${BASE}/api/room-covers`, { cache: "no-store" });
    const body = await res.json();
    const styles = Object.keys(body.covers ?? {});
    const cells = Object.values(body.covers ?? {}).reduce((n, set) => n + Object.keys(set).length, 0);
    const modern = body.covers?.modern ?? {};
    const six = ["guest-bedroom", "home-office", "study-room", "bathroom", "guest-bathroom", "entrance-lobby"];
    const answered = six.filter((room) => modern[room]);
    console.log(`محاول ${attempt + 1}: غرف ${body.rooms} · خلايا ${cells} · طرازات ${styles.length} · الستة في مودرن: ${answered.length} (${answered.join(" ") || "—"})`);
    if (answered.length >= 5) {
      console.log("الباب بيجاوب الغرف الجديدة — النسخة دي شغالة");
      process.exit(0);
    }
  } catch (e) {
    console.log(`محاول ${attempt + 1}: الباب ما ردّش — ${String(e).slice(0, 90)}`);
  }
  await new Promise((r) => setTimeout(r, 20000));
}
console.log("العلامة ما ظهرتش — القياس اللي جاي على النسخة القديمة");
process.exit(1);
