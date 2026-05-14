'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function WhatsAppAdminPage() {
  const [status, setStatus] = useState<string>('INITIALIZING');
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/admin/whatsapp/status');
      const data = await res.json();
      if (data.success) {
        setStatus(data.status);
        setQr(data.qr);
      }
    } catch (error) {
      console.error('Failed to fetch WhatsApp status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const initializeClient = async () => {
    console.log('[WhatsApp UI] Clicked initialize button');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/whatsapp/status', { method: 'POST' });
      const data = await res.json();
      console.log('[WhatsApp UI] Initialization response:', data);
      
      if (data.success) {
        // We don't alert here to keep it smooth, just update status
        fetchStatus();
      } else {
        alert('فشل بدء الخدمة: ' + (data.error || 'خطأ غير معروف'));
      }
    } catch (error: any) {
      console.error('[WhatsApp UI] Fetch error:', error);
      alert('حدث خطأ أثناء التواصل مع السيرفر: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-green-600 p-6 text-white">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span>📱</span> إعدادات WhatsApp
          </h1>
          <p className="opacity-90 mt-1">اربط حسابك لتفعيل تواصل الـ Agents مع العملاء</p>
        </div>

        <div className="p-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">حالة الاتصال</h2>
                <div className="mt-2 flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full animate-pulse ${
                    status === 'READY' ? 'bg-green-500' : 
                    status === 'QR_READY' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <span className="text-xl font-bold text-gray-800">{status}</span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-gray-600 leading-relaxed">
                  {status === 'READY' 
                    ? 'الخدمة متصلة وجاهزة لإرسال واستقبال الرسائل. الـ Agents الآن لديهم "صوت" حقيقي.' 
                    : status === 'QR_READY' 
                    ? 'من فضلك امسح رمز الاستجابة السريعة (QR Code) باستخدام تطبيق واتساب على هاتفك.' 
                    : status === 'INITIALIZING'
                    ? 'جاري تهيئة متصفح WhatsApp في الخلفية... قد يستغرق هذا دقيقة في المرة الأولى.'
                    : 'الخدمة غير مفعلة حالياً. اضغط على الزر أدناه لبدء التشغيل.'}
                </p>
                
                {status === 'DISCONNECTED' || status === 'INITIALIZING' ? (
                  <button 
                    onClick={initializeClient}
                    disabled={loading}
                    className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all disabled:opacity-50"
                  >
                    {loading ? 'جاري التشغيل...' : 'تشغيل الخدمة'}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="w-64 h-64 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center relative">
              {qr ? (
                <div className="p-4 bg-white rounded-lg shadow-sm">
                  <QRCodeSVG value={qr} size={200} />
                </div>
              ) : status === 'READY' ? (
                <div className="text-center p-4">
                  <div className="text-4xl mb-2">✅</div>
                  <div className="text-green-600 font-bold">متصل بنجاح</div>
                </div>
              ) : (
                <div className="text-gray-400 text-center p-4">
                  <div className="text-3xl mb-2">⏳</div>
                  <div className="text-sm">في انتظار الـ QR...</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-6 border-t border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-2">ملاحظات هامة:</h3>
          <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside">
            <li>يجب أن يظل الهاتف متصلاً بالإنترنت لضمان استقرار الخدمة.</li>
            <li>يتم تخزين الجلسة تلقائياً، لن تحتاج للمسح مرة أخرى إلا إذا قمت بتسجيل الخروج.</li>
            <li>الـ Agents سيستخدمون هذا الحساب لإرسال التقارير وتنبيهات المبيعات.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
