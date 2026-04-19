const GEMINI_API_KEY = 'AIzaSyBRMnRCXpwUvWVk4XI8pLCJbWiA_ccPNVw';

async function testGemini() {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say "API test successful" in Arabic' }] }]
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.log('❌ Gemini API Error:', response.status);
      console.log(error.substring(0, 200));
      process.exit(1);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
    console.log('✅ Gemini API Working!');
    console.log('Response:', text);
  } catch (err) {
    console.log('❌ Error:', err.message);
    process.exit(1);
  }
}

testGemini();
