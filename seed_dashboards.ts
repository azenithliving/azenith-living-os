import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

async function seed() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log("Seeding operational data...");

  // 1. Seed Orders
  const { data: orders, error: ordersErr } = await supabase.from("orders").insert([
    { status: "processing", total_amount: 15000, customer_name: "أحمد منصور", items: [{ name: "طاولة خشب طبيعي", price: 15000 }] },
    { status: "delivered", total_amount: 25000, customer_name: "ليلى حسن", items: [{ name: "كنبة قطيفة", price: 25000 }] },
    { status: "pending", total_amount: 12000, customer_name: "عمر خالد", items: [{ name: "كرسي أزينث", price: 12000 }] }
  ]).select();

  if (ordersErr) console.error("Orders Seed Error:", ordersErr.message);
  else console.log("Orders Seeded:", orders?.length);

  // 2. Seed Customer Leads
  const { data: leads, error: leadsErr } = await supabase.from("customer_leads").insert([
    { name: "سارة محمود", email: "sara@example.com", phone: "201091234567", status: "new", score: 85, context: { interest: "Modern Living Rooms" } },
    { name: "كريم يوسف", email: "karim@example.com", phone: "201159876543", status: "contacted", score: 40, context: { interest: "Classic Furniture" } }
  ]).select();

  if (leadsErr) console.error("Leads Seed Error:", leadsErr.message);
  else console.log("Leads Seeded:", leads?.length);

  console.log("Seeding complete.");
}

seed();
