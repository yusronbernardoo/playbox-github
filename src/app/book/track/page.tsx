'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function TrackBooking() {
  const [trackCode, setTrackCode] = useState('');
  const [isSearched, setIsSearched] = useState(false);

  // Mock Result
  const status = 'Menunggu Verifikasi Pembayaran';
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackCode.trim()) setIsSearched(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-playbox-bg text-playbox-text-primary max-w-md mx-auto relative shadow-2xl p-4">
      {/* Header */}
      <div className="flex items-center mt-2 mb-8">
        <Link href="/book" className="text-xl mr-4">←</Link>
        <h1 className="text-lg font-bold">Lacak Booking</h1>
      </div>

      <form onSubmit={handleSearch} className="space-y-4 mb-8">
        <div>
          <label className="block text-sm text-playbox-text-secondary mb-1">Kode Booking</label>
          <input 
            type="text" 
            value={trackCode}
            onChange={e => setTrackCode(e.target.value.toUpperCase())}
            placeholder="Masukkan Kode (mis: PBX-84920)" 
            className="w-full p-4 rounded-xl bg-playbox-surface border border-[#2A3455] text-white focus:outline-none focus:border-playbox-accent font-bold tracking-widest text-center" 
            required 
          />
        </div>
        <button 
          type="submit" 
          className="w-full py-4 rounded-xl font-bold bg-playbox-accent text-white hover:bg-opacity-90 shadow-lg"
        >
          Cek Status
        </button>
      </form>

      {isSearched && (
        <div className="bg-playbox-surface p-6 rounded-2xl border border-[#2A3455] animate-fade-in">
          <div className="text-center mb-6">
            <p className="text-xs text-playbox-text-secondary mb-1">Status saat ini untuk <span className="font-bold text-white">{trackCode}</span></p>
            <h2 className="text-xl font-bold text-yellow-400">{status}</h2>
          </div>

          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#2A3455] before:to-transparent">
            {/* Timeline Item 1 */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border border-playbox-accent bg-playbox-surface text-playbox-accent shadow shrink-0 z-10">
                <span className="text-sm">⏳</span>
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-playbox-accent bg-[#1A2240]">
                <div className="font-bold text-playbox-accent">Verifikasi Pembayaran</div>
                <div className="text-xs text-playbox-text-secondary mt-1">Tim kami sedang mengecek bukti transfer Anda.</div>
              </div>
            </div>
            
            {/* Timeline Item 2 (Future) */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border border-[#2A3455] bg-playbox-surface text-gray-500 shadow shrink-0 z-10">
                <span className="text-sm">📦</span>
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-[#2A3455] bg-playbox-surface opacity-50">
                <div className="font-bold text-gray-400">Siap & Dipacking</div>
                <div className="text-xs text-gray-500 mt-1">Menunggu waktu sewa tiba.</div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-[#2A3455] text-center">
            <p className="text-sm text-playbox-text-secondary mb-3">Butuh bantuan?</p>
            <a href="https://wa.me/628123456789" target="_blank" rel="noreferrer" className="inline-block px-6 py-2 rounded-lg font-bold bg-[#10C347] text-white hover:bg-opacity-90">
              Hubungi Admin WA
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
