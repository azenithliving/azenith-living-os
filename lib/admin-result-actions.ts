export type ResultAction = {
  label: string;
  href: string;
  kind: "internal" | "external";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeHref(href: string): string | undefined {
  if (!href.trim()) return undefined;
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("/")) return href;
  return undefined;
}

function pushUnique(actions: ResultAction[], action: ResultAction) {
  if (!actions.some((existing) => existing.href === action.href && existing.label === action.label)) {
    actions.push(action);
  }
}

export function buildResultActions(data: unknown): ResultAction[] {
  const actions: ResultAction[] = [];

  function visit(value: unknown) {
    if (!isRecord(value)) return;

    const previewUrl = normalizeHref(asString(value.previewUrl) || "");
    if (previewUrl) {
      pushUnique(actions, {
        label: "افتح المعاينة",
        href: previewUrl,
        kind: previewUrl.startsWith("http") ? "external" : "internal",
      });
    }

    const sectionId = asString(value.sectionId);
    if (sectionId) {
      pushUnique(actions, {
        label: "افتح القسم",
        href: `/preview/section/${encodeURIComponent(sectionId)}`,
        kind: "internal",
      });
    }

    const prUrl = normalizeHref(asString(value.prUrl) || asString(value.pullRequestUrl) || "");
    if (prUrl) {
      pushUnique(actions, {
        label: "افتح طلب المراجعة",
        href: prUrl,
        kind: prUrl.startsWith("http") ? "external" : "internal",
      });
    }

    const url = normalizeHref(asString(value.url) || asString(value.href) || "");
    if (url) {
      pushUnique(actions, {
        label: url.startsWith("http") ? "افتح الرابط" : "افتح الناتج",
        href: url,
        kind: url.startsWith("http") ? "external" : "internal",
      });
    }

    const productId = asString(value.productId);
    if (productId) {
      pushUnique(actions, {
        label: "افتح المنتجات",
        href: `/admin/products?highlight=${encodeURIComponent(productId)}`,
        kind: "internal",
      });
    }

    const categoryId = asString(value.categoryId);
    if (categoryId) {
      pushUnique(actions, {
        label: "افتح الأقسام",
        href: `/admin/categories?highlight=${encodeURIComponent(categoryId)}`,
        kind: "internal",
      });
    }

    for (const nested of Object.values(value)) {
      if (Array.isArray(nested)) nested.forEach(visit);
      else if (isRecord(nested)) visit(nested);
    }
  }

  visit(data);
  return actions.slice(0, 4);
}
