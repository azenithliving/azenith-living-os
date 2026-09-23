'use client';

/**
 * Qayyim Studio page — /admin/qayyim
 * المقر الرئيسي لسرب قيّم الدار
 */

import { QayyimStudio } from '@/components/admin/qayyim';

export default function QayyimStudioPage() {
  return (
    <div className="p-4 md:p-6 h-[calc(100vh-2rem)]">
      <QayyimStudio />
    </div>
  );
}
