"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Copy, Crown, KeyRound, Loader2, Plus, RefreshCw, ShieldCheck } from "lucide-react";

type ClientAccess = {
  id: string;
  phone: string;
  access_status: "pending" | "active" | "suspended" | "expired";
  expires_at: string | null;
  subscription_active: boolean;
  request_id: string | null;
  created_at: string;
  updated_at: string;
};

type ApiPayload = {
  success?: boolean;
  data?: ClientAccess | ClientAccess[];
  error?: string;
  invitationUrl?: string;
  expiresAt?: string;
  delivery?: "manual";
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ar-EG");
}

const statusLabels: Record<ClientAccess["access_status"], string> = {
  pending: "بانتظار التفعيل",
  active: "مفعّل",
  suspended: "موقوف",
  expired: "منتهي",
};

export default function EliteInvitationsPage() {
  const [clients, setClients] = useState<ClientAccess[]>([]);
  const [phone, setPhone] = useState("");
  const [accessStatus, setAccessStatus] = useState<"pending" | "active">("pending");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<{ url: string; expiresAt: string } | null>(null);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/elite/invitations", { cache: "no-store" });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.success || !Array.isArray(payload.data)) {
        throw new Error(payload.error || "تعذر تحميل سجلات وصول النخبة.");
      }
      setClients(payload.data as ClientAccess[]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "تعذر تحميل سجلات وصول النخبة.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  async function createClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setNotice(null);
    setInvitation(null);

    try {
      const response = await fetch("/api/admin/elite/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", phone, access_status: accessStatus }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "تعذر إنشاء سجل الوصول.");
      }
      setPhone("");
      setNotice("تم إنشاء سجل الوصول. يمكنك الآن إصدار رابط دعوة لمرة واحدة.");
      await loadClients();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "تعذر إنشاء سجل الوصول.");
    } finally {
      setCreating(false);
    }
  }

  async function issueInvitation(client: ClientAccess) {
    setIssuingId(client.id);
    setError(null);
    setNotice(null);
    setInvitation(null);

    try {
      const response = await fetch("/api/admin/elite/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "issue", client_access_id: client.id }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.success || !payload.invitationUrl || !payload.expiresAt) {
        throw new Error(payload.error || "تعذر إصدار رابط الدعوة.");
      }
      setInvitation({ url: payload.invitationUrl, expiresAt: payload.expiresAt });
      setNotice("تم إصدار الرابط. انسخه وشاركه يدويًا مع العميل؛ لم تُرسل أي رسالة تلقائيًا.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "تعذر إصدار رابط الدعوة.");
    } finally {
      setIssuingId(null);
    }
  }

  async function copyInvitation() {
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(invitation.url);
      setNotice("تم نسخ رابط الدعوة.");
    } catch {
      setError("تعذر النسخ تلقائيًا. انسخ الرابط من الحقل الظاهر.");
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6 text-right md:p-10" dir="rtl">
      <header className="rounded-3xl border border-[#C5A059]/20 bg-gradient-to-l from-[#C5A059]/10 to-white/[0.03] p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-[#C5A059] p-3 text-black"><Crown className="h-7 w-7" /></div>
            <div>
              <h1 className="text-3xl font-bold text-white">دعوات النخبة</h1>
              <p className="mt-2 max-w-2xl leading-7 text-white/65">
                أنشئ وصولًا لعميل معتمد، ثم أصدر رابط دخول يستخدم لمرة واحدة. مشاركة الرابط مسؤولية الفريق حتى تُجهّز خدمة إرسال فعلية.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadClients()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-white/75 transition hover:border-[#C5A059] hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            تحديث
          </button>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={createClient} className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-3 text-[#C5A059]"><Plus className="h-5 w-5" /><h2 className="text-lg font-bold">إضافة وصول معتمد</h2></div>
          <label className="block text-sm text-white/70">
            رقم الهاتف بصيغة دولية
            <input
              required
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="201234567890"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-left text-white outline-none transition focus:border-[#C5A059]"
              dir="ltr"
            />
          </label>
          <label className="block text-sm text-white/70">
            حالة الوصول
            <select
              value={accessStatus}
              onChange={(event) => setAccessStatus(event.target.value as "pending" | "active")}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none focus:border-[#C5A059]"
            >
              <option value="pending">بانتظار التفعيل</option>
              <option value="active">مفعّل</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={creating}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#C5A059] px-5 py-3 font-bold text-black transition hover:bg-[#d8b56d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            إنشاء سجل الوصول
          </button>
        </form>

        <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-3 text-[#C5A059]"><ShieldCheck className="h-5 w-5" /><h2 className="text-lg font-bold">رابط الدعوة</h2></div>
          {invitation ? (
            <>
              <p className="text-sm leading-6 text-white/65">ينتهي الرابط في {formatDate(invitation.expiresAt)} ويُستخدم لمرة واحدة فقط.</p>
              <input readOnly value={invitation.url} className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-left text-xs text-white/80 outline-none" dir="ltr" />
              <button type="button" onClick={() => void copyInvitation()} className="inline-flex items-center gap-2 rounded-xl border border-[#C5A059]/50 px-4 py-2 text-sm text-[#E5C170] transition hover:bg-[#C5A059]/10">
                <Copy className="h-4 w-4" /> نسخ الرابط
              </button>
            </>
          ) : (
            <p className="text-sm leading-7 text-white/50">اختر عميلًا مؤهلًا من القائمة لإصدار رابط حقيقي. لا يظهر رابط قبل إصداره.</p>
          )}
        </div>
      </section>

      {(notice || error) && <p className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-rose-500/35 bg-rose-500/10 text-rose-200" : "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"}`}>{error || notice}</p>}

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        <div className="flex items-center justify-between border-b border-white/10 p-6"><h2 className="text-lg font-bold text-white">سجلات الوصول</h2><span className="text-sm text-white/45">{clients.length} سجل</span></div>
        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-[#C5A059]" /></div>
        ) : clients.length === 0 ? (
          <p className="p-10 text-center text-white/50">لا توجد سجلات وصول للنخبة بعد.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {clients.map((client) => {
              const canIssue = client.access_status !== "suspended" && client.access_status !== "expired";
              return <div key={client.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-medium text-white" dir="ltr">+{client.phone}</p>
                  <p className="mt-1 text-xs text-white/45">أُنشئ {formatDate(client.created_at)} · {statusLabels[client.access_status]}</p>
                </div>
                <button
                  type="button"
                  disabled={!canIssue || issuingId === client.id}
                  onClick={() => void issueInvitation(client)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#C5A059]/15 px-4 py-2 text-sm font-medium text-[#E5C170] transition hover:bg-[#C5A059]/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {issuingId === client.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  إصدار رابط
                </button>
              </div>;
            })}
          </div>
        )}
      </section>
    </main>
  );
}
