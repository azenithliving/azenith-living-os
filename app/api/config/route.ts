import { NextResponse } from "next/server";
import { getRuntimeConfig } from "@/lib/runtime-config";

export async function GET() {
  try {
    const config = await getRuntimeConfig();
    return NextResponse.json(config);
  } catch {
    // Degraded, and honest about it: the number is not guessed from a build-time variable here,
    // because that is how a customer ended up with a number that is not the store's. A surface that
    // gets null keeps its fallback (the request page) instead of opening a stranger's chat.
    return NextResponse.json({
      brandName: "Azenith Living",
      brandNameAr: "أزينث ليفينج",
      whatsappNumber: null,
      primaryColor: "#C5A059",
      degraded: true,
    });
  }
}
