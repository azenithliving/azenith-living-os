"use client";

import { useState, useEffect, useCallback } from "react";

interface ApiKey {
  id: number;
  provider: "groq" | "openrouter" | "mistral" | "pexels";
  key: string;
  is_active: boolean;
  cooldown_until: string | null;
  total_requests: number;
  last_used_at: string | null;
  created_at: string;
}

interface GroupedKeys {
  groq: ApiKey[];
  openrouter: ApiKey[];
  mistral: ApiKey[];
  pexels: ApiKey[];
}

export default function AdminKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [grouped, setGrouped] = useState<GroupedKeys>({
    groq: [],
    openrouter: [],
    mistral: [],
    pexels: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newKey, setNewKey] = useState({ provider: "groq", key: "" });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/keys");
      const data = await response.json();
      if (data.success) {
        setKeys(data.keys);
        setGrouped(data.grouped);
      } else {
        setError(data.error || "Failed to load keys");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleAddKey = async () => {
    if (!newKey.key.trim()) return;

    try {
      const response = await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: newKey.provider, key: newKey.key }),
      });
      const data = await response.json();
      if (data.success) {
        setShowModal(false);
        setNewKey({ provider: "groq", key: "" });
        fetchKeys();
      } else {
        alert(data.error || "Failed to add key");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add key");
    }
  };

  const handleTestKey = async () => {
    if (!newKey.key.trim()) return;
    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: newKey.provider, key: newKey.key, test: true }),
      });
      const data = await response.json();
      if (data.success) {
        setTestResult({ valid: data.valid, message: data.message });
      } else {
        setTestResult({ valid: false, message: data.error || "Test failed" });
      }
    } catch (err) {
      setTestResult({ valid: false, message: err instanceof Error ? err.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleDeleteKey = async (id: number) => {
    if (!confirm("Are you sure you want to delete this key?")) return;
    setDeleting(id);

    try {
      const response = await fetch("/api/admin/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (data.success) {
        fetchKeys();
      } else {
        alert(data.error || "Failed to delete key");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete key");
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString("ar-SA");
  };

  const isInCooldown = (cooldownUntil: string | null) => {
    if (!cooldownUntil) return false;
    return new Date(cooldownUntil) > new Date();
  };

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case "groq":
        return "bg-orange-100 text-orange-800";
      case "openrouter":
        return "bg-purple-100 text-purple-800";
      case "mistral":
        return "bg-blue-100 text-blue-800";
      case "pexels":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const renderProviderTable = (provider: keyof GroupedKeys, title: string) => {
    const providerKeys = grouped[provider];
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getProviderColor(provider)}`}>
            {providerKeys.length} مفاتيح
          </span>
        </div>
        {providerKeys.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
            لا توجد مفاتيح لهذا المزود
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white rounded-lg shadow">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">المفتاح</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الحالة</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الطلبات</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">آخر استخدام</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Cooldown</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {providerKeys.map((key) => (
                  <tr key={key.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm text-gray-600">{key.key}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          key.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {key.is_active ? "نشط" : "معطل"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{key.total_requests.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(key.last_used_at)}</td>
                    <td className="px-4 py-3">
                      {isInCooldown(key.cooldown_until) ? (
                        <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                          حتى {formatDate(key.cooldown_until)}
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDeleteKey(key.id)}
                        disabled={deleting === key.id}
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                      >
                        {deleting === key.id ? "جاري..." : "حذف"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-8 flex items-center justify-center">
        <div className="text-gray-600">جاري تحميل المفاتيح...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-8 flex items-center justify-center">
        <div className="text-red-600">خطأ: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">إدارة مفاتيح API</h1>
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            + إضافة مفتاح جديد
          </button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-gray-800">{keys.length}</div>
            <div className="text-sm text-gray-600">إجمالي المفاتيح</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-green-600">
              {keys.filter((k) => k.is_active).length}
            </div>
            <div className="text-sm text-gray-600">المفاتيح النشطة</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {keys.filter((k) => isInCooldown(k.cooldown_until)).length}
            </div>
            <div className="text-sm text-gray-600">في Cooldown</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-gray-800">
              {keys.reduce((sum, k) => sum + k.total_requests, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">إجمالي الطلبات</div>
          </div>
        </div>

        {/* Provider Tables */}
        {renderProviderTable("groq", "Groq (Llama)")}
        {renderProviderTable("mistral", "Mistral AI")}
        {renderProviderTable("openrouter", "OpenRouter (Claude)")}
        {renderProviderTable("pexels", "Pexels (Images)")}
      </div>

      {/* Add Key Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">إضافة مفتاح جديد</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">المزود</label>
              <select
                value={newKey.provider}
                onChange={(e) => setNewKey({ ...newKey, provider: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
              >
                <option value="groq">Groq (Llama)</option>
                <option value="mistral">Mistral AI</option>
                <option value="openrouter">OpenRouter (Claude)</option>
                <option value="pexels">Pexels (Images)</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">المفتاح</label>
              <textarea
                value={newKey.key}
                onChange={(e) => setNewKey({ ...newKey, key: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 font-mono text-sm"
                rows={3}
                placeholder="gsk_... أو sk-..."
              />
            </div>

            {testResult && (
              <div
                className={`mb-4 p-3 rounded ${
                  testResult.valid ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                }`}
              >
                {testResult.valid ? "✓" : "✗"} {testResult.message}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleTestKey}
                disabled={testing || !newKey.key.trim()}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
              >
                {testing ? "جاري الاختبار..." : "اختبار المفتاح"}
              </button>
              <button
                onClick={handleAddKey}
                disabled={!newKey.key.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                إضافة
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  setNewKey({ provider: "groq", key: "" });
                  setTestResult(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
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
