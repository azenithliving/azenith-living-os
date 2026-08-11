"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Power, PowerOff, RefreshCw, Check, AlertCircle, Info, Key, Shield, Activity, Clock, Menu } from "lucide-react";

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
    inactive: number;
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
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "backup" | "cooldown" | "dead" | "inactive">("all");
  const [selectCount, setSelectCount] = useState<string>("");
  const [showSelectCountDialog, setShowSelectCountDialog] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
      showMessage("success", `${selectedKeys.size} مفتاح ${active ? "تم تفعيله" : "تم إيقافه"}`);
      setSelectedKeys(new Set());
      await reloadKeys();
      await loadKeys();
    } catch (error) {
      showMessage("error", "فشل الإجراء الجماعي");
    } finally {
      setActionLoading(null);
    }
  };

  const bulkMoveTo = async (target: "active" | "inactive" | "backup" | "cooldown" | "dead") => {
    if (selectedKeys.size === 0) return;

    try {
      setActionLoading("bulk");
      
      // تحضير التحديثات حسب الفلتر المستهدف
      const updates: any = {};
      
      if (target === "active") {
        updates.isActive = true;
        updates.isBackup = false;
        updates.clearCooldown = true;
      } else if (target === "inactive") {
        updates.isActive = false;
        updates.isBackup = false;
      } else if (target === "backup") {
        updates.isBackup = true;
        updates.isActive = false;
      } else if (target === "cooldown") {
        updates.cooldownUntil = new Date(Date.now() + 3600000).toISOString(); // 1 hour
      }

      await Promise.all(
        Array.from(selectedKeys).map((id) =>
          fetch(`/api/admin/keys/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          })
        )
      );

      const targetNames: Record<string, string> = {
        active: "نشط",
        inactive: "متوقف",
        backup: "احتياطي",
        cooldown: "راحة",
        dead: "ميت"
      };

      showMessage("success", `تم نقل ${selectedKeys.size} مفتاح إلى "${targetNames[target]}"`);
      setSelectedKeys(new Set());
      await reloadKeys();
      await loadKeys();
    } catch (error) {
      showMessage("error", "فشل النقل");
    } finally {
      setActionLoading(null);
    }
  };

  const bulkSetBackup = async (isBackup: boolean) => {
    if (selectedKeys.size === 0) return;

    try {
      setActionLoading("bulk");
      await Promise.all(
        Array.from(selectedKeys).map((id) =>
          fetch(`/api/admin/keys/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isBackup }),
          })
        )
      );
      showMessage("success", `${selectedKeys.size} مفتاح ${isBackup ? "تم نقله للاحتياطي" : "تم إلغاء الاحتياطي"}`);
      setSelectedKeys(new Set());
      await reloadKeys();
      await loadKeys();
    } catch (error) {
      showMessage("error", "فشل النقل");
    } finally {
      setActionLoading(null);
    }
  };

  const selectAll = () => {
    const filteredKeys = getFilteredKeys();
    const allIds = new Set(filteredKeys.map((k) => k.id));
    setSelectedKeys(allIds);
  };

  const selectByCount = () => {
    const count = parseInt(selectCount);
    if (isNaN(count) || count <= 0) {
      showMessage("error", "أدخل رقم صحيح");
      return;
    }

    const filteredKeys = getFilteredKeys();
    const selectedIds = new Set(filteredKeys.slice(0, count).map((k) => k.id));
    setSelectedKeys(selectedIds);
    setShowSelectCountDialog(false);
    setSelectCount("");
  };

  const getFilteredKeys = () => {
    if (!selectedProvider || !providers.find((p) => p.provider === selectedProvider)) return [];
    const providerData = providers.find((p) => p.provider === selectedProvider);
    if (!providerData) return [];

    return providerData.keys.filter((key) => {
      if (filterStatus === "all") return true;
      if (filterStatus === "active") return key.isActive && !key.isBackup && !key.isDead;
      if (filterStatus === "backup") return key.isBackup;
      if (filterStatus === "cooldown") {
        const inCooldown = key.cooldownUntil && new Date(key.cooldownUntil) > new Date();
        return inCooldown;
      }
      if (filterStatus === "dead") return key.isDead;
      if (filterStatus === "inactive") return !key.isActive && !key.isDead;
      return true;
    });
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-hidden">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden border border-slate-700 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 md:px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 md:gap-3">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setDrawerOpen(!drawerOpen)}
              className="md:hidden text-white hover:bg-white/20 p-2 rounded-lg transition"
              aria-label="Toggle menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Key className="w-5 h-5 md:w-6 md:h-6 text-white" />
            <h2 className="text-lg md:text-2xl font-bold text-white">AI Keys Control</h2>
            <span className="hidden sm:inline bg-white/20 text-white text-xs px-2 py-1 rounded">16 مزود</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={reloadKeys}
              disabled={actionLoading === "reload"}
              className="flex items-center gap-1 md:gap-2 bg-white/20 hover:bg-white/30 text-white px-2 md:px-4 py-2 rounded-lg transition disabled:opacity-50 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${actionLoading === "reload" ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Hot Reload</span>
            </button>
            <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div
            className={`px-4 md:px-6 py-3 ${
              message.type === "success" ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"
            } flex items-center gap-2 text-sm flex-shrink-0`}
          >
            {message.type === "success" ? <Check className="w-4 h-4 md:w-5 md:h-5" /> : <AlertCircle className="w-4 h-4 md:w-5 md:h-5" />}
            {message.text}
          </div>
        )}

        <div className="flex h-full min-h-0 relative">
          {/* Drawer Backdrop */}
          {drawerOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-10 md:hidden"
              onClick={() => setDrawerOpen(false)}
            />
          )}

          {/* Drawer Tab (visible on mobile) */}
          {!drawerOpen && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="fixed left-0 top-1/2 -translate-y-1/2 bg-indigo-600 text-white px-1 py-8 rounded-r-lg shadow-lg z-10 md:hidden flex flex-col items-center gap-1 text-xs font-bold"
              style={{ writingMode: "vertical-rl" }}
            >
              MENU
            </button>
          )}

          {/* Sidebar - Drawer on Mobile, Fixed on Desktop */}
          <div
            className={`
              fixed md:relative inset-y-0 left-0 z-20
              w-72 md:w-80
              bg-slate-800/50 border-r border-slate-700
              transform transition-transform duration-300 ease-in-out
              ${drawerOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
              overflow-y-auto flex-shrink-0
            `}
          >
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
                      onClick={() => {
                        setSelectedProvider(providerKey);
                        setDrawerOpen(false); // Close drawer after selection on mobile
                      }}
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
          <div className="flex-1 overflow-y-auto p-3 md:p-6 min-w-0">
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
                  
                  {/* Bulk Actions */}
                  <div className="flex gap-1 md:gap-2 items-center flex-wrap">
                    {selectedKeys.size > 0 && (
                      <>
                        <div className="text-slate-400 text-xs md:text-sm mr-1 md:mr-2 w-full md:w-auto mb-1 md:mb-0">
                          {selectedKeys.size} محدد
                        </div>
                        <div className="text-slate-500 text-xs mr-1 hidden md:inline">نقل إلى:</div>
                        <button
                          onClick={() => bulkMoveTo("active")}
                          className="bg-green-600 hover:bg-green-700 text-white px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm flex items-center gap-1 transition"
                          title="نقل للمفاتيح النشطة"
                        >
                          <Power className="w-3 h-3 md:w-4 md:h-4" />
                          <span className="hidden sm:inline">نشط</span>
                        </button>
                        <button
                          onClick={() => bulkMoveTo("inactive")}
                          className="bg-slate-600 hover:bg-slate-700 text-white px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm flex items-center gap-1 transition"
                          title="نقل للمفاتيح المتوقفة"
                        >
                          <PowerOff className="w-3 h-3 md:w-4 md:h-4" />
                          <span className="hidden sm:inline">متوقف</span>
                        </button>
                        <button
                          onClick={() => bulkMoveTo("backup")}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm flex items-center gap-1 transition"
                          title="نقل للاحتياطي"
                        >
                          <Shield className="w-3 h-3 md:w-4 md:h-4" />
                          <span className="hidden sm:inline">احتياطي</span>
                        </button>
                        <button
                          onClick={() => bulkMoveTo("cooldown")}
                          className="bg-orange-600 hover:bg-orange-700 text-white px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm flex items-center gap-1 transition"
                          title="نقل لفترة تهدئة (راحة)"
                        >
                          <Clock className="w-3 h-3 md:w-4 md:h-4" />
                          <span className="hidden sm:inline">راحة</span>
                        </button>
                        <button
                          onClick={bulkDelete}
                          className="bg-red-600 hover:bg-red-700 text-white px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm flex items-center gap-1 transition"
                          title="حذف المحددة نهائياً"
                        >
                          <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                          <span className="hidden sm:inline">حذف</span>
                        </button>
                      </>
                    )}
                    
                    {/* Select Actions */}
                    {getFilteredKeys().length > 0 && (
                      <>
                        <button
                          onClick={selectAll}
                          className="bg-slate-700 hover:bg-slate-600 text-white px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm flex items-center gap-1 transition"
                          title="تحديد الكل"
                        >
                          <Check className="w-3 h-3 md:w-4 md:h-4" />
                          <span className="hidden sm:inline">تحديد الكل</span>
                        </button>
                        <button
                          onClick={() => setShowSelectCountDialog(true)}
                          className="bg-slate-700 hover:bg-slate-600 text-white px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm transition"
                          title="تحديد عدد"
                        >
                          عدد...
                        </button>
                        {selectedKeys.size > 0 && (
                          <button
                            onClick={() => setSelectedKeys(new Set())}
                            className="bg-slate-700 hover:bg-slate-600 text-white px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm transition"
                            title="إلغاء التحديد"
                          >
                            <X className="w-3 h-3 md:w-4 md:h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Stats Cards - Filters */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-4 mb-4 md:mb-6">
                  <button
                    onClick={() => setFilterStatus("all")}
                    className={`rounded-lg p-4 border transition-all ${
                      filterStatus === "all"
                        ? "bg-slate-700 border-slate-500 ring-2 ring-slate-400"
                        : "bg-slate-800 border-slate-700 hover:border-slate-600"
                    }`}
                  >
                    <div className="text-slate-400 text-sm mb-1">الكل</div>
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
                    <div className="text-green-400 text-sm mb-1">نشط</div>
                    <div className="text-2xl font-bold text-green-400">{selectedProviderData.stats.active}</div>
                  </button>
                  <button
                    onClick={() => setFilterStatus("inactive")}
                    className={`rounded-lg p-4 border transition-all ${
                      filterStatus === "inactive"
                        ? "bg-slate-500/20 border-slate-500 ring-2 ring-slate-400"
                        : "bg-slate-500/10 border-slate-500/30 hover:border-slate-500/50"
                    }`}
                  >
                    <div className="text-slate-400 text-sm mb-1">متوقف</div>
                    <div className="text-2xl font-bold text-slate-400">{selectedProviderData.stats.inactive}</div>
                  </button>
                  <button
                    onClick={() => setFilterStatus("backup")}
                    className={`rounded-lg p-4 border transition-all ${
                      filterStatus === "backup"
                        ? "bg-blue-500/20 border-blue-500 ring-2 ring-blue-400"
                        : "bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50"
                    }`}
                  >
                    <div className="text-blue-400 text-sm mb-1">احتياطي</div>
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
                    <div className="text-orange-400 text-sm mb-1">يستريح</div>
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
                    <div className="text-red-400 text-sm mb-1">ميت</div>
                    <div className="text-2xl font-bold text-red-400">{selectedProviderData.stats.dead}</div>
                  </button>
                </div>

                {/* Keys Table */}
                <div className="space-y-2">
                  {(() => {
                    const filteredKeys = getFilteredKeys();

                    if (filteredKeys.length === 0 && filterStatus !== "all") {
                      return (
                        <div className="bg-slate-800 rounded-lg p-8 text-center border border-slate-700">
                          <p className="text-slate-400">
                            {filterStatus === "active" && "لا توجد مفاتيح نشطة"}
                            {filterStatus === "inactive" && "لا توجد مفاتيح متوقفة"}
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

      {/* Select Count Dialog */}
      {showSelectCountDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">تحديد عدد من المفاتيح</h3>
            <p className="text-slate-400 text-sm mb-4">
              إجمالي المفاتيح في هذا الفلتر: <span className="text-white font-bold">{getFilteredKeys().length}</span>
            </p>
            <input
              type="number"
              value={selectCount}
              onChange={(e) => setSelectCount(e.target.value)}
              placeholder="أدخل العدد..."
              className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={selectByCount}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition"
              >
                تحديد
              </button>
              <button
                onClick={() => {
                  setShowSelectCountDialog(false);
                  setSelectCount("");
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
