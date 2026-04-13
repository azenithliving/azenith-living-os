"use client";

import { useEffect, useState } from "react";

import { Calendar, Clock, User } from "lucide-react";

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

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await fetch("/api/bookings");
      const data = await response.json();

      if (data.ok) {
        setBookings(data.bookings || []);
      } else {
        setError(data.message || "Failed to fetch bookings");
      }
    } catch {
      setError("Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "text-green-400 bg-green-500/20";
      case "pending":
        return "text-yellow-400 bg-yellow-500/20";
      case "cancelled":
        return "text-red-400 bg-red-500/20";
      default:
        return "text-gray-400 bg-gray-500/20";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "confirmed":
        return "مؤكد";
      case "pending":
        return "قيد المراجعة";
      case "cancelled":
        return "ملغي";
      default:
        return "جديد";
    }
  };

  if (loading) {
    return (
      <main className="px-6 py-12 md:px-10 lg:px-16">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
            <div className="flex items-center justify-center">
              <div className="text-white">جاري تحميل الحجوزات...</div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="px-6 py-12 md:px-10 lg:px-16">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
            <div className="text-red-400">خطأ: {error}</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="px-6 py-12 md:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">Booking system</p>
            <h1 className="mt-3 font-serif text-4xl text-white md:text-5xl">نظام الحجوزات</h1>
          </div>
          <button className="rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d]">
            جدولة استشارة جديدة
          </button>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <h2 className="text-2xl font-semibold text-white">الحجوزات الحالية</h2>
          <p className="mt-2 text-sm text-white/60">إدارة وتتبع جميع طلبات الاستشارات.</p>

          {bookings.length === 0 ? (
            <div className="mt-6 text-center text-white/60">
              لا توجد حجوزات حتى الآن.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {bookings.map((booking) => (
                <div key={booking.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-brand-primary" />
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {booking.fullName || "عميل جديد"}
                          </h3>
                          <p className="text-sm text-white/60">
                            {booking.roomType} - {booking.serviceType}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-white/60">
                        {booking.phone && (
                          <span>📱 {booking.phone}</span>
                        )}
                        {booking.email && (
                          <span>✉️ {booking.email}</span>
                        )}
                      </div>

                      {(booking.preferredDate || booking.preferredTime) && (
                        <div className="flex items-center gap-4 text-sm text-white/60">
                          {booking.preferredDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{booking.preferredDate}</span>
                            </div>
                          )}
                          {booking.preferredTime && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{booking.preferredTime}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(booking.status)}`}>
                          {getStatusText(booking.status)}
                        </span>
                        <span className="text-sm text-white/60">
                          {new Date(booking.createdAt).toLocaleDateString('ar-SA')}
                        </span>
                      </div>

                      {booking.notes && (
                        <p className="text-sm text-white/70 bg-white/5 rounded p-3">
                          {booking.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button className="rounded border border-white/20 px-4 py-2 text-sm text-white/70 hover:border-brand-primary hover:text-brand-primary">
                        عرض التفاصيل
                      </button>
                      <button className="rounded border border-green-500/20 px-4 py-2 text-sm text-green-400 hover:border-green-500">
                        تأكيد
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
