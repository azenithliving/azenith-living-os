import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCurrentTenant } from "@/lib/tenant";
import { processAutomation } from "@/lib/automation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json(
        { ok: false, message: "Tenant not configured" },
        { status: 400 }
      );
    }

    const { id: bookingId } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !["accepted", "rejected", "new"].includes(status)) {
      return NextResponse.json(
        { ok: false, message: "Invalid status" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error('Supabase not initialized');

    // Get current booking status before update
    const { data: currentBooking } = await supabase
      .from("requests")
      .select("status, user_id, room_type, budget, style, service_type")
      .eq("id", bookingId)
      .eq("company_id", tenant.id)
      .single();

    if (!currentBooking) {
      return NextResponse.json(
        { ok: false, message: "Booking not found" },
        { status: 404 }
      );
    }

    // Update the booking status
    const { error } = await supabase
      .from("requests")
      .update({ status })
      .eq("id", bookingId)
      .eq("company_id", tenant.id);

    if (error) {
      throw new Error(`Failed to update booking: ${error.message}`);
    }

    // Trigger automation if status changed
    if (currentBooking.status !== status) {
      await processAutomation({
        type: "booking_status_changed",
        bookingId: bookingId,
        oldStatus: currentBooking.status,
        newStatus: status,
        bookingData: currentBooking
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Booking status updated successfully",
    });
  } catch (error) {
    console.error("Update booking error:", error);
    return NextResponse.json(
      { ok: false, message: "Failed to update booking" },
      { status: 500 }
    );
  }
}