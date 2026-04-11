"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Diamond Leads Dashboard Component
 * High-priority lead filtering and WhatsApp integration
 */

export type Lead = {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  scope: string;
  budget: string;
  timeline: string;
  score: number;
  tier: "Diamond" | "Gold" | "Silver";
  priority: "urgent" | "high" | "medium" | "low";
  intent: string;
  styleDNA?: {
    dominantStyles: string[];
    colorPalette: string[];
    materials: string[];
    moodKeywords: string[];
  };
  viewedImages: number;
  createdAt: string;
  pdfGenerated?: boolean;
};

interface DiamondLeadsProps {
  leads: Lead[];
  adminWhatsApp?: string;
}

const tierConfig = {
  Diamond: {
    emoji: "💎",
    bg: "bg-gradient-to-r from-amber-500/20 to-yellow-400/10",
    border: "border-amber-400/50",
    text: "text-amber-300",
  },
  Gold: {
    emoji: "🥇",
    bg: "bg-gradient-to-r from-yellow-500/15 to-amber-300/10",
    border: "border-yellow-400/40",
    text: "text-yellow-300",
  },
  Silver: {
    emoji: "🥈",
    bg: "bg-slate-500/10",
    border: "border-slate-400/30",
    text: "text-slate-300",
  },
};

const priorityConfig = {
  urgent: { color: "text-red-400", bg: "bg-red-500/20", label: "URGENT" },
  high: { color: "text-orange-400", bg: "bg-orange-500/20", label: "HIGH" },
  medium: { color: "text-yellow-400", bg: "bg-yellow-500/20", label: "MEDIUM" },
  low: { color: "text-blue-400", bg: "bg-blue-500/20", label: "LOW" },
};

export function DiamondLeads({ leads, adminWhatsApp }: DiamondLeadsProps) {
  const [filter, setFilter] = useState<"all" | "diamond" | "gold" | "silver" | "urgent">("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  const filteredLeads = leads.filter((lead) => {
    if (filter === "all") return true;
    if (filter === "diamond") return lead.tier === "Diamond";
    if (filter === "gold") return lead.tier === "Gold";
    if (filter === "silver") return lead.tier === "Silver";
    if (filter === "urgent") return lead.priority === "urgent" || lead.priority === "high";
    return true;
  });

  const diamondCount = leads.filter((l) => l.tier === "Diamond").length;
  const urgentCount = leads.filter((l) => l.priority === "urgent" || l.priority === "high").length;

  const handleWhatsAppClick = async (lead: Lead) => {
    if (!adminWhatsApp) return;
    
    setSendingWhatsApp(true);
    setSelectedLead(lead);
    
    try {
      // Build WhatsApp message
      const message = buildLeadDossierMessage(lead);
      const whatsappUrl = `https://wa.me/${adminWhatsApp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
      
      // Log the action
      await fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "whatsapp_dossier_click",
          leadId: lead.id,
          tier: lead.tier,
          priority: lead.priority,
        }),
      });
      
      window.open(whatsappUrl, "_blank");
    } finally {
      setSendingWhatsApp(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
          <p className="text-2xl font-bold text-amber-300">{diamondCount}</p>
          <p className="text-sm text-amber-200/70">💎 Diamond Leads</p>
        </div>
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4">
          <p className="text-2xl font-bold text-red-300">{urgentCount}</p>
          <p className="text-sm text-red-200/70">🔥 Urgent Priority</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-2xl font-bold text-white">{leads.length}</p>
          <p className="text-sm text-white/60">Total Leads</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-2xl font-bold text-white">
            {Math.round(leads.reduce((acc, l) => acc + l.score, 0) / leads.length || 0)}
          </p>
          <p className="text-sm text-white/60">Avg Score</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: "All Leads", count: leads.length },
          { key: "diamond", label: "💎 Diamond", count: diamondCount },
          { key: "gold", label: "🥇 Gold", count: leads.filter((l) => l.tier === "Gold").length },
          { key: "urgent", label: "🔥 Urgent", count: urgentCount },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as typeof filter)}
            className={`rounded-lg px-4 py-2 text-sm transition-all ${
              filter === tab.key
                ? "bg-amber-500/20 text-amber-300 border border-amber-400/50"
                : "bg-white/[0.03] text-white/60 border border-white/10 hover:border-white/20"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Leads List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredLeads.map((lead) => {
            const config = tierConfig[lead.tier];
            const priority = priorityConfig[lead.priority];

            return (
              <motion.article
                key={lead.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`rounded-2xl border p-5 ${config.border} ${config.bg}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {/* Lead Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{config.emoji}</span>
                      <h3 className="text-lg font-semibold text-white">{lead.fullName}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${priority.bg} ${priority.color}`}>
                        {priority.label}
                      </span>
                      {lead.pdfGenerated && (
                        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">
                          📄 PDF Ready
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid gap-2 text-sm md:grid-cols-4">
                      <div>
                        <span className="text-white/40">Scope:</span>
                        <span className="ml-2 text-white">{lead.scope}</span>
                      </div>
                      <div>
                        <span className="text-white/40">Budget:</span>
                        <span className={`ml-2 font-medium ${config.text}`}>{lead.budget}</span>
                      </div>
                      <div>
                        <span className="text-white/40">Timeline:</span>
                        <span className="ml-2 text-white">{lead.timeline}</span>
                      </div>
                      <div>
                        <span className="text-white/40">Score:</span>
                        <span className="ml-2 font-bold text-white">{lead.score}/100</span>
                      </div>
                    </div>

                    {/* Style DNA Preview */}
                    {lead.styleDNA && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {lead.styleDNA.dominantStyles.slice(0, 3).map((style) => (
                          <span
                            key={style}
                            className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70"
                          >
                            {style}
                          </span>
                        ))}
                        {lead.viewedImages > 0 && (
                          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-xs text-amber-300">
                            👁 {lead.viewedImages} images
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    {adminWhatsApp && (
                      <button
                        onClick={() => handleWhatsAppClick(lead)}
                        disabled={sendingWhatsApp && selectedLead?.id === lead.id}
                        className="flex items-center gap-2 rounded-lg bg-green-500/20 px-4 py-2 text-sm text-green-300 transition-colors hover:bg-green-500/30 disabled:opacity-50"
                      >
                        {sendingWhatsApp && selectedLead?.id === lead.id ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-green-300/30 border-t-green-300" />
                        ) : (
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        )}
                        WhatsApp
                      </button>
                    )}
                    <span className="text-xs text-white/40">
                      {new Date(lead.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>

        {filteredLeads.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-white/60">No leads match the selected filter</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Build WhatsApp message with lead dossier
 */
function buildLeadDossierMessage(lead: Lead): string {
  const tierEmoji = { Diamond: "💎", Gold: "🥇", Silver: "🥈" }[lead.tier];
  const priorityEmoji = { urgent: "🔴", high: "🟠", medium: "🟡", low: "🔵" }[lead.priority];

  const lines = [
    `${tierEmoji} *${lead.tier.toUpperCase()} LEAD* ${tierEmoji}`,
    "",
    `*Client:* ${lead.fullName}`,
    `*Phone:* ${lead.phone}`,
    lead.email ? `*Email:* ${lead.email}` : "",
    "",
    `*Scope:* ${lead.scope}`,
    `*Budget:* ${lead.budget}`,
    `*Timeline:* ${lead.timeline}`,
    "",
    `*Priority:* ${priorityEmoji} ${lead.priority.toUpperCase()}`,
    `*Score:* ${lead.score}/100`,
  ];

  if (lead.styleDNA) {
    lines.push(
      "",
      "*Style DNA:*",
      `• ${lead.styleDNA.dominantStyles.join(", ")}`,
      `• Colors: ${lead.styleDNA.colorPalette.slice(0, 3).join(", ")}`,
      `• Materials: ${lead.styleDNA.materials.slice(0, 3).join(", ")}`
    );
  }

  if (lead.viewedImages > 0) {
    lines.push(`", "*Images Viewed:* ${lead.viewedImages}`);
  }

  lines.push("", "─────────────────", "Reply READY to claim");

  return lines.filter(Boolean).join("\n");
}
