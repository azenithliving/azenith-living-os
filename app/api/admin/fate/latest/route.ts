import { NextResponse } from "next/server";

// Kept as a harmless compatibility response for old clients. No visitor sees
// a fabricated sales prompt based on this endpoint anymore.
export async function GET() {
  return NextResponse.json({ action: null, retired: true });
}
