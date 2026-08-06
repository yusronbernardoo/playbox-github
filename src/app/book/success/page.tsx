'use client';
import Link from 'next/link';

export default function BookingSuccess() {
  const trackingId = "PBX-84920";

  return (
    <div className="flex flex-col min-h-screen bg-playbox-bg text-playbox-text-primary max-w-md mx-auto relative shadow-2xl p-6 justify-center items-center">
      
      <div className="w-24 h-24 bg-playbox-ready/10 rounded-full flex items-center justify-center border-4 border-playbox-ready mb-6 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
        <span className="text-5xl text-playbox-ready">✓</span>
      </div>
      
      <h1 className="text-2xl font-bold text-center mb-2">Booking Berhasil Dikirim!</h1>
      <p className="text-sm text-playbox-text-secondary text-center mb-8">
        Terima kasih! Kami sedang memverifikasi pembayaran Anda. Status booking akan segera diupdate.
      </p>

      <div className="bg-playbox-surface w-full p-6 rounded-2xl border border-[#2A3455] text-center mb-8">
        <p className="text-sm text-playbox-text-secondary mb-2">Kode Booking Anda</p>
        <p className="text-3xl font-bold text-playbox-accent tracking-widest">{trackingId}</p>
        <p className="text-xs text-playbox-text-secondary mt-3">Simpan kode ini untuk melacak status pesanan Anda.</p>
      </div>

      <div className="w-full space-y-4">
        <Link 
          href="/book/track" 
          className="block text-center w-full py-4 rounded-xl font-bold bg-playbox-accent text-white hover:bg-opacity-90 shadow-lg"
        >
          Lacak Status Sekarang
        </Link>
        <Link 
          href="/book" 
          className="block text-center w-full py-4 rounded-xl font-bold border border-[#2A3455] text-white hover:bg-[#2A3455] transition-colors"
        >
          Kembali ke Beranda
        </Link>
      </div>
      
    </div>
  );
}
