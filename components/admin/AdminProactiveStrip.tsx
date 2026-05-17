"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Info, Loader2 } from "lucide-react";

type Alert = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  href?: string;
};

const iconBySeverity = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
};

const colorBySeverity = {
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  info: "border-[#C5A059]/30 bg-[#C5A059]/10 text-[#e8d5a8]",
};

export function AdminProactiveStrip() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/proactive");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.alerts)) {
          setAlerts(data.alerts.slice(0, 3));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/50">
        <Loader2 className="h-4 w-4 animate-spin" />
        جاري قراءة تنبيهات النظام...
      </div>
    );
  }

  if (alerts.length === 0) return null;

  return (
    <div className="grid gap-2 md:grid-cols-3">
      {alerts.map((a) => {
        const Icon = iconBySeverity[a.severity] || Info;
        const card = (
          <div
            className={`rounded-xl border p-3 ${colorBySeverity[a.severity]}`}
          >
            <div className="flex items-start gap-2">
              <Icon className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-xs opacity-80 mt-0.5">{a.description}</p>
              </div>
            </div>
          </div>
        );
        return a.href ? (
          <Link key={a.id} href={a.href} className="block hover:opacity-90">
            {card}
          </Link>
        ) : (
          <div key={a.id}>{card}</div>
        );
      })}
    </div>
  );
}
