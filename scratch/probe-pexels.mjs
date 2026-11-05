const keys = (process.env.PEXELS_KEYS || "").split(",").map(s=>s.trim()).filter(Boolean);
console.log("مفاتيح الصور: " + keys.length);
const k = keys[0];
const r = await fetch("https://api.pexels.com/v1/search?query=luxury%20guest%20bedroom&per_page=3", { headers: { Authorization: k } });
console.log("رد المزود: " + r.status);
const j = await r.json().catch(()=>null);
console.log("صور: " + (j?.photos?.length ?? 0) + " | الأولى: " + (j?.photos?.[0]?.src?.large ?? "—").slice(0, 60) + " | أبعاد: " + (j?.photos?.[0] ? j.photos[0].width + "x" + j.photos[0].height : "—"));
