'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BusinessSettings() {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    name: 'PlayBox Malang',
    phone: '081234567890',
    email: 'hello@playboxmalang.com',
    address: 'Jl. Suhat No. 123, Malang'
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Pengaturan Bisnis berhasil disimpan!');
    router.back();
  };

  return (
    <div className="p-4 space-y-6 pb-28 relative">
      <div className="ambient-glow"></div>

      {/* Header */}
      <div className="flex items-center mt-2 mb-6 relative z-10">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl mr-4 hover:bg-white/10 transition-colors">
          ←
        </button>
        <h1 className="text-xl font-bold tracking-tight">Pengaturan Bisnis</h1>
      </div>

      <form onSubmit={handleSave} className="space-y-6 relative z-10">
        {/* Foto Profil / Logo */}
        <div className="glass-surface p-6 rounded-3xl flex flex-col items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-playbox-gradient-start to-playbox-gradient-end flex items-center justify-center text-white text-4xl font-bold mb-4 shadow-[0_0_20px_rgba(208,19,130,0.5)]">
            P
          </div>
          <button type="button" className="text-xs font-bold text-playbox-accent bg-playbox-accent/10 px-4 py-2 rounded-lg hover:bg-playbox-accent/20 transition-colors">
            Ubah Logo
          </button>
        </div>

        {/* Form Data */}
        <div className="glass-surface p-6 rounded-3xl space-y-5">
          <div>
            <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Nama Bisnis</label>
            <input 
              type="text" 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full p-4 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent transition-all"
              required 
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">No. WhatsApp</label>
            <input 
              type="text" 
              value={formData.phone} 
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="w-full p-4 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent transition-all"
              required 
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Email (Opsional)</label>
            <input 
              type="email" 
              value={formData.email} 
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full p-4 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Alamat Lengkap</label>
            <textarea 
              value={formData.address} 
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              rows={3}
              className="w-full p-4 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent transition-all resize-none"
              required 
            ></textarea>
          </div>
        </div>

        {/* Floating Action Button */}
        <div className="fixed bottom-[72px] w-full max-w-md left-1/2 -translate-x-1/2 p-4 bg-playbox-bg/80 backdrop-blur-xl border-t border-white/5 z-50">
          <div className="max-w-md mx-auto">
            <button 
              type="submit" 
              className="w-full py-4 saas-button rounded-2xl font-semibold shadow-[0_4px_20px_rgba(37,99,235,0.4)] text-sm tracking-wide"
            >
              Simpan Perubahan
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
