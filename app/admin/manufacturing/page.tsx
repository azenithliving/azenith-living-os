'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ManufacturingPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to unified agents page with manufacturing tab
    router.replace('/admin/agents?tab=manufacturing');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0A0A0A] text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-white/60">جاري التحويل للوحة التصنيع...</p>
      </div>
    </div>
  );
}
