'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/context/FirebaseContext';

export default function NotificationToast() {
  const router = useRouter();
  const { newBookingToast, clearToast } = useFirebase();

  if (!newBookingToast) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-[100] animate-in slide-in-from-top-4 fade-in duration-300">
      <div 
        className="bg-[#0E1221]/90 backdrop-blur-xl border border-playbox-accent/40 rounded-2xl p-4 shadow-[0_10px_40px_rgba(226,23,142,0.4)] flex items-start space-x-3 cursor-pointer hover:bg-[#0E1221]" 
        onClick={() => {
          router.push(`/dashboard/booking`);
          clearToast();
        }}
      >
        <div className="w-10 h-10 rounded-full bg-playbox-accent/20 flex items-center justify-center text-xl shrink-0 border border-playbox-accent/30 animate-pulse">
          🔔
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-white text-sm">Pesanan Baru Masuk!</h3>
          <p className="text-xs text-white/70 mt-1">
            <span className="font-semibold text-playbox-accent">{newBookingToast.customer}</span> mem-booking {newBookingToast.unit}
          </p>
          <p className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">{newBookingToast.code}</p>
        </div>
        <button 
          className="text-white/50 hover:text-white p-1"
          onClick={(e) => {
            e.stopPropagation();
            clearToast();
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
