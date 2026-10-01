'use client';

import { useState, useEffect, useCallback } from 'react';
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

type AgentStatus = { agent: string; status: 'online' | 'busy' | 'offline'; taskCount: number; recentActivity: string };

type Inbox = { unread: number; teaser: string | null };

/**
 * One readable line out of an agent reply.
 *
 * Table rows are dropped rather than flattened: the seed card is a sentence
 * under a name, and the previous flattening is what produced
 * «فحصت 0 غرفة و1 منتج. | المشكلة | الرابط | ماذا أفعل؟ | | —» on a phone screen.
 */
export function previewLine(content: string): string {
  const prose = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.includes('|') && !l.startsWith('#'))
    .join(' ');
  const clean = prose.replace(/[*`>_]/g, '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  return clean.length > 130 ? `${clean.slice(0, 127).trimEnd()}…` : clean;
}

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
 * The command canvas: one card per employee who actually exists, grouped under the
 * department he belongs to.
 *
 * Until now this screen carried a single hardcoded card for the leader. The other
 * seven employees and the sales manager each had a working full-screen conversation
 * that nothing linked to — so reaching them meant typing an address, which is not
 * how a shop owner runs a shop from a phone.
 *
 * The badge is fetched ONCE on mount and never polled: the chat panel is what marks
 * a thread read, when the owner actually opens the conversation. Polling here would
 * either mark his inbox read behind his back or re-count the same noise.
 */
export default function V2AgentsPage() {
  const [statuses, setStatuses] = useState<Record<string, AgentStatus> | null>(null);
  const [inboxes, setInboxes] = useState<Record<string, Inbox>>({});

  const fetchOnce = useCallback(async () => {
    try {
      const statusRes = await fetch('/api/admin/agents/chat');
      const statusData = await statusRes.json();
      if (statusData.success && statusData.data) {
        setStatuses(statusData.data as Record<string, AgentStatus>);
      }
    } catch {}

    const settled = await Promise.all(
      DEPARTMENT_KEYS.map(async (key) => {
        try {
          const res = await fetch(`/api/admin/agents/messages?agent_key=${key}&unread=true`);
          const data = await res.json();
          if (!data.success) return [key, { unread: 0, teaser: null }] as const;
          const last = (data.data || [])
            .filter((m: any) => m.sender_type === 'agent')
            .slice(-1)[0];
          return [
            key,
            {
              unread: data.count || 0,
              teaser: last ? previewLine(String(last.content || '')) || null : null,
            },
          ] as const;
        } catch {
          return [key, { unread: 0, teaser: null }] as const;
        }
      })
    );
    setInboxes(Object.fromEntries(settled));
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
            <EmployeeCard
              key={key}
              agentKey={key}
              status={statuses?.[key] ?? null}
              inbox={inboxes[key]}
            />
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
  const teaser =
    inbox?.teaser ??
    (inbox ? 'لا رسائل جديدة — افتح المحادثة لتكلّفه.' : 'بستنى رد السيرفر…');

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
          <span
            className={`absolute -bottom-0.5 -left-0.5 w-2.5 h-2.5 rounded-full border-2 border-black ${dotColor}`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[13px] font-black text-white">
              {employeeTitle(agentKey)}
            </h3>
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

      <p className="mt-3 line-clamp-2 rounded-xl border border-white/5 bg-black/25 px-3 py-2 text-[11px] leading-relaxed text-white/60">
        {teaser}
      </p>

      <span className="mt-2.5 inline-block text-[10px] font-bold text-white/25 transition-colors group-hover:text-amber-400">
        افتح المحادثة كاملة الشاشة
      </span>
    </Link>
  );
}
