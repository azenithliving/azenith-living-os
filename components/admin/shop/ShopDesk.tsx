"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { arNum } from "@/lib/ops/metricLabels";
import { priceLine } from "@/lib/shop/words";

/**
 * The owner's desk for the ready-products shelf.
 *
 * His business is made-to-order, so this desk exists for the exception: a piece that was already
 * executed and can be taken as is. A piece is only ever shown to a customer once it answers the two
 * questions a visitor asks — what is it called and how much — so the desk prints what is missing
 * rather than letting a blank card reach the storefront. There is no erase button here on purpose:
 * deleting a row is his word, and hiding a piece is reversible.
 */

type DeskRow = {
  id: string;
  name: string;
  price: number;
  shortDescription: string;
  coverPath: string;
  isActive: boolean;
  displayable: boolean;
  missing: string[];
};

type LoadState = "loading" | "ready" | "error";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export function ShopDesk() {
  const [rows, setRows] = useState<DeskRow[]>([]);
  const [status, setStatus] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [photo, setPhoto] = useState<string>("");
  const [photoError, setPhotoError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/shop", { cache: "no-store" });
      const json = (await res.json()) as { success?: boolean; rows?: DeskRow[]; error?: string };
      if (!res.ok || !json.success) {
        setLoadError(json.error || `السجل ردّ بكود ${res.status}`);
        setStatus("error");
        return;
      }
      setRows(json.rows ?? []);
      setStatus("ready");
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "السجل ما وصلش");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function pickPhoto(file: File | null | undefined) {
    setPhotoError("");
    if (!file) {
      setPhoto("");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setPhotoError(`الصورة أكبر من المسموح (${arNum(Math.round(file.size / 1024))} كيلوبايت، الحد ٤٠٩٦)`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => setPhotoError("الصورة ما اتقريتاش — اختارها تاني");
    reader.readAsDataURL(file);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch("/api/admin/shop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          price: Number(price),
          shortDescription,
          description,
          coverUrl,
          image: photo || undefined,
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string; stored?: number };
      setNotice(
        json.success
          ? `اتسجّلت (${arNum(json.stored ?? 1)})`
          : `ما اتسجّلتش: ${json.error || `المزود ردّ بكود ${res.status}`}`
      );
      if (json.success) {
        setName("");
        setPrice("");
        setShortDescription("");
        setDescription("");
        setCoverUrl("");
        setPhoto("");
        if (fileRef.current) fileRef.current.value = "";
        await load();
      }
    } catch (error) {
      setNotice(`الطلب فوقّع: ${error instanceof Error ? error.message : "مفيش رد"}`);
    } finally {
      setBusy(false);
    }
  }

  async function setShow(row: DeskRow, show: boolean) {
    setNotice("");
    try {
      const res = await fetch("/api/admin/shop", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: row.id, show }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!json.success) setNotice(`الكلمة ما اتسجلّتش: ${json.error || `كود ${res.status}`}`);
    } catch (error) {
      setNotice(`الطلب فوقّع: ${error instanceof Error ? error.message : "مفيش رد"}`);
    }
    await load();
  }

  const shownCount = rows.filter((r) => r.displayable).length;

  return (
    <div className="min-h-[70vh] p-4 pt-16 sm:p-6 sm:pt-8" dir="rtl">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-xl font-black text-white">رفّ الجاهز</h1>
          <p className="text-[12px] leading-relaxed text-white/70">
            شغلك الأساسي حسب الطلب، فالرفّ ده للاستثناء: قطعة اتنفّذت وواقفة مستنية حد ياخدها.
            القطعة ما بتظهرش للزائر غير لما يكون ليها اسم وسعر وصورة — والسجل هنا بيقول إيه اللي
            ناقص في كل قطعة.
          </p>
          <p className="text-[12px] leading-relaxed text-white/70">
            على الرفّ دلوقتي: {arNum(shownCount)} قطعة بتظهر للزائر · {arNum(rows.length)} مسجّلة
            عندك.{" "}
            <Link href="/shop" className="text-[#C5A059] underline underline-offset-4">
              افتح صفحة المتجر زي ما الزائر بيشوفها
            </Link>
          </p>
        </header>

        <form
          onSubmit={submit}
          className="space-y-3 rounded-[2rem] border border-white/10 bg-white/[0.02] p-5"
        >
          <h2 className="text-[13px] font-bold text-white">أضف قطعة</h2>
          <div className="space-y-1">
            <label htmlFor="shop-name" className="block text-[11px] text-white/70">
              اسم القطعة
            </label>
            <input
              id="shop-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="كنبة ركنية بمقاس ثلاث متر"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white placeholder:text-white/70"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="shop-price" className="block text-[11px] text-white/70">
              السعر بالجنيه
            </label>
            <input
              id="shop-price"
              type="number"
              min="1"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="٤٥٠٠٠"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white placeholder:text-white/70"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="shop-short" className="block text-[11px] text-white/70">
              سطر واحد يوصفها
            </label>
            <input
              id="shop-short"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="قماش مخمل أخضر، إطار خشب زان"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white placeholder:text-white/70"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="shop-desc" className="block text-[11px] text-white/70">
              تفاصيل أكتر (اختياري)
            </label>
            <textarea
              id="shop-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="المقاسات، الخامات، ومكان التسليم"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] leading-7 text-white placeholder:text-white/70"
            />
          </div>
          <div className="space-y-2 rounded-2xl border border-dashed border-white/10 p-3">
            <label htmlFor="shop-photo" className="block text-[11px] text-white/70">
              صورتها من شغلنا
            </label>
            <input
              id="shop-photo"
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => pickPhoto(e.target.files?.[0])}
              className="w-full text-[11px] text-white/70 file:ml-3 file:rounded-xl file:border-0 file:bg-[#C5A059] file:px-4 file:py-2 file:text-[11px] file:font-bold file:text-[#1A1A1B]"
            />
            {photoError ? <p className="text-[11px] text-rose-300">{photoError}</p> : null}
            {photo ? (
              <img src={photo} alt="الصورة اللي اخترتها" className="h-28 w-28 rounded-xl object-cover" />
            ) : null}
            <label htmlFor="shop-cover-url" className="block text-[11px] text-white/70">
              أو رابط صورة موجود
            </label>
            <input
              id="shop-cover-url"
              dir="ltr"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left text-[11px] text-white placeholder:text-white/70"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={busy || !name.trim() || !(Number(price) > 0)}
              className="rounded-xl bg-[#C5A059] px-5 py-2.5 text-[12px] font-bold text-[#1A1A1B] transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "بأسجّلها…" : "نزّلها على الرفّ"}
            </button>
            {notice ? <p className="text-[11px] text-white/70">{notice}</p> : null}
          </div>
        </form>

        <section className="space-y-3">
          <h2 className="text-[13px] font-bold text-white">اللي مسجّله</h2>
          {status === "loading" ? <p className="text-[12px] text-white/70">بأقرأ السجل…</p> : null}
          {status === "error" ? (
            <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[12px] leading-relaxed text-rose-200">
              السجل ما وصلش: {loadError}
            </p>
          ) : null}
          {status === "ready" && rows.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-[12px] leading-relaxed text-white/70">
              مفيش قطعة مسجّلة لسه. الزائر اللي يفتح المتجر دلوقتي بيشوف «قريبًا» — ودي الحقيقة، مش
              خطأ.
            </p>
          ) : null}
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-[12px] font-bold text-white">{row.name || "بلا اسم"}</p>
                  <p className="text-[11px] text-white/70">
                    {row.price > 0 ? priceLine(row.price) : "بلا سعر"} ·{" "}
                    {row.displayable ? "بتظهر للزائر" : `ناقص: ${row.missing.join("، ")}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShow(row, !row.isActive)}
                  className="shrink-0 rounded-xl border border-white/15 px-4 py-2 text-[11px] font-bold text-white transition-colors hover:border-[#C5A059]/50"
                >
                  {row.isActive ? "خبّيها عن الزائر" : "أظهرها للزائر"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
