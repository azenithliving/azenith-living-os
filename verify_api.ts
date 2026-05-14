import axios from 'axios';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function verify() {
  const companyId = "dbb9b420-f2ec-4dd3-88d6-4d1a9a74364d";
  const baseUrl = "http://127.0.0.1:3000";

  console.log("Verifying Admin Dashboard API...");
  
  try {
    // 1. Check Owner Dashboard
    const dashboardRes = await axios.get(`${baseUrl}/api/admin/owner/dashboard?company_id=${companyId}`);
    console.log("Dashboard Status:", dashboardRes.status);
    console.log("Dashboard Data (Monthly):", JSON.stringify(dashboardRes.data.data.this_month));
    console.log("Dashboard Data (Today):", JSON.stringify(dashboardRes.data.data.today));

    // 2. Check Leads
    const leadsRes = await axios.get(`${baseUrl}/api/admin/leads`);
    const leads = leadsRes.data.leads || [];
    console.log("Leads Count:", leads.length);
    const testLead = leads.find((l: any) => l.name === "أحمد");
    console.log("Found Seeded Lead 'أحمد':", !!testLead);

  } catch (err: any) {
    console.error("Verification Error:", err.message);
    if (err.response) {
      console.error("Response Body:", JSON.stringify(err.response.data));
    }
  }
}

verify();
