import { DEAD_KEYS, LIVE_FACTS, SECRET_MASK, type SettingFact } from "@/lib/settings/facts";
import { arNum } from "@/lib/ops/metricLabels";

/**
 * The owner's settings desk in the new house.
 *
 * The old desk was a raw key/value editor: it printed machine keys in a monospace box, let him save
 * any JSON, and — measured tonight — showed the alert bot's credential in a textarea, because the
 * settings door handed the browser the whole row. This desk does the opposite: it names the three
 * values that actually change something on a surface, says where each one is edited, keeps the
 * credential off the screen behind the mask the door answers with, and counts the fourteen keys that
 * answer to no reader as residue rather than as controls.
 */

function stateOf(fact: SettingFact, value: unknown): string {
  if (fact.secret) {
    const record = (value ?? {}) as Record<string, unknown>;
    const chats = Array.isArray(record.chats) ? record.chats.length : 0;
    const on = record.enabled === true;
    return `التنبيهات ${on ? "شغالة" : "مقفولة"} · ${arNum(chats)} ${chats === 1 ? "محادثة" : "محادثات"} · المفتاح ${SECRET_MASK.replace(/[«»]/g, "")}`;
  }
  if (value && typeof value === "object" && Object.keys(value as object).length === 0) {
    return "فاضي — مفيش قيمة متغيّرة دلوقتي";
  }
  if (value === undefined || value === null || value === "") return "فاضي";
  return "متضبط";
}

export function SettingsFactsDesk({ values }: { values: Record<string, unknown> }) {
  const residue = DEAD_KEYS.filter((d) => values[d.key] !== undefined);

  return (
    <section className="space-y-4" data-settings-desk>
      <div className="space-y-1">
        <h2 className="text-[15px] font-black text-white">اللي بيتحكّم في حاجة فعلًا</h2>
        <p className="text-[12px] leading-relaxed text-white/70">
          كل سطر هنا بيقول إيه اللي بيتغيّر في الموقع لما تغيّره. مفيش خانة بتتعرض عليك وهي ما
          بتعملش حاجة.
        </p>
      </div>

      <ul className="space-y-2">
        {LIVE_FACTS.map((fact) => (
          <li
            key={fact.key}
            className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
            data-setting={fact.key}
          >
            <p className="text-[13px] font-bold text-white">{fact.label}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/70">{fact.controls}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#C5A059]">{stateOf(fact, values[fact.key])}</p>
            {fact.editor ? (
              <p className="mt-1 text-[11px] text-white/70">بيتغيّر من: {fact.editor}</p>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="rounded-2xl border border-dashed border-white/15 px-4 py-4">
        <p className="text-[13px] font-bold text-white">
          {arNum(residue.length)} قيمة مسجّلة وما بيقرأهاش أي سطح
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-white/70">
          دي باقِة من بناء قديم للموقع. مش هتلاقيها أزرار تحكم، ومش هتتغيّر من هنا — ومسحها كلمة
          صريحة منك، مش قرار وكيل.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-white/70">
          {residue.map((r) => r.label).join(" · ")}
        </p>
      </div>
    </section>
  );
}
