'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    businessName: '',
    ownerName: '',
    phone: '',
    password: '',
    licenseKey: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Validate license key, create account, bind device
    console.log("Registering:", formData);
    router.push('/dashboard');
  };

  return (
    <div className="flex flex-col min-h-screen p-4 bg-playbox-bg text-playbox-text-primary justify-center items-center py-10">
      <div className="w-full max-w-md p-8 bg-playbox-surface rounded-2xl shadow-xl">
        <h2 className="text-2xl font-bold text-center mb-2">Daftar Akun Baru</h2>
        <p className="text-playbox-text-secondary text-center text-sm mb-8">Masukkan detail bisnis dan License Key Anda</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-playbox-text-secondary mb-1">Nama Bisnis</label>
            <input 
              type="text" 
              value={formData.businessName}
              onChange={(e) => setFormData({...formData, businessName: e.target.value})}
              placeholder="Contoh: PlayBox Malang"
              className="w-full p-3 rounded-lg bg-[#1A2240] border border-[#2A3455] text-white focus:outline-none focus:border-playbox-accent"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-playbox-text-secondary mb-1">Nama Owner</label>
            <input 
              type="text" 
              value={formData.ownerName}
              onChange={(e) => setFormData({...formData, ownerName: e.target.value})}
              placeholder="Nama lengkap Anda"
              className="w-full p-3 rounded-lg bg-[#1A2240] border border-[#2A3455] text-white focus:outline-none focus:border-playbox-accent"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-playbox-text-secondary mb-1">Nomor WhatsApp</label>
            <input 
              type="tel" 
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              placeholder="08xxxxxxxxxx"
              className="w-full p-3 rounded-lg bg-[#1A2240] border border-[#2A3455] text-white focus:outline-none focus:border-playbox-accent"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-playbox-text-secondary mb-1">Password</label>
            <input 
              type="password" 
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              placeholder="Min. 8 karakter"
              minLength={8}
              className="w-full p-3 rounded-lg bg-[#1A2240] border border-[#2A3455] text-white focus:outline-none focus:border-playbox-accent"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-playbox-text-secondary mb-1 font-semibold text-playbox-accent">License Key</label>
            <input 
              type="text" 
              value={formData.licenseKey}
              onChange={(e) => setFormData({...formData, licenseKey: e.target.value})}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="w-full p-3 rounded-lg bg-[#1A2240] border border-playbox-accent text-white focus:outline-none focus:ring-1 focus:ring-playbox-accent uppercase tracking-wider"
              required
            />
            <p className="text-xs text-playbox-text-secondary mt-1">Lisensi ini akan terikat secara permanen pada perangkat ini.</p>
          </div>

          <button 
            type="submit"
            className="w-full py-4 mt-6 rounded-xl font-bold bg-playbox-accent text-white hover:bg-opacity-90 transition-all"
          >
            Aktivasi & Daftar
          </button>
        </form>

        <p className="text-center text-sm text-playbox-text-secondary mt-8">
          Sudah punya akun? <Link href="/login" className="text-playbox-accent font-bold hover:underline">Masuk</Link>
        </p>
      </div>
    </div>
  );
}
