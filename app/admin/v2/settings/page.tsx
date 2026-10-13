import Link from "next/link";
import AdsSettingsCard from "@/components/admin/settings/AdsSettingsCard";
import ConsultantFaqCard from "@/components/admin/settings/ConsultantFaqCard";
import { SettingsFactsDesk } from "@/components/admin/settings/SettingsFactsDesk";
import { StoreNumbersCard } from "@/components/admin/settings/StoreNumbersCard";
import { supabaseService } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

/**
 * The settings office in the new house. The values are read here, on the server, and the desk never
 * puts a credential in the page — the door masks it and this desk only counts what surrounds it.
 */
export default async function V2SettingsPage() {
  const { data } = await supabaseService.from("site_settings").select("key,value");
  const values: Record<string, unknown> = Object.fromEntries(
    ((data ?? []) as { key: string; value: unknown }[]).map((row) => [row.key, row.value])
  );

  return (
    <div className="min-h-[60vh] px-5 pt-20 pb-10 md:px-10" dir="rtl">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-1">
          <p className="text-[11px] text-white/70">الإعدادات — البيت الجديد</p>
          <h1 className="text-2xl font-black text-white">إعدادات المتجر</h1>
          <p className="text-[12px] leading-relaxed text-white/70">
            القيم دي بتتقري من سجل المتجر وتتحفظ فيه. اللي اتنقل هنا بيتحكم فيه من هنا، والباقي
            مسجّل في السجل لسه.
          </p>
        </header>

        <StoreNumbersCard />

        <SettingsFactsDesk values={values} />

        <div className="space-y-6">
          <AdsSettingsCard />
          <ConsultantFaqCard />
        </div>

        <Link
          href="/admin/settings"
          className="inline-block rounded-xl border border-white/15 px-4 py-2 text-[11px] text-white/70 transition-colors hover:border-[#C5A059]/50 hover:text-white"
        >
          محرّر القيم الخام في اللوحة القديمة (للمراجعة بس)
        </Link>
      </div>
    </div>
  );
}
