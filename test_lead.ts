
async function testLeadSubmission() {
  const payload = {
    fullName: "Test User",
    phone: "0123456789",
    email: "test@example.com",
    notes: "Testing the lead system",
    roomType: "غرف المعيشة",
    budget: "5,500 - 12,000 EGP",
    style: "مودرن دافئ",
    serviceType: "تصميم وتنفيذ",
    score: 85,
    intent: "buyer"
  };

  console.log("Testing Lead Submission...");
  try {
    const response = await fetch("http://localhost:3000/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("Response:", data);
  } catch (error: any) {
    console.error("Fetch Error:", error.message);
  }
}

testLeadSubmission();
