"use client";

import { useEffect, useState } from "react";

import Image from "next/image";

type MediaAsset = {
  id: string;
  url: string;
  tags: string[];
  source: string;
  license?: string;
  ctr?: number;
  conversions?: number;
};

type PexelsPhoto = {
  id: number;
  src: {
    original: string;
    large: string;
    medium: string;
  };
  alt: string;
  photographer: string;
};

export default function MediaPage() {
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [pexelsPhotos, setPexelsPhotos] = useState<PexelsPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("interior design");
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"library" | "pexels">("library");

  useEffect(() => {
    fetchMediaAssets();
  }, []);

  const fetchMediaAssets = async () => {
    try {
      const response = await fetch("/api/media");
      const data = await response.json();
      if (data.ok) {
        setMediaAssets(data.assets || []);
      }
    } catch (error) {
      console.error("Failed to fetch media assets:", error);
    } finally {
      setLoading(false);
    }
  };

  const searchPexels = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await fetch(`/api/pexels?query=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data.ok) {
        setPexelsPhotos(data.photos || []);
      }
    } catch (error) {
      console.error("Failed to search Pexels:", error);
    } finally {
      setSearching(false);
    }
  };

  const importFromPexels = async (photo: PexelsPhoto) => {
    try {
      const response = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: photo.src.large,
          tags: ["interior", "design", searchQuery],
          source: "pexels",
          license: `Photo by ${photo.photographer} on Pexels`,
        }),
      });

      if (response.ok) {
        fetchMediaAssets();
        setPexelsPhotos(pexelsPhotos.filter(p => p.id !== photo.id));
      }
    } catch (error) {
      console.error("Failed to import photo:", error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        fetchMediaAssets();
      }
    } catch (error) {
      console.error("Failed to upload file:", error);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <main className="px-8 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-white">جاري تحميل مكتبة الوسائط...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="px-8 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">Media library</p>
            <h1 className="mt-3 font-serif text-4xl text-white md:text-5xl">مكتبة الوسائط</h1>
          </div>
          <div className="flex gap-3">
            <label className="rounded-full border border-white/10 px-6 py-3 text-sm text-white/70 transition hover:border-brand-primary hover:text-brand-primary cursor-pointer">
              {uploading ? "جاري الرفع..." : "رفع ملف"}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setActiveTab("library")}
              className={`flex-1 px-6 py-4 text-sm font-medium transition ${
                activeTab === "library"
                  ? "bg-brand-primary text-brand-accent"
                  : "text-white/70 hover:text-white"
              }`}
            >
              مكتبة الوسائط
            </button>
            <button
              onClick={() => setActiveTab("pexels")}
              className={`flex-1 px-6 py-4 text-sm font-medium transition ${
                activeTab === "pexels"
                  ? "bg-brand-primary text-brand-accent"
                  : "text-white/70 hover:text-white"
              }`}
            >
              استيراد من Pexels
            </button>
          </div>

          <div className="p-8">
            {activeTab === "library" ? (
              <>
                <h2 className="text-2xl font-semibold text-white">الصور المتاحة</h2>
                <p className="mt-2 text-sm text-white/60">الصور المحملة والمستوردة في مكتبة الوسائط.</p>

                {mediaAssets.length === 0 ? (
                  <div className="mt-6 text-center text-white/60">
                    لا توجد صور في المكتبة. استخدم تبويب Pexels لاستيراد صور أو ارفع صورك الخاصة.
                  </div>
                ) : (
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {mediaAssets.map((asset) => (
                      <div key={asset.id} className="group relative aspect-square overflow-hidden rounded-lg bg-white/5">
                        <Image
                          src={asset.url}
                          alt=""
                          fill
                          className="object-cover transition group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <button className="rounded bg-white/20 px-3 py-1 text-xs text-white backdrop-blur">
                            استخدام
                          </button>
                        </div>
                        {asset.tags.length > 0 && (
                          <div className="absolute bottom-2 left-2 flex gap-1">
                            {asset.tags.slice(0, 2).map((tag) => (
                              <span key={tag} className="rounded bg-black/50 px-2 py-1 text-xs text-white">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex gap-4 mb-6">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث عن صور..."
                    className="flex-1 rounded border border-white/20 bg-transparent px-4 py-2 text-white"
                    onKeyPress={(e) => e.key === "Enter" && searchPexels()}
                  />
                  <button
                    onClick={searchPexels}
                    disabled={searching}
                    className="rounded bg-brand-primary px-6 py-2 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d] disabled:opacity-50"
                  >
                    {searching ? "جاري البحث..." : "بحث"}
                  </button>
                </div>

                {pexelsPhotos.length === 0 ? (
                  <div className="text-center text-white/60">
                    ابحث عن صور لاستيرادها من Pexels
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {pexelsPhotos.map((photo) => (
                      <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg bg-white/5">
                        <Image
                          src={photo.src.medium}
                          alt={photo.alt}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2">
                          <button
                            onClick={() => importFromPexels(photo)}
                            className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-brand-accent"
                          >
                            استيراد
                          </button>
                          <p className="text-xs text-white/80 text-center px-2">
                            {photo.photographer}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}