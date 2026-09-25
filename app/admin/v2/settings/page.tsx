import Link from "next/link";
import AdsSettingsCard from "@/components/admin/settings/AdsSettingsCard";

export const dynamic = "force-dynamic";

export default function V2SettingsPage() {
  return (
    <div className="min-h-[60vh] px-5 py-10 md:px-10" dir="rtl">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-white/40">الإعدادات — البيت الجديد</p>
        <h1 className="mt-2 text-2xl font-black text-white">التحكم في الموقع</h1>
        <p className="mt-2 text-sm text-white/45">أي حاجة اتنقلت للمكان ده بتتحكّمي فيها من هنا. باقي البنود لسه في الداشبورد القديم لحد ما تتنقل.</p>

        <div className="mt-8 space-y-6">
          <AdsSettingsCard />
        </div>

        <Link href="/admin/settings" className="mt-8 inline-block text-xs text-white/40 hover:text-white">
          ← افتح الإعدادات الكاملة في الداشبورد القديم
        </Link>
      </div>
    </div>
  );
}
