"use client";

import { useEffect, useState } from "react";


type Booking = {
  id: string;
  roomType: string;
  budget: string;
  style: string;
  serviceType: string;
  status: string;
  createdAt: string;
  fullName?: string;
  phone?: string;
  email?: string;
  preferredDate?: string;
  preferredTime?: string;
  notes?: string;
};

type Slot = {
  day: string;
  startTime: string;
  endTime: string;
  enabled: boolean;
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [slots, setSlots] = useState<Slot[]>([]);
  const [showSlots, setShowSlots] = useState(false);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [newBookingForm, setNewBookingForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    preferredDate: "",
    preferredTime: "",
    roomType: "",
    budget: "",
    style: "",
    serviceType: "",
    notes: "",
  });

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/bookings");
      const data = await response.json();
      if (response.ok && data.bookings) {
        setBookings(data.bookings);
      }
    } catch (error) {
      console.error("Failed to load bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  const createNewBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: `admin-${Date.now()}`, // Generate a session ID for admin-created bookings
          ...newBookingForm,
        }),
      });

      if (response.ok) {
        setShowNewBooking(false);
        setNewBookingForm({
          fullName: "",
          phone: "",
          email: "",
          preferredDate: "",
          preferredTime: "",
          roomType: "",
          budget: "",
          style: "",
          serviceType: "",
          notes: "",
        });
        await loadBookings(); // Reload bookings
      }
    } catch (error) {
      console.error("Failed to create booking:", error);
    }
  };

  const updateBookingStatus = async (bookingId: string, status: string) => {
    setUpdating(bookingId);
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        // Reload bookings to get updated status
        await loadBookings();
      }
    } catch (error) {
      console.error("Failed to update booking:", error);
    } finally {
      setUpdating(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted":
        return "bg-green-500/20 text-green-400";
      case "rejected":
        return "bg-red-500/20 text-red-400";
      default:
        return "bg-yellow-500/20 text-yellow-400";
    }
  };

  const getDayId = (day: string) => {
    const days = {
      "السبت": "sat",
      "الأحد": "sun",
      "الاثنين": "mon",
      "الثلاثاء": "tue",
      "الأربعاء": "wed",
      "الخميس": "thu",
      "الجمعة": "fri"
    };
    return days[day as keyof typeof days] || "unknown";
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "accepted":
        return "مقبول";
      case "rejected":
        return "مرفوض";
      default:
        return "قيد المراجعة";
    }
  };


  if (loading) {
    return (
      <main className="px-8 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
            <div className="text-center text-white/60">جاري تحميل الحجوزات...</div>
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
            <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">Bookings management</p>
            <h1 className="mt-3 font-serif text-4xl text-white md:text-5xl">إدارة الحجوزات</h1>
          </div>
          <div className="flex gap-3">
            <button className="rounded-full border border-white/10 px-6 py-3 text-sm text-white/70 transition hover:border-brand-primary hover:text-brand-primary">
              تصدير البيانات
            </button>
            <button
              onClick={() => setShowNewBooking(true)}
              className="rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d]"
            >
              حجز جديد
            </button>
          </div>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <h2 className="text-2xl font-semibold text-white">الحجوزات الحالية</h2>
          <p className="mt-2 text-sm text-white/60">عرض وإدارة جميع الحجوزات الواردة.</p>
          <div className="mt-6 space-y-4">
            {bookings.length === 0 ? (
              <div className="text-center text-white/60 py-8">
                لا توجد حجوزات حالياً
              </div>
            ) : (
              bookings.map((booking) => (
                <div key={booking.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">
                        حجز {booking.serviceType} - {booking.roomType}
                      </h3>
                      <p className="mt-1 text-sm text-white/60">
                        {booking.fullName ? `العميل: ${booking.fullName}` : "عميل مجهول"}
                        {booking.email && ` - ${booking.email}`}
                      </p>
                      {booking.phone && (
                        <p className="mt-1 text-sm text-white/60">الهاتف: {booking.phone}</p>
                      )}
                      {booking.preferredDate && booking.preferredTime && (
                        <p className="mt-1 text-sm text-white/60">
                          التاريخ المفضل: {booking.preferredDate} - {booking.preferredTime}
                        </p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs ${getStatusColor(booking.status)}`}>
                          {getStatusText(booking.status)}
                        </span>
                        <span className="text-sm text-white/60">
                          {new Date(booking.createdAt).toLocaleDateString("ar-SA")}
                        </span>
                      </div>
                      {booking.notes && (
                        <p className="mt-2 text-sm text-white/70">ملاحظات: {booking.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button className="rounded border border-white/20 px-4 py-2 text-sm text-white/70 hover:border-brand-primary hover:text-brand-primary">
                        عرض التفاصيل
                      </button>
                      {booking.status === "new" && (
                        <>
                          <button
                            onClick={() => updateBookingStatus(booking.id, "accepted")}
                            disabled={updating === booking.id}
                            className="rounded border border-green-500/20 px-4 py-2 text-sm text-green-400 hover:border-green-500 disabled:opacity-50"
                          >
                            {updating === booking.id ? "جاري التحديث..." : "قبول"}
                          </button>
                          <button
                            onClick={() => updateBookingStatus(booking.id, "rejected")}
                            disabled={updating === booking.id}
                            className="rounded border border-red-500/20 px-4 py-2 text-sm text-red-400 hover:border-red-500 disabled:opacity-50"
                          >
                            {updating === booking.id ? "جاري التحديث..." : "رفض"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Slot Management Section */}
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">إدارة المواعيد المتاحة</h2>
              <p className="mt-2 text-sm text-white/60">تحديد أوقات العمل والمواعيد المتاحة للحجوزات.</p>
            </div>
            <button
              onClick={() => setShowSlots(!showSlots)}
              className="rounded-full border border-white/10 px-6 py-3 text-sm text-white/70 transition hover:border-brand-primary hover:text-brand-primary"
            >
              {showSlots ? "إخفاء" : "إدارة المواعيد"}
            </button>
          </div>

          {showSlots && (
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"].map((day) => {
                  const dayId = getDayId(day);
                  return (
                    <div key={day} className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                      <h3 className="font-semibold text-white mb-3">{day}</h3>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <label htmlFor={`slot-${dayId}-start`} className="flex-1">
                            <span className="sr-only">من {day}</span>
                            <input
                              id={`slot-${dayId}-start`}
                              type="time"
                              className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-sm text-white"
                              placeholder="من"
                            />
                          </label>
                          <label htmlFor={`slot-${dayId}-end`} className="flex-1">
                            <span className="sr-only">إلى {day}</span>
                            <input
                              id={`slot-${dayId}-end`}
                              type="time"
                              className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-sm text-white"
                              placeholder="إلى"
                            />
                          </label>
                        </div>
                        <label htmlFor={`slot-${dayId}-enabled`} className="flex items-center gap-2 cursor-pointer">
                          <input id={`slot-${dayId}-enabled`} type="checkbox" className="rounded" />
                          <span className="text-sm text-white/70">متاح</span>
                        </label>
                      </div>
                    </div>
                  );
                })}

              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button className="rounded border border-white/20 px-6 py-2 text-sm text-white/70 hover:border-brand-primary hover:text-brand-primary">
                  إلغاء
                </button>
                <button className="rounded bg-brand-primary px-6 py-2 text-sm font-semibold text-brand-accent hover:bg-[#d8b56d]">
                  حفظ المواعيد
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Booking Modal */}
      {showNewBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-gray-900 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-white">إنشاء حجز جديد</h2>
              <button
                onClick={() => setShowNewBooking(false)}
                className="text-white/70 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={createNewBooking} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                <label htmlFor="newbooking-fullname" className="block text-sm font-medium text-white/70 mb-2">
                  الاسم الكامل
                </label>
                <input
                  id="newbooking-fullname"
                  type="text"
                  value={newBookingForm.fullName}
                  onChange={(e) => setNewBookingForm(prev => ({ ...prev, fullName: e.target.value }))}
                  className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
                  required
                />

                </div>
                <div>
                <label htmlFor="newbooking-phone" className="block text-sm font-medium text-white/70 mb-2">
                  رقم الهاتف
                </label>
                <input
                  id="newbooking-phone"
                  type="tel"
                  value={newBookingForm.phone}
                  onChange={(e) => setNewBookingForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
                  required
                />

                </div>
              </div>

              <div>
                <label htmlFor="newbooking-email" className="block text-sm font-medium text-white/70 mb-2">
                  البريد الإلكتروني
                </label>
                <input
                  id="newbooking-email"
                  type="email"
                  value={newBookingForm.email}
                  onChange={(e) => setNewBookingForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
                />

              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                <label htmlFor="newbooking-prefdate" className="block text-sm font-medium text-white/70 mb-2">
                  التاريخ المفضل
                </label>
                <input
                  id="newbooking-prefdate"
                  type="date"
                  value={newBookingForm.preferredDate}
                  onChange={(e) => setNewBookingForm(prev => ({ ...prev, preferredDate: e.target.value }))}
                  className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
                />

                </div>
                <div>
                <label htmlFor="newbooking-preftime" className="block text-sm font-medium text-white/70 mb-2">
                  الوقت المفضل
                </label>
                <input
                  id="newbooking-preftime"
                  type="time"
                  value={newBookingForm.preferredTime}
                  onChange={(e) => setNewBookingForm(prev => ({ ...prev, preferredTime: e.target.value }))}
                  className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
                />

                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                <label htmlFor="newbooking-roomtype" className="block text-sm font-medium text-white/70 mb-2">
                  نوع الغرفة
                </label>
                <select
                  id="newbooking-roomtype"
                  value={newBookingForm.roomType}
                  onChange={(e) => setNewBookingForm(prev => ({ ...prev, roomType: e.target.value }))}
                  className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
                  required
                >
                  <option value="">اختر نوع الغرفة</option>
                  <option value="living">غرفة معيشة</option>
                  <option value="bedroom">غرفة نوم</option>
                  <option value="kitchen">مطبخ</option>
                  <option value="bathroom">حمام</option>
                  <option value="office">مكتب</option>
                </select>

                </div>
                <div>
                <label htmlFor="newbooking-budget" className="block text-sm font-medium text-white/70 mb-2">
                  الميزانية
                </label>
                <select
                  id="newbooking-budget"
                  value={newBookingForm.budget}
                  onChange={(e) => setNewBookingForm(prev => ({ ...prev, budget: e.target.value }))}
                  className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
                  required
                >
                  <option value="">اختر الميزانية</option>
                  <option value="under-50k">أقل من 50,000 ريال</option>
                  <option value="50k-100k">50,000 - 100,000 ريال</option>
                  <option value="100k-200k">100,000 - 200,000 ريال</option>
                  <option value="over-200k">أكثر من 200,000 ريال</option>
                </select>

                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                <label htmlFor="newbooking-style" className="block text-sm font-medium text-white/70 mb-2">
                  الأسلوب المفضل
                </label>
                <select
                  id="newbooking-style"
                  value={newBookingForm.style}
                  onChange={(e) => setNewBookingForm(prev => ({ ...prev, style: e.target.value }))}
                  className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
                  required
                >
                  <option value="">اختر الأسلوب</option>
                  <option value="modern">حديث</option>
                  <option value="classic">كلاسيكي</option>
                  <option value="minimalist">مينيماليست</option>
                  <option value="traditional">تقليدي</option>
                </select>

                </div>
                <div>
                <label htmlFor="newbooking-servicetype" className="block text-sm font-medium text-white/70 mb-2">
                  نوع الخدمة
                </label>
                <select
                  id="newbooking-servicetype"
                  value={newBookingForm.serviceType}
                  onChange={(e) => setNewBookingForm(prev => ({ ...prev, serviceType: e.target.value }))}
                  className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
                  required
                >
                  <option value="">اختر نوع الخدمة</option>
                  <option value="design">تصميم فقط</option>
                  <option value="design-implementation">تصميم وتنفيذ</option>
                  <option value="consultation">استشارة</option>
                </select>

                </div>
              </div>

              <div>
                <label htmlFor="newbooking-notes" className="block text-sm font-medium text-white/70 mb-2">
                  ملاحظات إضافية
                </label>
                <textarea
                  id="newbooking-notes"
                  value={newBookingForm.notes}
                  onChange={(e) => setNewBookingForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
                  rows={3}
                />

              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewBooking(false)}
                  className="rounded border border-white/20 px-6 py-2 text-sm text-white/70 hover:border-white/50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded bg-brand-primary px-6 py-2 text-sm font-semibold text-brand-accent hover:bg-[#d8b56d]"
                >
                  إنشاء الحجز
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
