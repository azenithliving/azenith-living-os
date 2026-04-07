import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCurrentTenant } from "@/lib/tenant";

export type BookingRequest = {
  sessionId: string;
  fullName: string;
  phone: string;
  email?: string;
  preferredDate: string;
  preferredTime: string;
  roomType: string;
  budget: string;
  style: string;
  serviceType: string;
  notes?: string;
};

export async function POST(request: Request) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json(
        { ok: false, message: "Tenant not configured" },
        { status: 400 }
      );
    }

    const body: BookingRequest = await request.json();
    const supabase = getSupabaseAdminClient();

    // First, get or create the user
    const { data: existingUser, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("company_id", tenant.id)
      .eq("session_id", body.sessionId)
      .maybeSingle();

    if (userError) {
      throw new Error(`Failed to look up user: ${userError.message}`);
    }

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create new user
      const { data: newUser, error: createUserError } = await supabase
        .from("users")
        .insert({
          company_id: tenant.id,
          session_id: body.sessionId,
          room_type: body.roomType,
          budget: body.budget,
          style: body.style,
          service_type: body.serviceType,
        })
        .select("id")
        .single();

      if (createUserError) {
        throw new Error(`Failed to create user: ${createUserError.message}`);
      }
      userId = newUser.id;
    }

    // Create the booking request
    const { data: booking, error: bookingError } = await supabase
      .from("requests")
      .insert({
        company_id: tenant.id,
        user_id: userId,
        room_type: body.roomType,
        budget: body.budget,
        style: body.style,
        service_type: body.serviceType,
        status: "new",
      })
      .select("id")
      .single();

    if (bookingError) {
      throw new Error(`Failed to create booking: ${bookingError.message}`);
    }

    // Create booking metadata (we'll add a bookings table later if needed)
    const { error: eventError } = await supabase
      .from("events")
      .insert({
        company_id: tenant.id,
        user_id: userId,
        type: "booking_request",
        value: "consultation",
        metadata: {
          fullName: body.fullName,
          phone: body.phone,
          email: body.email,
          preferredDate: body.preferredDate,
          preferredTime: body.preferredTime,
          notes: body.notes,
          requestId: booking.id,
        },
      });

    if (eventError) {
      console.error("Failed to log booking event:", eventError);
      // Don't fail the request for logging errors
    }

    return NextResponse.json({
      ok: true,
      bookingId: booking.id,
      message: "Booking request submitted successfully",
    });
  } catch (error) {
    console.error("Booking API error:", error);
    return NextResponse.json(
      { ok: false, message: "Failed to submit booking request" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json(
        { ok: false, message: "Tenant not configured" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();

    // Get bookings with user info
    const { data: bookings, error } = await supabase
      .from("requests")
      .select(`
        id,
        room_type,
        budget,
        style,
        service_type,
        status,
        created_at,
        user_id
      `)
      .eq("company_id", tenant.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch bookings: ${error.message}`);
    }

    // Get user details for each booking
    const userIds = bookings?.map(b => b.user_id).filter(Boolean) || [];
    const { data: users } = await supabase
      .from("users")
      .select("id, session_id")
      .in("id", userIds);

    // Get events for booking metadata
    const requestIds = bookings?.map(b => b.id) || [];
    const { data: events } = await supabase
      .from("events")
      .select("metadata")
      .eq("company_id", tenant.id)
      .eq("type", "booking_request")
      .in("metadata->>requestId", requestIds);

    const userMap = new Map(users?.map(u => [u.id, u]) || []);
    const eventMap = new Map(events?.map(e => [e.metadata?.requestId, e]) || []);

    // Transform the data
    const transformedBookings = bookings?.map(booking => {
      const user = userMap.get(booking.user_id);
      const event = eventMap.get(booking.id);

      return {
        id: booking.id,
        roomType: booking.room_type,
        budget: booking.budget,
        style: booking.style,
        serviceType: booking.service_type,
        status: booking.status,
        createdAt: booking.created_at,
        userId: user?.id,
        sessionId: user?.session_id,
        fullName: event?.metadata?.fullName,
        phone: event?.metadata?.phone,
        email: event?.metadata?.email,
        preferredDate: event?.metadata?.preferredDate,
        preferredTime: event?.metadata?.preferredTime,
        notes: event?.metadata?.notes,
      };
    });

    return NextResponse.json({
      ok: true,
      bookings: transformedBookings,
    });
  } catch (error) {
    console.error("Fetch bookings error:", error);
    return NextResponse.json(
      { ok: false, message: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}