"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Power, PowerOff, RefreshCw, Check, AlertCircle, Info, Key, Shield, Activity } from "lucide-react";

interface ApiKey {
  id: number;
  key: string;
  keyFull: string;
  isActive: boolean;
  isBackup: boolean;
  notes: string | null;
  cooldownUntil: string | null;
  totalRequests: number;
  lastUsedAt: string | null;
  createdAt: string;
  isDead?: boolean; // مفتاح ميت/محظور نهائياً
  lastError?: string | null; // آخر خطأ حصل
}

interface ProviderData {
  provider: string;
  keys: ApiKey[];
  stats: {
    total: number;
    active: number;
    backup: number;
    inCooldown: number;
    dead: number;
  };
}

interface AIKeysControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROVIDER_INFO: Record<string, { name: string; color: string; icon: string; feature: string }> = {
  groq: { name: "Groq", color: "bg-orange-500", icon: "⚡", feature: "Ultra-fast LLM inference" },
  openrouter: { name: "OpenRouter", color: "bg-purple-500", icon: "🔀", feature: "Multi-model routing" },
  mistral: { name: "Mistral AI", color: "bg-blue-500", icon: "🌊", feature: "European AI models" },
  deepseek: { name: "DeepSeek", color: "bg-indigo-500", icon: "🔍", feature: "Deep reasoning models" },
  openai: { name: "OpenAI", color: "bg-green-500", icon: "🤖", feature: "GPT-4 & GPT-3.5" },
  google: { name: "Google Gemini", color: "bg-yellow-500", icon: "💎", feature: "Vision & multimodal" },
  anthropic: { name: "Anthropic Claude", color: "bg-red-500", icon: "🧠", feature: "Long context windows" },
  cerebras: { name: "Cerebras", color: "bg-pink-500", icon: "⚡", feature: "Ultra-fast responses" },
  sambanova: { name: "SambaNova", color: "bg-teal-500", icon: "🚀", feature: "Emergency fallback" },
  together: { name: "Together AI", color: "bg-cyan-500", icon: "📄", feature: "Long-form generation" },
  cohere: { name: "Cohere", color: "bg-violet-500", icon: "🎯", feature: "Intent classification" },
  pexels: { name: "Pexels", color: "bg-emerald-500", icon: "📷", feature: "Stock images API" },
  xai: { name: "xAI", color: "bg-slate-500", icon: "✖️", feature: "Grok models" },
  aimlapi: { name: "AIML API", color: "bg-lime-500", icon: "🔗", feature: "Unified AI gateway" },
  cloudflare: { name: "Cloudflare AI", color: "bg-orange-400", icon: "☁️", feature: "Edge inference" },
  huggingface: { name: "Hugging Face", color: "bg-yellow-400", icon: "🤗", feature: "Open-source models" },
};

export default function AIKeysControlPanel({ isOpen, onClose }: AIKeysControlPanelProps) {
  const [providers, setProviders] = useState<ProviderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState({
    provider: "",
    key: "",
    notes: "",
    isBackup: false,
    testKey: true,
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<number>>(new Set());
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "backup" | "cooldown" | "dead">("all");

  useEffect(() => {
    if (isOpen) {
      loadKeys();
    }
  }, [isOpen]);

  const loadKeys = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/keys");
      const data = await res.json();
      if (data.success) {
        setProviders(data.providers);
      }
    } catch (error) {
      showMessage("error", "Failed to load keys");
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const addKey = async () => {
    if (!newKey.provider || !newKey.key) {
      showMessage("error", "Provider and key are required");
      return;
    }

    try {
      setActionLoading("add");
      const res = await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newKey),
      });
      const data = await res.json();

      if (data.success) {
        showMessage("success", "Key added successfully");
        setNewKey({ provider: "", key: "", notes: "", isBackup: false, testKey: true });
        setShowAddForm(false);
        await reloadKeys();
        await loadKeys();
      } else {
        showMessage("error", data.error || "Failed to add key");
      }
    } catch (error) {
      showMessage("error", "Network error");
    } finally {
      setActionLoading(null);
    }
  };

  const toggleKeyActive = async (id: number, currentState: boolean) => {
    try {
      setActionLoading(`toggle-${id}`);
      const res = await fetch(`/api/admin/keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentState }),
      });
      const data = await res.json();

      if (data.success) {
        showMessage("success", currentState ? "Key deactivated" : "Key activated");
        await reloadKeys();
        await loadKeys();
      } else {
        showMessage("error", "Failed to toggle key");
      }
    } catch (error) {
      showMessage("error", "Network error");
    } finally {
      setActionLoading(null);
    }
  };

  const deleteKey = async (id: number) => {
    if (!confirm("Are you sure you want to delete this key?")) return;

    try {
      setActionLoading(`delete-${id}`);
      const res = await fetch(`/api/admin/keys/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (data.success) {
        showMessage("success", "Key deleted successfully");
        await reloadKeys();
        await loadKeys();
      } else {
        showMessage("error", "Failed to delete key");
      }
    } catch (error) {
      showMessage("error", "Network error");
    } finally {
      setActionLoading(null);
    }
  };

  const clearCooldown = async (id: number) => {
    try {
      setActionLoading(`cooldown-${id}`);
      const res = await fetch(`/api/admin/keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearCooldown: true }),
      });
      const data = await res.json();

      if (data.success) {
        showMessage("success", "Cooldown cleared");
        await reloadKeys();
        await loadKeys();
      } else {
        showMessage("error", "Failed to clear cooldown");
      }
    } catch (error) {
      showMessage("error", "Network error");
    } finally {
      setActionLoading(null);
    }
  };

  const reloadKeys = async () => {
    try {
      setActionLoading("reload");
      const res = await fetch("/api/admin/keys/reload", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        showMessage("success", "Keys reloaded - changes active immediately");
      }
    } catch (error) {
      showMessage("error", "Reload failed");
    } finally {
      setActionLoading(null);
    }
  };

  const bulkToggle = async (active: boolean) => {
    if (selectedKeys.size === 0) return;

    try {
      setActionLoading("bulk");
      await Promise.all(
        Array.from(selectedKeys).map((id) =>
          fetch(`/api/admin/keys/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: active }),
          })
        )
      );
      showMessage("success", `${selectedKeys.size} keys ${active ? "activated" : "deactivated"}`);
      setSelectedKeys(new Set());
      await reloadKeys();
      await loadKeys();
    } catch (error) {
      showMessage("error", "Bulk action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const bulkDelete = async () => {
    if (selectedKeys.size === 0) return;
    if (!confirm(`Delete ${selectedKeys.size} keys?`)) return;

    try {
      setActionLoading("bulk");
      await Promise.all(
        Array.from(selectedKeys).map((id) =>
          fetch(`/api/admin/keys/${id}`, { method: "DELETE" })
        )
      );
      showMessage("success", `${selectedKeys.size} keys deleted`);
      setSelectedKeys(new Set());
      await reloadKeys();
      await loadKeys();
    } catch (error) {
      showMessage("error", "Bulk delete failed");
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOpen) return null;

  const selectedProviderData = providers.find((p) => p.provider === selectedProvider);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Key className="w-6 h-6 text-white" />
            <h2 className="text-2xl font-bold text-white">AI Keys Control Panel</h2>
            <span className="bg-white/20 text-white text-xs px-2 py-1 rounded">16 Providers</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={reloadKeys}
              disabled={actionLoading === "reload"}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${actionLoading === "reload" ? "animate-spin" : ""}`} />
              Hot Reload
            </button>
            <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div
            className={`px-6 py-3 ${
              message.type === "success" ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"
            } flex items-center gap-2`}
          >
            {message.type === "success" ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {message.text}
          </div>
        )}

        <div className="flex h-[calc(90vh-120px)]">
          {/* Sidebar - Provider List */}
          <div className="w-80 bg-slate-800/50 border-r border-slate-700 overflow-y-auto">
            <div className="p-4 border-b border-slate-700">
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-semibold transition"
              >
                <Plus className="w-5 h-5" />
                Add New Key
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading providers...</div>
            ) : (
              <div className="p-2">
                {Object.keys(PROVIDER_INFO).map((providerKey) => {
                  const providerData = providers.find((p) => p.provider === providerKey);
                  const info = PROVIDER_INFO[providerKey];
                  const stats = providerData?.stats || { total: 0, active: 0, backup: 0, inCooldown: 0 };

                  return (
                    <button
                      key={providerKey}
                      onClick={() => setSelectedProvider(providerKey)}
                      className={`w-full text-left p-3 rounded-lg mb-2 transition ${
                        selectedProvider === providerKey
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-700/30 hover:bg-slate-700/50 text-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{info.icon}</span>
                          <span className="font-semibold">{info.name}</span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${info.color} text-white`}>
                          {stats.total}
                        </span>
                      </div>
                      <div className="text-xs opacity-70 mb-2">{info.feature}</div>
                      <div className="flex gap-2 text-xs">
                        <span className="flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          {stats.active} active
                        </span>
                        {stats.backup > 0 && (
                          <span className="flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            {stats.backup} backup
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {showAddForm ? (
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-xl font-bold text-white mb-4">Add New API Key</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">Provider</label>
                    <select
                      value={newKey.provider}
                      onChange={(e) => setNewKey({ ...newKey, provider: e.target.value })}
                      className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">Select Provider</option>
                      {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                        <option key={key} value={key}>
                          {info.icon} {info.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">API Key</label>
                    <input
                      type="text"
                      value={newKey.key}
                      onChange={(e) => setNewKey({ ...newKey, key: e.target.value })}
                      placeholder="sk-..."
                      className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">Notes (Optional)</label>
                    <input
                      type="text"
                      value={newKey.notes}
                      onChange={(e) => setNewKey({ ...newKey, notes: e.target.value })}
                      placeholder="e.g., Production key, Team account..."
                      className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newKey.isBackup}
                        onChange={(e) => setNewKey({ ...newKey, isBackup: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <Shield className="w-4 h-4" />
                      Backup Key (auto-activates at 90% quota)
                    </label>
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newKey.testKey}
                        onChange={(e) => setNewKey({ ...newKey, testKey: e.target.checked })}
                        className="w-4 h-4"
                      />
                      Test key before adding
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={addKey}
                      disabled={actionLoading === "add"}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
                    >
                      {actionLoading === "add" ? "Adding..." : "Add Key"}
                    </button>
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : selectedProviderData ? (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                      <span className="text-3xl">{PROVIDER_INFO[selectedProvider!].icon}</span>
                      {PROVIDER_INFO[selectedProvider!].name}
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">{PROVIDER_INFO[selectedProvider!].feature}</p>
                  </div>
                  <div className="flex gap-2">
                    {selectedKeys.size > 0 && (
                      <>
                        <button
                          onClick={() => bulkToggle(true)}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1"
                        >
                          <Power className="w-4 h-4" />
                          Enable ({selectedKeys.size})
                        </button>
                        <button
                          onClick={() => bulkToggle(false)}
                          className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1"
                        >
                          <PowerOff className="w-4 h-4" />
                          Disable ({selectedKeys.size})
                        </button>
                        <button
                          onClick={bulkDelete}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete ({selectedKeys.size})
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Stats Cards - Filters */}
                <div className="grid grid-cols-5 gap-4 mb-6">
                  <button
                    onClick={() => setFilterStatus("all")}
                    className={`rounded-lg p-4 border transition-all ${
                      filterStatus === "all"
                        ? "bg-slate-700 border-slate-500 ring-2 ring-slate-400"
                        : "bg-slate-800 border-slate-700 hover:border-slate-600"
                    }`}
                  >
                    <div className="text-slate-400 text-sm mb-1">Total Keys</div>
                    <div className="text-2xl font-bold text-white">{selectedProviderData.stats.total}</div>
                  </button>
                  <button
                    onClick={() => setFilterStatus("active")}
                    className={`rounded-lg p-4 border transition-all ${
                      filterStatus === "active"
                        ? "bg-green-500/20 border-green-500 ring-2 ring-green-400"
                        : "bg-green-500/10 border-green-500/30 hover:border-green-500/50"
                    }`}
                  >
                    <div className="text-green-400 text-sm mb-1">Active</div>
                    <div className="text-2xl font-bold text-green-400">{selectedProviderData.stats.active}</div>
                  </button>
                  <button
                    onClick={() => setFilterStatus("backup")}
                    className={`rounded-lg p-4 border transition-all ${
                      filterStatus === "backup"
                        ? "bg-blue-500/20 border-blue-500 ring-2 ring-blue-400"
                        : "bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50"
                    }`}
                  >
                    <div className="text-blue-400 text-sm mb-1">Backup</div>
                    <div className="text-2xl font-bold text-blue-400">{selectedProviderData.stats.backup}</div>
                  </button>
                  <button
                    onClick={() => setFilterStatus("cooldown")}
                    className={`rounded-lg p-4 border transition-all ${
                      filterStatus === "cooldown"
                        ? "bg-orange-500/20 border-orange-500 ring-2 ring-orange-400"
                        : "bg-orange-500/10 border-orange-500/30 hover:border-orange-500/50"
                    }`}
                  >
                    <div className="text-orange-400 text-sm mb-1">In Cooldown</div>
                    <div className="text-2xl font-bold text-orange-400">{selectedProviderData.stats.inCooldown}</div>
                  </button>
                  <button
                    onClick={() => setFilterStatus("dead")}
                    className={`rounded-lg p-4 border transition-all ${
                      filterStatus === "dead"
                        ? "bg-red-500/20 border-red-500 ring-2 ring-red-400"
                        : "bg-red-500/10 border-red-500/30 hover:border-red-500/50"
                    }`}
                  >
                    <div className="text-red-400 text-sm mb-1">Dead/Banned</div>
                    <div className="text-2xl font-bold text-red-400">{selectedProviderData.stats.dead}</div>
                  </button>
                </div>

                {/* Keys Table */}
                <div className="space-y-2">
                  {(() => {
                    const filteredKeys = selectedProviderData.keys.filter((key) => {
                      if (filterStatus === "all") return true;
                      if (filterStatus === "active") return key.isActive && !key.isBackup && !key.isDead;
                      if (filterStatus === "backup") return key.isBackup;
                      if (filterStatus === "cooldown") {
                        const inCooldown = key.cooldownUntil && new Date(key.cooldownUntil) > new Date();
                        return inCooldown;
                      }
                      if (filterStatus === "dead") return key.isDead;
                      return true;
                    });

                    if (filteredKeys.length === 0 && filterStatus !== "all") {
                      return (
                        <div className="bg-slate-800 rounded-lg p-8 text-center border border-slate-700">
                          <p className="text-slate-400">
                            {filterStatus === "active" && "لا توجد مفاتيح نشطة"}
                            {filterStatus === "backup" && "لا توجد مفاتيح احتياطية"}
                            {filterStatus === "cooldown" && "لا توجد مفاتيح في فترة تهدئة"}
                            {filterStatus === "dead" && "لا توجد مفاتيح ميتة - رائع! ✅"}
                          </p>
                        </div>
                      );
                    }

                    if (selectedProviderData.keys.length === 0) {
                      return (
                    <div className="bg-slate-800 rounded-lg p-8 text-center border border-slate-700">
                      <Key className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">No keys added yet for this provider</p>
                      <button
                        onClick={() => {
                          setNewKey({ ...newKey, provider: selectedProvider! });
                          setShowAddForm(true);
                        }}
                        className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add First Key
                      </button>
                        </div>
                      );
                    }

                    return filteredKeys.map((key) => {
                      const inCooldown = key.cooldownUntil && new Date(key.cooldownUntil) > new Date();
                      const isSelected = selectedKeys.has(key.id);
                      const isDead = key.isDead || false;

                      return (
                        <div
                          key={key.id}
                          className={`rounded-lg p-4 border transition ${
                            isDead
                              ? "bg-red-500/10 border-red-500"
                              : isSelected
                              ? "border-indigo-500 bg-indigo-500/10"
                              : inCooldown
                              ? "bg-orange-500/5 border-orange-500/30"
                              : "bg-slate-800 border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const newSelected = new Set(selectedKeys);
                                if (e.target.checked) {
                                  newSelected.add(key.id);
                                } else {
                                  newSelected.delete(key.id);
                                }
                                setSelectedKeys(newSelected);
                              }}
                              className="w-4 h-4"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <code className={`text-sm font-mono ${isDead ? "text-red-400 line-through" : "text-slate-300"}`}>
                                  {key.key}
                                </code>
                                {isDead && (
                                  <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                                    <AlertCircle className="w-3 h-3" />
                                    ميت / محظور
                                  </span>
                                )}
                                {key.isBackup && !isDead && (
                                  <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded flex items-center gap-1">
                                    <Shield className="w-3 h-3" />
                                    Backup
                                  </span>
                                )}
                                {inCooldown && !isDead && (
                                  <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-0.5 rounded">
                                    يستريح...
                                  </span>
                                )}
                              </div>
                              {key.notes && <div className="text-xs text-slate-400">{key.notes}</div>}
                              {isDead && key.lastError && (
                                <div className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  خطأ: {key.lastError}
                                </div>
                              )}
                              <div className="flex gap-4 text-xs text-slate-500 mt-2">
                                <span>{key.totalRequests} طلب</span>
                                {key.lastUsedAt && <span>آخر استخدام: {new Date(key.lastUsedAt).toLocaleString("ar-EG")}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isDead ? (
                                <button
                                  onClick={() => deleteKey(key.id)}
                                  disabled={actionLoading === `delete-${key.id}`}
                                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded transition flex items-center gap-1"
                                  title="احذف نهائياً"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  احذف
                                </button>
                              ) : (
                                <>
                                  {inCooldown && (
                                    <button
                                      onClick={() => clearCooldown(key.id)}
                                      disabled={actionLoading === `cooldown-${key.id}`}
                                      className="text-orange-400 hover:text-orange-300 p-2"
                                      title="امسح فترة التهدئة"
                                    >
                                      <RefreshCw className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => toggleKeyActive(key.id, key.isActive)}
                                    disabled={actionLoading === `toggle-${key.id}`}
                                    className={`p-2 rounded transition ${
                                      key.isActive
                                        ? "text-green-400 hover:text-green-300"
                                        : "text-slate-500 hover:text-slate-400"
                                    }`}
                                    title={key.isActive ? "إيقاف" : "تفعيل"}
                                  >
                                    {key.isActive ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />}
                                  </button>
                                  <button
                                    onClick={() => deleteKey(key.id)}
                                    disabled={actionLoading === `delete-${key.id}`}
                                    className="text-red-400 hover:text-red-300 p-2"
                                    title="حذف المفتاح"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                <div className="text-center">
                  <Info className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Select a provider from the sidebar to manage keys</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
