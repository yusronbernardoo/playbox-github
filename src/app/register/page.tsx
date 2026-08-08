'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    businessName: '',
    username: '', // This will be the storeId
    phone: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const storeId = formData.username.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (storeId.length < 3) {
        throw new Error('ID Toko minimal 3 karakter huruf/angka');
      }

      // Check if store already exists
      const storeRef = doc(db, 'stores', storeId);
      const storeSnap = await getDoc(storeRef);
      if (storeSnap.exists()) {
        throw new Error('ID Toko sudah dipakai, silakan pilih yang lain');
      }

      // Create new store document with 7 days trial
      const now = new Date();
      const validUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const generatedSlug = formData.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || storeId;

      const shopData = {
        brandName: formData.businessName,
        slug: generatedSlug,
        phone: formData.phone,
        password: formData.password, // In a real app, hash this!
        status: 'trial',
        createdAt: now.toISOString(),
        validUntil: validUntil.toISOString()
      };

      await setDoc(storeRef, shopData);

      // Create slug mapping so /store/[slug] works immediately
      await setDoc(doc(db, 'store_slugs', generatedSlug), {
        storeId: storeId,
        slug: generatedSlug,
        brandName: formData.businessName,
        updatedAt: now.toISOString()
      }, { merge: true });

      // Automatically log them in
      const fullUsername = `${storeId}_bos`;
      localStorage.setItem('playbox_auth', JSON.stringify({ 
        username: fullUsername, 
        role: 'owner', 
        storeId: storeId 
      }));

      // Cache tenant settings
      localStorage.setItem(`playbox_shop_settings_${storeId}`, JSON.stringify(shopData));

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Gagal mendaftar, coba lagi');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-playbox-bg relative overflow-hidden p-4">
      <div className="ambient-glow"></div>
      
      <div className="glass-surface-elevated p-6 sm:p-8 rounded-3xl w-full max-w-sm relative z-10 shadow-2xl border border-white/10 overflow-hidden group">
        <div className="absolute -inset-0.5 bg-gradient-to-br from-playbox-gradient-start/30 to-playbox-gradient-end/30 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-xl -z-10"></div>
        
        <div className="text-center mb-6 relative z-10">
          <div className="mx-auto w-32 h-14 mb-4 relative flex items-center justify-center">
            <img 
              src="/renterva-logo.png" 
              alt="Renterva Play Logo" 
              className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(37,99,235,0.4)]"
            />
          </div>
          
          <h1 className="text-xl font-black mb-2 tracking-tight text-white relative">
            Mulai Rental Anda
          </h1>
          <p className="text-[11px] text-white/50 font-medium">
            Daftar sekarang. Gratis coba 7 hari.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium p-3 rounded-xl mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div className="group/input">
            <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1.5 ml-2 group-focus-within/input:text-playbox-accent transition-colors">Nama Toko</label>
            <input 
              type="text" 
              value={formData.businessName}
              onChange={(e) => setFormData({...formData, businessName: e.target.value})}
              className="w-full p-3.5 rounded-2xl bg-black/40 border border-white/5 text-white text-sm focus:outline-none focus:border-playbox-accent transition-all focus:shadow-[0_0_15px_rgba(37,99,235,0.15)]"
              placeholder="Contoh: Mabar PS"
              required
            />
          </div>

          <div className="group/input">
            <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1.5 ml-2 group-focus-within/input:text-playbox-accent transition-colors">ID Toko / Username</label>
            <input 
              type="text" 
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              className="w-full p-3.5 rounded-2xl bg-black/40 border border-white/5 text-white text-sm focus:outline-none focus:border-playbox-accent transition-all focus:shadow-[0_0_15px_rgba(37,99,235,0.15)] lowercase"
              placeholder="Contoh: mabarps"
              required
            />
            <p className="text-[9px] text-white/30 ml-2 mt-1">Username otomatis: <span className="text-white/60 font-bold">{formData.username.replace(/[^a-z0-9]/g, '') || 'mabarps'}_bos</span></p>
          </div>

          <div className="group/input">
            <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1.5 ml-2 group-focus-within/input:text-playbox-accent transition-colors">No. WhatsApp</label>
            <input 
              type="tel" 
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="w-full p-3.5 rounded-2xl bg-black/40 border border-white/5 text-white text-sm focus:outline-none focus:border-playbox-accent transition-all focus:shadow-[0_0_15px_rgba(37,99,235,0.15)]"
              placeholder="08xxxxxxxxxx"
              required
            />
          </div>

          <div className="group/input">
            <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1.5 ml-2 group-focus-within/input:text-playbox-accent transition-colors">Password</label>
            <input 
              type="password" 
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full p-3.5 rounded-2xl bg-black/40 border border-white/5 text-white text-sm focus:outline-none focus:border-playbox-accent transition-all focus:shadow-[0_0_15px_rgba(37,99,235,0.15)]"
              placeholder="••••••"
              minLength={4}
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3.5 bg-playbox-accent text-white rounded-2xl font-bold shadow-[0_8px_30px_rgba(37,99,235,0.4)] hover:shadow-[0_8px_30px_rgba(37,99,235,0.6)] active:scale-95 transition-all text-sm mt-6 disabled:opacity-50"
          >
            {loading ? 'MEMPROSES...' : 'DAFTAR SEKARANG'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-white/5 text-center relative z-10">
          <Link href="/login" className="text-[11px] text-white/50 font-medium hover:text-white transition-colors">
            Sudah punya akun? <span className="text-playbox-accent font-bold">Masuk</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
