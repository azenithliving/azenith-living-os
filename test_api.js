const fetch = require('node-fetch'); // Use native fetch in Node 18+

async function test() {
  const res = await fetch("https://azenith-living-os.vercel.app/api/consultant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Hello",
      sessionId: null,
      history: []
    })
  });
  const data = await res.json();
  console.log(data);
}

test();
