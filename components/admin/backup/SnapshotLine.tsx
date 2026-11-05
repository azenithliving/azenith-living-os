"use client";

/**
 * The copy's own line on the cockpit.
 *
 * «آخر نسخة إمتى وبتاخد كام جدول» used to be answerable only by reading the code that writes the
 * backup. This reads the door, which reads the stamp row the copy writes for itself — and when the
 * stamp is missing or the copy is not from today, the line says so instead of going quiet.
 */
import { useEffect, useState } from "react";

import { arDigits } from "@/lib/ops/metricLabels";

const ar = (value: unknown) => arDigits(String(value ?? ""));

type BackupState = {
  success?: boolean;
  error?: string;
  stamp?: { day?: string; tables?: number; rows?: number; failures?: string[] } | null;
  fresh?: boolean;
  targets?: number;
  coverage?: { line?: string } | null;
  coverageMissing?: string | null;
};

export function SnapshotLine() {
  const [state, setState] = useState<BackupState | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/backup", { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as BackupState | null;
        if (!alive) return;
        if (!res.ok || !data?.success) {
          setRefusal(typeof data?.error === "string" && data.error ? data.error : `الباب ردّ برفض (${res.status})`);
          return;
        }
        setState(data);
      })
      .catch((error: unknown) => {
        if (alive) setRefusal(`الباب ما ردّش: ${String(error).slice(0, 60)}`);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (refusal) {
    return (
      <p className="mt-2 text-[10px] leading-relaxed text-red-300" data-backup-refused>
        {refusal}
      </p>
    );
  }
  if (!state) {
    return (
      <p className="mt-2 text-[10px] leading-relaxed text-white/40" data-backup-loading>
        حالة النسخة بتتقرا...
      </p>
    );
  }

  const stamp = state.stamp ?? null;
  const head = stamp?.day
    ? `آخر نسخة ${ar(stamp.day)} · ${ar(stamp.tables ?? 0)} جدول · ${ar(stamp.rows ?? 0)} سطر`
    : "آخر نسخة ما اتقارش: السجل ما فيهوش ختم النسخة";
  const when = stamp?.day ? (state.fresh ? " — النهاردة" : " — مش النهاردة") : "";
  const trouble = stamp?.failures?.length ? ` · مرفوض ${ar(stamp.failures.length)}` : "";

  return (
    <p className="mt-2 text-[10px] leading-relaxed text-white/70" data-backup-line>
      {head}
      {when}
      {trouble}
      {` · الطقم ${ar(state.targets ?? 0)} جدول`}
      {state.coverage?.line ? ` · ${state.coverage.line}` : state.coverageMissing ? ` · ${state.coverageMissing}` : ""}
    </p>
  );
}
