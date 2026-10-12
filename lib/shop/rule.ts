/**
 * rule.ts — the one rule for what may stand on the customer's ready-products shelf, with no
 * database in it so a guard can test it without a connection.
 *
 * Measured 2026-10-13: the products table held exactly one row («صوفا ملكية») with no price, no
 * picture and no category — written while another agent was building the store. The owner's business
 * is made-to-order: he buys materials only after the deposit. So a ready piece is an exception he
 * chooses to put on the shelf, never stock, and a row that cannot answer «بقد إيه؟» or «إيه شكلها؟» must never reach a customer.
 *
 * The customer's page and the owner's desk both read this rule, so the shelf and the desk cannot
 * disagree about what is showing.
 */

/** The picture bucket the store's own upload doors already use. */
export const SHELF_BUCKET = "customer-uploads";

export type ShelfPiece = {
  id: string;
  name: string;
  slug: string;
  price: number;
  shortDescription: string;
  description: string;
  coverUrl: string;
  gallery: string[];
  createdAt: string | null;
};

/** The price a customer is charged: the offer when there is one, otherwise the list price. */
export function priceOf(row: Record<string, unknown>): number {
  const sale = Number(row.sale_price ?? 0);
  const base = Number(row.base_price ?? 0);
  return sale > 0 ? sale : base;
}

export function coverOf(row: Record<string, unknown>): string {
  return typeof row.featured_image_url === "string" ? row.featured_image_url.trim() : "";
}

/** The two questions a customer asks a piece — both answered, or it does not appear. */
export function isDisplayable(row: Record<string, unknown>): boolean {
  if (row.is_active !== true) return false;
  if (!(priceOf(row) > 0)) return false;
  return coverOf(row).length > 0;
}
