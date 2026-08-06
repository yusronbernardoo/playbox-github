'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Splash() {
  const router = useRouter();
  const [slide, setSlide] = useState(0);

  const slides = [
    { title: "Sistem Operasional Rental PlayStation Profesional", desc: "Kelola rental Anda dengan mudah." },
    { title: "Booking Anti Bentrok", desc: "Atur jadwal penyewaan secara akurat tanpa takut double booking." },
    { title: "Otomasi Denda & Invoice", desc: "Sistem otomatis menghitung denda dan mencetak invoice." }
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-playbox-bg text-playbox-text-primary">
      <div className="flex-1 flex flex-col items-center justify-center max-w-md text-center">
        {/* Mock Logo */}
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-playbox-gradient-start to-playbox-gradient-end flex items-center justify-center mb-8 shadow-lg">
          <span className="text-4xl font-bold text-white">P</span>
        </div>
        
        <h1 className="text-2xl font-bold mb-4">{slides[slide].title}</h1>
        <p className="text-playbox-text-secondary mb-8">{slides[slide].desc}</p>
        
        {/* Dot indicators */}
        <div className="flex space-x-2 mb-8">
          {slides.map((_, i) => (
            <div 
              key={i} 
              className={`w-2 h-2 rounded-full ${i === slide ? 'bg-playbox-accent' : 'bg-playbox-surface'}`} 
            />
          ))}
        </div>
      </div>

      <div className="w-full max-w-md pb-8">
        <button 
          onClick={() => {
            if (slide < slides.length - 1) setSlide(s => s + 1);
            else router.push('/login');
          }}
          className="w-full py-4 rounded-xl font-bold bg-playbox-accent text-white hover:bg-opacity-90 transition-all"
        >
          {slide < slides.length - 1 ? 'Selanjutnya' : 'Mulai Sekarang'}
        </button>
      </div>
    </div>
  );
}
