import Link from "next/link";

/**
 * A section of the new house whose own screen has not been built yet.
 *
 * The old shape of these pages announced that content would arrive later, which reads to
 * the owner as finished work wearing an empty frame. This page says what the section is
 * for, states plainly that its transfer is not done, and gives him the door where that
 * work actually happens today — a door that opens, never a promise.
 */
export type SectionDoor = { href: string; label: string };

export function SectionIntake({
  title,
  purpose,
  doors,
}: {
  title: string;
  purpose: string;
  doors: SectionDoor[];
}) {
  return (
    <div className="min-h-[70vh] p-4 pt-16 sm:p-6 sm:pt-8" dir="rtl">
      <div className="mx-auto max-w-xl">
        <h1 className="text-xl font-black text-white">{title}</h1>
        <p className="mt-2 text-[12px] leading-relaxed text-white/45">{purpose}</p>
        <p className="mt-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-3 text-[11px] leading-relaxed text-white/45">
          نقل هذا القسم لسه ما اكتملش. السجل هو العدد: كل ذرة هنا ليها سطر، والسطر بيتقفل
          ببرهان من شاشة الموبايل مش بكتابة الملف.
        </p>
        <div className="mt-5 space-y-2">
          {doors.map((door) => (
            <Link
              key={door.href}
              href={door.href}
              className="block rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-[12px] text-white/70 transition-colors hover:border-amber-500/30 hover:text-white"
            >
              {door.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
