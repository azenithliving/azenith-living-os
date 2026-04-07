import { type ReactNode } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

export default async function AdminGateLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Top Navigation - only show if authenticated */}
      {user && (
        <header className="border-b border-white/10 bg-[#0A0A0A]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0A0A0A]/60">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <div className="text-xl font-semibold text-brand-primary">
                AZENITH SOVEREIGN
              </div>
              <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs text-brand-primary">
                Master Admin
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-white">{user.email}</p>
                <p className="text-xs text-white/50">Authenticated</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={user ? "mx-auto max-w-7xl px-6 py-8" : ""}>
        {children}
      </main>
    </div>
  );
}
