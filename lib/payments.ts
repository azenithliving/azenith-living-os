import Stripe from "stripe";

type StripeApiVersion = "2024-12-18.acpi.20250102";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acpi.20250102" as StripeApiVersion,
    })
  : null;

export interface PaymentPlan {
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval: "month" | "year";
  features: string[];
}

export const PAYMENT_PLANS: Record<string, PaymentPlan> = {
  free: {
    id: "free",
    name: "مجاني",
    amount: 0,
    currency: "SAR",
    interval: "month",
    features: [
      "عدد محدود من العملاء",
      "تحليلات أساسية",
      "دعم البريد الإلكتروني"
    ]
  },
  pro: {
    id: "pro",
    name: "احترافي",
    amount: 99900, // SAR 999 in smallest units
    currency: "SAR",
    interval: "month",
    features: [
      "عدد غير محدود من العملاء",
      "تحليلات متقدمة",
      "أتمتة مخصصة",
      "نموذج AI",
      "الدعم ذو الأولوية"
    ]
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    amount: 299900, // SAR 2999 in smallest units
    currency: "SAR",
    interval: "month",
    features: [
      "جميع ميزات Pro",
      "API مخصص",
      "دعم مخصص 24/7",
      "تقارير مخصصة",
      "التدريب والإعداد"
    ]
  }
};

export async function createCheckoutSession(
  customerId: string,
  planId: string,
  successUrl: string,
  cancelUrl: string
) {
  try {
    if (!stripe) {
      throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.");
    }

    const plan = PAYMENT_PLANS[planId];
    if (!plan) {
      throw new Error("Invalid plan ID");
    }

    // Create a checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: plan.currency.toLowerCase(),
            product_data: {
              name: plan.name,
              description: plan.features.join(", ")
            },
            unit_amount: plan.amount,
            recurring: {
              interval: plan.interval,
              interval_count: 1
            }
          },
          quantity: 1
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl
    });

    return session;
  } catch (error) {
    console.error("Stripe checkout error:", error);
    throw error;
  }
}

export async function createOrUpdateCustomer(
  email: string,
  name?: string,
  stripeCustomerId?: string
) {
  try {
    if (!stripe) {
      throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.");
    }

    if (stripeCustomerId) {
      // Update existing customer
      return await stripe.customers.update(stripeCustomerId, {
        email,
        name
      });
    } else {
      // Create new customer
      return await stripe.customers.create({
        email,
        name
      });
    }
  } catch (error) {
    console.error("Stripe customer error:", error);
    throw error;
  }
}

export async function getCustomerSubscriptions(customerId: string) {
  try {
    if (!stripe) {
      throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.");
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 10
    });

    return subscriptions.data;
  } catch (error) {
    console.error("Stripe subscriptions error:", error);
    throw error;
  }
}

export async function cancelSubscription(subscriptionId: string) {
  try {
    if (!stripe) {
      throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.");
    }

    const subscription = await stripe.subscriptions.cancel(subscriptionId);
    return subscription;
  } catch (error) {
    console.error("Stripe cancel subscription error:", error);
    throw error;
  }
}

export async function createInvoice(customerId: string, amount: number, description: string) {
  try {
    if (!stripe) {
      throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.");
    }

    const invoice = await stripe.invoices.create({
      customer: customerId,
      auto_advance: true,
      collection_method: "send_invoice",
      days_until_due: 30
    });

    // Add line item to invoice
    await stripe.invoiceItems.create({
      invoice: invoice.id,
      customer: customerId,
      amount,
      description,
      currency: "sar"
    });

    // Finalize and send invoice
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

    return finalizedInvoice;
  } catch (error) {
    console.error("Stripe invoice error:", error);
    throw error;
  }
}