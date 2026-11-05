const { NextRequest } = await import("next/server");
const r = new NextRequest("http://store.test/api/ai/analyze-vision", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "صف", imageUrl: "https://x.test/a.jpg" }),
});
try {
  const b = await r.json();
  console.log("parsed ok:", JSON.stringify(b).slice(0, 80));
} catch (e) {
  console.log("json() threw:", String(e.message).slice(0, 160));
}
