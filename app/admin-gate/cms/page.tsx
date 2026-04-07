"use client";

import { useState, useEffect } from "react";
import { Edit, Save, Image, Type, DollarSign, Upload, Check, AlertCircle } from "lucide-react";

interface SiteConfig {
  heroTitle: string;
  heroSubtitle: string;
  budgetOptions: string[];
  styleOptions: string[];
  serviceOptions: string[];
  heroBackground: string;
  lastUpdated: string;
}

const defaultConfig: SiteConfig = {
  heroTitle: "ابدأ رحلة التصميم الذكي.",
  heroSubtitle: "أربع اختيارات فقط تكفي لبناء ملف العميل، تقدير مبدئي، ورسالة واتساب جاهزة للفريق التجاري.",
  budgetOptions: [
    "2,500 - 5,500 EGP",
    "5,500 - 12,000 EGP",
    "12,000 - 25,000 EGP",
    "25,000+ EGP"
  ],
  styleOptions: [
    "مودرن دافئ",
    "هادئ فاخر",
    "عملي مع لمسة فندقية",
    "صناعي ناعم"
  ],
  serviceOptions: [
    "تصميم فقط",
    "تصميم وتجهيز",
    "تصميم وتنفيذ",
    "تجديد لمساحة قائمة"
  ],
  heroBackground: "/videos/hero-bg.mp4",
  lastUpdated: new Date().toISOString()
};

export default function CMSPage() {
  const [activeTab, setActiveTab] = useState<"text" | "media" | "pricing">("text");
  const [config, setConfig] = useState<SiteConfig>(defaultConfig);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Load config from database on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch("/api/cms/config");
      if (response.ok) {
        const data = await response.json();
        if (data.config) {
          setConfig({ ...defaultConfig, ...data.config });
        }
      }
    } catch (err) {
      console.error("Failed to load config:", err);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setError("");
    
    try {
      const response = await fetch("/api/cms/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        throw new Error("Failed to save configuration");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/cms/upload", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const data = await response.json();
      setConfig(prev => ({ ...prev, heroBackground: data.url }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  };

  const updateBudgetOption = (index: number, value: string) => {
    const newOptions = [...config.budgetOptions];
    newOptions[index] = value;
    setConfig(prev => ({ ...prev, budgetOptions: newOptions }));
  };

  const updateStyleOption = (index: number, value: string) => {
    const newOptions = [...config.styleOptions];
    newOptions[index] = value;
    setConfig(prev => ({ ...prev, styleOptions: newOptions }));
  };

  const updateServiceOption = (index: number, value: string) => {
    const newOptions = [...config.serviceOptions];
    newOptions[index] = value;
    setConfig(prev => ({ ...prev, serviceOptions: newOptions }));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Visual CMS Editor</h1>
          <p className="text-white/50">Edit your website content without coding</p>
        </div>
        <button
          onClick={saveConfig}
          disabled={saving}
          className="flex items-center gap-2 rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d] disabled:opacity-50"
        >
          {saving ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-accent border-t-transparent" />
              Saving...
            </>
          ) : saved ? (
            <>
              <Check className="h-4 w-4" />
              Saved!
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Changes
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {[
          { id: "text", label: "Text & Content", icon: Type },
          { id: "pricing", label: "Pricing & Options", icon: DollarSign },
          { id: "media", label: "Media & Visuals", icon: Image }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 border-b-2 px-6 py-4 text-sm font-medium transition ${
              activeTab === tab.id
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-white/50 hover:text-white"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Text Editor Tab */}
      {activeTab === "text" && (
        <div className="space-y-6">
          {/* Hero Title */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <label className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
              <Type className="h-4 w-4 text-brand-primary" />
              Hero Title (Start Page)
            </label>
            <textarea
              value={config.heroTitle}
              onChange={(e) => setConfig(prev => ({ ...prev, heroTitle: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-[#111112] px-4 py-3 text-lg text-white outline-none transition focus:border-brand-primary"
              rows={2}
              placeholder="Enter hero title..."
            />
            <p className="mt-2 text-xs text-white/40">
              This appears as the main headline on the /start page
            </p>
          </div>

          {/* Hero Subtitle */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <label className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
              <Edit className="h-4 w-4 text-brand-primary" />
              Hero Subtitle
            </label>
            <textarea
              value={config.heroSubtitle}
              onChange={(e) => setConfig(prev => ({ ...prev, heroSubtitle: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-[#111112] px-4 py-3 text-white outline-none transition focus:border-brand-primary"
              rows={3}
              placeholder="Enter hero subtitle..."
            />
          </div>

          {/* Live Preview */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <h3 className="mb-4 text-sm font-medium text-white/70">Live Preview</h3>
            <div className="rounded-xl bg-[#0A0A0A] p-8">
              <p className="text-sm uppercase tracking-[0.3em] text-brand-primary/70">Qualification flow</p>
              <h1 className="mt-4 font-serif text-4xl text-white">{config.heroTitle}</h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-white/65">{config.heroSubtitle}</p>
            </div>
          </div>
        </div>
      )}

      {/* Pricing & Options Tab */}
      {activeTab === "pricing" && (
        <div className="space-y-6">
          {/* Budget Options */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <label className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
              <DollarSign className="h-4 w-4 text-brand-primary" />
              Budget Options (/start page)
            </label>
            <div className="space-y-3">
              {config.budgetOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-sm text-white/40 w-8">{index + 1}.</span>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => updateBudgetOption(index, e.target.value)}
                    className="flex-1 rounded-xl border border-white/10 bg-[#111112] px-4 py-2 text-white outline-none transition focus:border-brand-primary"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Style Options */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <label className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
              <Edit className="h-4 w-4 text-brand-primary" />
              Style Options
            </label>
            <div className="space-y-3">
              {config.styleOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-sm text-white/40 w-8">{index + 1}.</span>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => updateStyleOption(index, e.target.value)}
                    className="flex-1 rounded-xl border border-white/10 bg-[#111112] px-4 py-2 text-white outline-none transition focus:border-brand-primary"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Service Options */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <label className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
              <Edit className="h-4 w-4 text-brand-primary" />
              Service Options
            </label>
            <div className="space-y-3">
              {config.serviceOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-sm text-white/40 w-8">{index + 1}.</span>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => updateServiceOption(index, e.target.value)}
                    className="flex-1 rounded-xl border border-white/10 bg-[#111112] px-4 py-2 text-white outline-none transition focus:border-brand-primary"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Media Tab */}
      {activeTab === "media" && (
        <div className="space-y-6">
          {/* Hero Background Upload */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <label className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
              <Image className="h-4 w-4 text-brand-primary" />
              Hero Background (Video or Image)
            </label>
            
            <div className="grid gap-6 md:grid-cols-2">
              {/* Current Preview */}
              <div className="space-y-3">
                <p className="text-xs text-white/50">Current Background</p>
                <div className="aspect-video rounded-xl overflow-hidden bg-[#111112]">
                  {config.heroBackground.endsWith('.mp4') ? (
                    <video
                      src={config.heroBackground}
                      className="h-full w-full object-cover"
                      muted
                      loop
                      autoPlay
                    />
                  ) : (
                    <img
                      src={config.heroBackground}
                      alt="Hero background"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
              </div>

              {/* Upload New */}
              <div className="space-y-3">
                <p className="text-xs text-white/50">Upload New (Auto-compressed)</p>
                <label className="flex h-full min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/20 bg-[#111112] transition hover:border-brand-primary hover:bg-white/5">
                  <Upload className="h-10 w-10 text-white/40" />
                  <p className="mt-2 text-sm text-white/60">Click to upload image/video</p>
                  <p className="text-xs text-white/40">Max 10MB, auto-compressed</p>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Or URL Input */}
            <div className="mt-6">
              <p className="mb-2 text-xs text-white/50">Or enter URL directly:</p>
              <input
                type="text"
                value={config.heroBackground}
                onChange={(e) => setConfig(prev => ({ ...prev, heroBackground: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-[#111112] px-4 py-2 text-white outline-none transition focus:border-brand-primary"
                placeholder="/videos/hero-bg.mp4 or /images/hero-bg.jpg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
