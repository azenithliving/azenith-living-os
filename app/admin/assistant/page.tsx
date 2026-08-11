'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AssistantPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to unified agents page with assistant tab
    router.replace('/admin/agents?tab=assistant');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0A0A0A] text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C5A059] mx-auto mb-4"></div>
        <p className="text-white/60">جاري التحويل للمساعد الموحد...</p>
      </div>
    </div>
  );
}
