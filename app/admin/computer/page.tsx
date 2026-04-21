"use client";

import React from 'react';
import SovereignOS from '@/components/sandbox/SovereignOS';
import SovereignPhone from '@/components/sandbox/SovereignPhone';

export default function ComputerPage() {
  return (
    <div className="flex items-center justify-center min-h-screen w-full overflow-hidden">
      {/* MONITOR VERSION - Visible on md and up */}
      <div className="hidden md:flex w-full h-full items-center justify-center p-4">
        <SovereignOS />
      </div>

      {/* PHONE VERSION - Visible on small screens */}
      <div className="flex md:hidden w-full h-screen items-center justify-center overflow-hidden">
        <SovereignPhone />
      </div>
    </div>
  );
}
