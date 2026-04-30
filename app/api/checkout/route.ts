import { NextRequest, NextResponse } from "next/server";

import { createCheckoutSession, createOrUpdateCustomer } from "@/lib/payments";
import { getCurrentTenant } from "@/lib/tenant";

export async function POST(request: NextRequest) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json(
        { ok: false, message: "Tenant not configured" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { planId, successUrl, cancelUrl, email, name } = body;

    // Create or update Stripe customer
    const customer = await createOrUpdateCustomer(
      email || tenant.domain,
      name || tenant.name
    );

    // Create checkout session
    const session = await createCheckoutSession(
      customer.id,
      planId,
      successUrl || `${new URL(request.url).origin}/dashboard/billing?success=true`,
      cancelUrl || `${new URL(request.url).origin}/dashboard/billing?cancelled=true`
    );

    return NextResponse.json({
      ok: true,
      checkoutUrl: session.url,
      sessionId: session.id
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { ok: false, message: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}