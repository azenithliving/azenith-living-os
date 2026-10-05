'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Brain, Crown, Users, Image, TrendingUp, Wrench, ShieldCheck } from 'lucide-react';

import {
  DEPARTMENTS,
  DEPARTMENT_KEYS,
  employeeHref,
  employeeTitle,
  type Department,
} from '@/lib/ops/departments';
import { SWARM_NAME } from '@/lib/ops/identity';
import { arNum } from '@/lib/ops/metricLabels';
import { pulseItems } from '@/lib/ops/command-canvas';

type AgentStatus = { agent: string; status: 'online' | 'busy' | 'offline'; taskCount: number; recentActivity: string };
type Inbox = { unread: number; teaser: string | null };

const DEPT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  operations: ShieldCheck,
  sales: Users,
  content: Image,
  analytics: TrendingUp,
  engineering: Wrench,
  security: Brain,
};

const EMPLOYEE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'ops-lead': Crown,
  'ops-qa': ShieldCheck,
  vanguard: Users,
  'ops-content': Brain,
  'ops-visual': Image,
  'ops-seo': TrendingUp,
  'ops-analytics': TrendingUp,
  'ops-ux': Wrench,
  'ops-dev': Wrench,
};

/**
 * The command canvas: the store's pulse and one card per employee who actually exists,
 * grouped under the department he belongs to.
 *
 * One component, two addresses — the owner's overview and the swarm address — because the
 * day these two pages each hold their own counters is the day they start disagreeing on
 * his phone.
 *
 * The badge is fetched ONCE on mount and never polled: the chat panel is what marks a
 * thread read, when he actually opens the conversation. Polling here would either mark his
 * inbox read behind his back or re-count the same noise.
 */
export function CommandCanvas() {
  const [statuses, setStatuses] = useState<Record<string, AgentStatus> | null>(null);
  const [inboxes, setInboxes] = useState<Record<string, Inbox>>({});
  const [roll, setRoll] = useState<{ customers: number | null; needingReply: number | null }>({
    customers: null,
    needingReply: null,
  });
  const [decisions, setDecisions] = useState<number | null>(null);

  const fetchOnce = useCallback(async () => {
    // Every number comes from a door that already answers it for somebody else — the
    // customer roll the sales office reads, the decision queue the chat's vault reads.
    const [statusRes, customersRes, queueRes] = await Promise.allSettled([
      fetch('/api/admin/agents/chat'),
      fetch('/api/admin/customers'),
      fetch('/api/admin/agents/approval-queue'),
    ]);

    if (statusRes.status === 'fulfilled') {
      try {
        const d = await statusRes.value.json();
        if (d.success && d.data) setStatuses(d.data as Record<string, AgentStatus>);
      } catch {}
    }
    if (customersRes.status === 'fulfilled') {
      try {
        const d = await customersRes.value.json();
        const t = d?.totals;
        if (t) setRoll({ customers: Number(t.customers) || 0, needingReply: Number(t.needingReply) || 0 });
      } catch {}
    }
    if (queueRes.status === 'fulfilled') {
      try {
        const d = await queueRes.value.json();
        if (Array.isArray(d?.approvals)) setDecisions(d.approvals.length);
      } catch {}
    }

    // One door for all nine badges. This used to be a read per employee: nine round trips, each
    // behind a function that may be cold, and every card waited on the slowest of them.
    try {
      const res = await fetch(`/api/admin/agents/inboxes?keys=${DEPARTMENT_KEYS.join(",")}`, { cache: 'no-store' });
      const data = await res.json();
      if (data?.success && data.inboxes) {
        setInboxes(
          Object.fromEntries(
            Object.entries(data.inboxes as Record<string, { unread?: number; teaser?: string | null }>).map(
              ([key, box]) => [key, { unread: Number(box?.unread) || 0, teaser: box?.teaser ?? null }]
            )
          )
        );
      }
    } catch {
      // Nothing lands: the line above the cards says the read has not arrived, and no card claims
      // a number it does not have.
    }
  }, []);

  useEffect(() => {
    fetchOnce();
  }, [fetchOnce]);

  // Live status dot only (never touches read state)
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const res = await fetch('/api/admin/agents/chat');
        const data = await res.json();
        if (data.success && data.data) setStatuses(data.data as Record<string, AgentStatus>);
      } catch {}
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  const pulse = pulseItems({
    customers: roll.customers,
    needingReply: roll.needingReply,
    decisions,
    unread: Object.values(inboxes).reduce((sum, box) => sum + (box?.unread || 0), 0),
    loaded: Object.keys(inboxes).length > 0,
  });

  // What has actually arrived, out of what was asked. The owner gets the truth about the read
  // instead of nine cards that each guess their own way of looking unfinished.
  const landed = Object.keys(inboxes).length;
  const waitingForMail = landed === 0;

  return (
    <div className="min-h-[70vh] p-4 pt-16 sm:p-6 sm:pt-8" dir="rtl">
      <header className="mb-5">
        <h1 className="text-lg font-black text-white">{SWARM_NAME}</h1>
        <p className="mt-0.5 text-[11px] text-white/40">
          {arNum(DEPARTMENT_KEYS.length)} أبواب حيّة، كل باب يفتح محادثة كاملة الشاشة مع موظف حقيقي
        </p>
        <p className="mt-1 text-[10px] leading-relaxed text-white/25">
          الأرقام هنا من سجل الرسائل نفسه: العدّاد بيتقفل لما تفتح المحادثة فعلاً.
        </p>
      </header>

      <section aria-label="نبض المتجر" className="mb-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {pulse.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
              <div className="text-[10px] leading-tight text-white/40">{item.label}</div>
              <div
                className={`mt-0.5 text-lg font-black ${
                  item.value === null
                    ? 'text-white/25'
                    : item.value > 0
                      ? 'text-amber-300'
                      : 'text-white/70'
                }`}
              >
                {item.text}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-white/30">
          قارئ الورقة المرسومة باليد وعدّاد الزوار اللحظي: بابان لسه ما اتبنيتوش — ما بنطش صفر مكانهم لأن الصفر ما
          بيمتّزش عن رقم حقيقي.
        </p>
      </section>

      {waitingForMail && (
        <p className="mb-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-white/45" data-inboxes-loading>
          بأقرأ بريد الموظفين ({arNum(landed)} من {arNum(DEPARTMENT_KEYS.length)}) — الأرقام بتظهر مرة واحدة.
        </p>
      )}

      <div className="space-y-7">
        {DEPARTMENTS.map((dept) => (
          <DepartmentBlock key={dept.id} dept={dept} statuses={statuses} inboxes={inboxes} />
        ))}
      </div>
    </div>
  );
}

function DepartmentBlock({
  dept,
  statuses,
  inboxes,
}: {
  dept: Department;
  statuses: Record<string, AgentStatus> | null;
  inboxes: Record<string, Inbox>;
}) {
  const Icon = DEPT_ICONS[dept.id] ?? Brain;

  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-white/35" />
        <h2 className="text-[12px] font-bold text-white/55">{dept.title}</h2>
        <span className="h-px flex-1 bg-white/[0.06]" />
      </div>

      {dept.members.length === 0 ? (
        dept.vacancy && (
          <p className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-3 text-[11px] leading-relaxed text-white/45">
            {dept.vacancy}
          </p>
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dept.members.map((key) => (
            <EmployeeCard key={key} agentKey={key} status={statuses?.[key] ?? null} inbox={inboxes[key]} />
          ))}
        </div>
      )}
    </section>
  );
}

function EmployeeCard({
  agentKey,
  status,
  inbox,
}: {
  agentKey: string;
  status: AgentStatus | null;
  inbox: Inbox | undefined;
}) {
  const isLeader = agentKey === 'ops-lead';
  const Icon = EMPLOYEE_ICONS[agentKey] ?? Brain;
  const statusText =
    status?.status === 'online' ? 'متصل وجاهز' : status?.status === 'busy' ? 'قيد المعالجة' : 'نشط';
  const dotColor = status?.status === 'busy' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500';
  const unread = inbox?.unread ?? 0;
  // Three states, all of them true: his mail has arrived and is empty, it has arrived and says
  // something, or the read has not landed yet — and while it has not, the card shows no box at all
  // rather than a rectangle that looks broken.
  const teaser = inbox ? inbox.teaser ?? 'لا رسائل جديدة — افتح المحادثة لتكلّفه.' : null;

  return (
    <Link
      href={employeeHref(agentKey)}
      data-employee-card={agentKey}
      className="group block rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:border-amber-500/30 hover:bg-amber-500/[0.04]"
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div
            className={`w-10 h-10 rounded-xl border bg-gradient-to-br flex items-center justify-center ${
              isLeader
                ? 'from-amber-500/20 to-yellow-700/10 border-amber-500/25 text-amber-400'
                : 'from-white/10 to-white/[0.03] border-white/10 text-white/70'
            }`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <span className={`absolute -bottom-0.5 -left-0.5 w-2.5 h-2.5 rounded-full border-2 border-black ${dotColor}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[13px] font-black text-white">{employeeTitle(agentKey)}</h3>
            {unread > 0 && (
              <span className="shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white animate-pulse">
                {arNum(unread)}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[10px] text-white/35">
            {isLeader ? 'قائد السرب' : SWARM_NAME} · {statusText}
            {status?.taskCount ? ` · ${arNum(status.taskCount)} مهمة` : ''}
          </p>
        </div>
      </div>

      {teaser && (
        <p className="mt-3 line-clamp-2 rounded-xl border border-white/5 bg-black/25 px-3 py-2 text-[11px] leading-relaxed text-white/60">
          {teaser}
        </p>
      )}

      <span className="mt-2.5 inline-block text-[10px] font-bold text-white/25 transition-colors group-hover:text-amber-400">
        افتح المحادثة كاملة الشاشة
      </span>
    </Link>
  );
}
