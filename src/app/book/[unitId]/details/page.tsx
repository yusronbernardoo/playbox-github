'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CustomerDetails() {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    requireDelivery: false,
    address: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate booking creation
    router.push('/book/success');
  };

  return (
    <div className="flex flex-col min-h-screen bg-playbox-bg text-playbox-text-primary max-w-md mx-auto relative shadow-2xl p-4">
      {/* Header */}
      <div className="flex items-center mt-2 mb-6">
        <button onClick={() => router.back()} className="text-xl mr-4">←</button>
        <div>
          <h1 className="text-lg font-bold">Data Diri & Pembayaran</h1>
          <p className="text-xs text-playbox-text-secondary">Tahap 2 dari 2</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-6">
        
        {/* Ringkasan Pesanan */}
        <div className="bg-gradient-to-br from-playbox-accent/10 to-playbox-surface p-5 rounded-2xl border border-playbox-accent/20">
          <h2 className="text-xs font-bold text-playbox-accent mb-3 uppercase tracking-widest">Ringkasan Pesanan</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-white/60">Unit</span>
              <span className="font-bold text-white">PS5 Premium Set</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/60">Tanggal Booking</span>
              <span className="font-bold text-white">17 Agustus 2026</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/60">Jam Mulai</span>
              <span className="font-bold text-white">10:00 WIB</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/60">Durasi</span>
              <span className="font-bold text-white">24 Jam</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-playbox-accent/20 flex justify-between items-center">
            <span className="text-sm text-white/60 font-medium">Total Harga Sewa</span>
            <span className="text-lg font-black text-playbox-accent">Rp 150.000</span>
          </div>
        </div>

        {/* Data Diri */}
        <div className="bg-playbox-surface p-5 rounded-2xl border border-white/5 space-y-4">
          <h2 className="text-xs font-bold text-playbox-text-secondary uppercase tracking-widest">Informasi Penyewa</h2>
          <div>
            <label className="block text-xs font-medium text-playbox-text-secondary mb-1.5">Nama Lengkap</label>
            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3.5 rounded-xl bg-black/20 border border-white/10 text-white focus:border-playbox-accent transition-colors" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-playbox-text-secondary mb-1.5">Nomor WhatsApp Aktif</label>
            <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-3.5 rounded-xl bg-black/20 border border-white/10 text-white focus:border-playbox-accent transition-colors" required placeholder="08xxxxxxxxxx" />
          </div>
          <div>
            <label className="block text-xs font-medium text-playbox-text-secondary mb-1.5">Foto KTP (Opsional)</label>
            <input type="file" accept="image/*" className="w-full text-sm text-playbox-text-secondary file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-white/10 file:text-white hover:file:bg-white/20 transition-colors" />
          </div>
        </div>

        {/* Pengiriman */}
        <div className="bg-playbox-surface p-5 rounded-2xl border border-white/5 space-y-4">
          <label className="flex items-center space-x-3 cursor-pointer group">
            <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${formData.requireDelivery ? 'bg-playbox-accent' : 'bg-white/10 group-hover:bg-white/20'}`}>
              {formData.requireDelivery && <span className="text-white text-xs">✓</span>}
            </div>
            <input type="checkbox" checked={formData.requireDelivery} onChange={e => setFormData({...formData, requireDelivery: e.target.checked})} className="hidden" />
            <span className="font-medium text-white/90">Kirim ke Lokasi Saya (Delivery)</span>
          </label>
          {formData.requireDelivery && (
            <div className="pt-2 animate-in fade-in slide-in-from-top-2">
              <label className="block text-xs font-medium text-playbox-text-secondary mb-1.5">Alamat Lengkap (Google Maps)</label>
              <textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} rows={3} className="w-full p-3.5 rounded-xl bg-black/20 border border-white/10 text-white focus:border-playbox-accent transition-colors" placeholder="Alamat lengkap rumah / kos..." required />
            </div>
          )}
        </div>

        {/* Pembayaran DP */}
        <div className="bg-playbox-surface p-5 rounded-2xl border border-white/5 space-y-4">
          <h2 className="text-xs font-bold text-playbox-text-secondary uppercase tracking-widest mb-2">Pembayaran Uang Muka (DP)</h2>
          
          <div className="bg-black/20 p-4 rounded-xl border border-white/5 flex justify-between items-center">
            <span className="text-sm text-white/70">Wajib Transfer DP:</span>
            <span className="font-black text-playbox-ready text-lg">Rp 50.000</span>
          </div>

          <div className="space-y-3 pt-2">
            <p className="text-xs font-medium text-playbox-text-secondary">Transfer ke salah satu rekening berikut:</p>
            
            <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex justify-between items-center group">
              <div>
                <p className="text-xs text-white/50 mb-0.5">BCA</p>
                <p className="font-bold text-sm tracking-wider">1234 5678 90</p>
                <p className="text-[10px] text-white/40 mt-0.5">a.n. PlayBox Malang</p>
              </div>
              <button type="button" className="text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors">Salin</button>
            </div>

            <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex justify-between items-center group">
              <div>
                <p className="text-xs text-white/50 mb-0.5">Gopay / OVO / Dana</p>
                <p className="font-bold text-sm tracking-wider">0812 3456 7890</p>
                <p className="text-[10px] text-white/40 mt-0.5">a.n. Yusron</p>
              </div>
              <button type="button" className="text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors">Salin</button>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5">
            <label className="block text-xs font-medium text-playbox-text-secondary mb-2">Upload Bukti Transfer DP</label>
            <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:bg-white/5 hover:border-playbox-accent/50 transition-colors cursor-pointer">
              <span className="text-2xl mb-2 block">🧾</span>
              <span className="text-xs font-medium text-playbox-text-secondary block">Klik untuk upload foto bukti transfer</span>
              <input type="file" accept="image/*" required className="opacity-0 absolute inset-0 cursor-pointer w-full" />
            </div>
          </div>
        </div>

        <div className="mt-auto pt-6 pb-8">
          <button 
            type="submit" 
            className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-playbox-gradient-start to-playbox-accent text-white hover:scale-[1.02] transition-all shadow-[0_4px_15px_rgba(226,23,142,0.4)]"
          >
            Selesaikan Booking
          </button>
        </div>
      </form>
    </div>
  );
}
