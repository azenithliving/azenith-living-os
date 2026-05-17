const testPexels = async () => {
  try {
    const res = await fetch("http://localhost:3000/api/pexels?query=luxury&per_page=1");
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);
  } catch (e) {
    console.error("Fetch failed:", e);
  }
};
testPexels();
