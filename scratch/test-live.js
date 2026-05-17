const testLive = async () => {
  try {
    const res = await fetch("https://azenith-living-os.vercel.app/api/pexels?query=luxury&per_page=1");
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);
  } catch (e) {
    console.error("Fetch failed:", e);
  }
};
testLive();
