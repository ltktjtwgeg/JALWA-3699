import React from 'react';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#1a1d21] text-white font-sans max-w-[430px] mx-auto relative shadow-2xl overflow-x-hidden">
      {children}
    </div>
  );
}
