'use client';

import { useState } from 'react';

interface QualityCheck {
  id: string;
  production_job_id: string;
  job_title: string;
  check_type: string;
  stage_name: string;
  status: 'pending' | 'pass' | 'fail' | 'conditional_pass';
  notes: string;
  checked_by: string;
  checked_at: string;
  photos: string[];
}

interface QualityCheckPanelProps {
  productionJobId?: string;
  jobTitle?: string;
  onSubmit?: (result: any) => void;
}

export function QualityCheckPanel({ 
  productionJobId = 'demo-job', 
  jobTitle = 'مهمة إنتاج',
  onSubmit 
}: QualityCheckPanelProps) {
  const [status, setStatus] = useState<'pass' | 'fail' | 'conditional_pass' | 'pending'>('pending');
  const [notes, setNotes] = useState('');
  const [checkType, setCheckType] = useState('final');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  async function submitCheck() {
    setSubmitting(true);
    
    try {
      // Mock success for demo
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockResult = {
        id: `qc-${Date.now()}`,
        production_job_id: productionJobId,
        check_type: checkType,
        status,
        notes,
        checked_at: new Date().toISOString()
      };
      
      setSubmitted(true);
      onSubmit?.(mockResult);
    } catch (err) {
      console.error('Error submitting quality check:', err);
    }
    
    setSubmitting(false);
  }
  
  if (submitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <div className="text-4xl mb-2">✓</div>
        <h4 className="font-semibold text-green-800">تم إرسال فحص الجودة</h4>
        <p className="text-sm text-green-600">الحالة: {status === 'pass' ? 'ناجح' : status === 'fail' ? 'فاشل' : 'نجاح مشروط'}</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold mb-1">فحص الجودة</h3>
      <p className="text-sm text-gray-500 mb-4">{jobTitle}</p>
      
      <div className="space-y-4">
        {/* Check Type */}
        <div>
          <label className="block text-sm font-medium mb-2">نوع الفحص</label>
          <select
            value={checkType}
            onChange={(e) => setCheckType(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="incoming_material">فحص مواد واردة</option>
            <option value="in_process">فحص أثناء العمل</option>
            <option value="pre_finish">قبل التشطيب</option>
            <option value="final">فحص نهائي</option>
          </select>
        </div>
        
        {/* Status */}
        <div>
          <label className="block text-sm font-medium mb-2">نتيجة الفحص</label>
          <div className="grid grid-cols-3 gap-2">
            {(['pass', 'conditional_pass', 'fail'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`py-3 rounded-lg font-medium transition-colors ${
                  status === s
                    ? s === 'pass' ? 'bg-green-500 text-white shadow-lg' :
                      s === 'conditional_pass' ? 'bg-yellow-500 text-white shadow-lg' :
                      'bg-red-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {s === 'pass' && '✓ ناجح'}
                {s === 'conditional_pass' && '~ مشروط'}
                {s === 'fail' && '✗ فاشل'}
              </button>
            ))}
          </div>
        </div>
        
        {/* Notes */}
        <div>
          <label className="block text-sm font-medium mb-2">ملاحظات</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="أضف ملاحظاتك عن الفحص..."
            className="w-full border rounded px-3 py-2 h-24 resize-none"
          />
        </div>
        
        {/* Submit */}
        <button
          onClick={submitCheck}
          disabled={submitting || status === 'pending'}
          className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 
            disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors
            flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              جاري الإرسال...
            </>
          ) : (
            <>إرسال فحص الجودة</>
          )}
        </button>
      </div>
    </div>
  );
}
