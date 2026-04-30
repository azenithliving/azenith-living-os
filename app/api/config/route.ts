import { NextResponse } from "next/server";
import { getRuntimeConfig } from "@/lib/runtime-config";

export async function GET() {
  try {
    const config = await getRuntimeConfig();
    return NextResponse.json(config);
  } catch {
    // Return minimal config if runtime config fails
    return NextResponse.json({
      brandName: "Azenith Living",
      brandNameAr: "أزينث ليفينج",
      whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || null,
      primaryColor: "#C5A059",
    });
  }
}
