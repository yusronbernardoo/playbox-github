'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function Splash() {
  const router = useRouter();
  const [slide, setSlide] = useState(0);

  const slides = [
    { 
      title: "Sistem Operasional Rental PlayStation Profesional", 
      desc: "Kelola rental Anda dengan mudah dalam satu platform cerdas.",
      visual: (
        <div className="w-32 h-32 relative mb-8 flex items-center justify-center animate-bounce-slow">
          <Image src="/renterva-logo.png" alt="Renterva Logo" fill className="object-contain" priority />
        </div>
      )
    },
    { 
      title: "Booking Anti Bentrok", 
      desc: "Atur jadwal penyewaan secara akurat tanpa takut double booking.",
      visual: (
        <div className="w-28 h-28 rounded-3xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
          <svg className="w-14 h-14 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        </div>
      )
    },
    { 
      title: "Otomasi Denda & Invoice", 
      desc: "Sistem otomatis menghitung denda dan mencetak invoice digital.",
      visual: (
        <div className="w-28 h-28 rounded-3xl bg-green-500/20 border border-green-500/30 flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
          <svg className="w-14 h-14 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </div>
      )
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-playbox-bg text-playbox-text-primary relative overflow-hidden">
      
      {/* Tombol Lewati */}
      <button 
        onClick={() => router.push('/login')}
        className="absolute top-6 right-6 text-sm font-semibold text-white/50 hover:text-white transition-colors z-50"
      >
        Lewati
      </button>

      <div className="flex-1 flex flex-col items-center justify-center max-w-md text-center w-full">
        <div key={slide} className="w-full flex flex-col items-center animate-in fade-in slide-in-from-right-8 duration-500">
          {slides[slide].visual}
          
          <h1 className="text-2xl font-bold mb-4 px-2 tracking-tight leading-tight">{slides[slide].title}</h1>
          <p className="text-playbox-text-secondary text-sm px-4 mb-8 leading-relaxed">{slides[slide].desc}</p>
        </div>
        
        {/* Dot indicators */}
        <div className="flex space-x-2 mb-8 mt-auto">
          {slides.map((_, i) => (
            <div 
              key={i} 
              className={`h-2 rounded-full transition-all duration-300 ${i === slide ? 'w-6 bg-playbox-accent' : 'w-2 bg-playbox-surface'}`} 
            />
          ))}
        </div>
      </div>

      <div className="w-full max-w-md pb-8 z-10">
        <button 
          onClick={() => {
            if (slide < slides.length - 1) setSlide(s => s + 1);
            else router.push('/login');
          }}
          className="w-full py-4 rounded-2xl font-bold saas-button shadow-[0_4px_20px_rgba(37,99,235,0.4)] text-sm tracking-wide"
        >
          {slide < slides.length - 1 ? 'Selanjutnya' : 'Mulai Sekarang'}
        </button>
      </div>
    </div>
  );
}
