'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function PengaturanTokoPage() {
  const router = useRouter();
  const [brandName, setBrandName] = useState('PlayBox Malang');
  const [slug, setSlug] = useState('playbox-malang');
  const [phone, setPhone] = useState('081234567890');
  const [address, setAddress] = useState('Jl. Soekarno Hatta No. 12, Malang');
  const [bio, setBio] = useState('Pusat Sewa PlayStation 5 & PS4 Premium, Unit Bersih & Game Update.');
  const [isSaved, setIsSaved] = useState(false);
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get current domain for the link generator
    if (typeof window !== 'undefined') {
      setDomain(window.location.origin);
    }
    
    const loadSettings = async () => {
      let loaded: any = null;

      // 1. Try fetching from Cloud Firestore
      try {
        const snap = await getDoc(doc(db, 'settings', 'shop'));
        if (snap.exists()) {
          loaded = snap.data();
        }
      } catch (err) {
        console.warn('Firestore shop settings fallback:', err);
      }

      // 2. Fallback to localStorage
      if (!loaded) {
        const local = localStorage.getItem('playbox_shop_settings');
        if (local) {
          loaded = JSON.parse(local);
        }
      }

      if (loaded) {
        setBrandName(loaded.brandName || 'PlayBox Malang');
        setSlug(loaded.slug || 'playbox-malang');
        setPhone(loaded.phone || '081234567890');
        setAddress(loaded.address || 'Jl. Soekarno Hatta No. 12, Malang');
        setBio(loaded.bio || 'Pusat Sewa PlayStation 5 & PS4 Premium, Unit Bersih & Game Update.');
      }
      setLoading(false);
    };

    loadSettings();
  }, []);

  const handleBrandNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setBrandName(name);
    // Auto-generate slug from brand name (lowercase, replace spaces with hyphen)
    setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
    setIsSaved(false);
  };

  const handleSave = async () => {
    const finalSlug = slug || 'toko-baru';
    const settingsData = {
      brandName: brandName || 'Nama Toko',
      slug: finalSlug,
      phone: phone || '',
      address: address || '',
      bio: bio || '',
      updatedAt: new Date().toISOString()
    };

    // 1. Save to Cloud Firestore
    try {
      await setDoc(doc(db, 'settings', 'shop'), settingsData);
    } catch (err) {
      console.error('Failed saving shop settings to Firestore:', err);
    }

    // 2. Save to localStorage
    localStorage.setItem('playbox_shop_settings', JSON.stringify(settingsData));
    setSlug(finalSlug);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleCopyLink = () => {
    const link = `${domain}/store/${slug}`;
    navigator.clipboard.writeText(link);
    alert('Link Etalase berhasil disalin!\n' + link);
  };

  return (
    <div className="p-4 space-y-6 pb-24 relative min-h-screen">
      <div className="ambient-glow"></div>
      
      {/* Header */}
      <div className="flex items-center mt-2 mb-6">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl mr-4 hover:bg-white/10 transition-colors">
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Profil & Link Toko</h1>
          <p className="text-xs text-playbox-text-secondary mt-0.5">Identitas Rental & Kontak Pelanggan</p>
        </div>
      </div>

      <div className="glass-surface p-6 rounded-3xl space-y-5">
        <div>
          <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Nama Brand / Toko</label>
          <input 
            type="text" 
            value={brandName}
            onChange={handleBrandNameChange}
            placeholder="Contoh: Budi Rental PlayStation"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-playbox-accent transition-colors"
          />
          <p className="text-[10px] text-white/40 mt-1.5">Akan tampil sebagai judul di etalase dan kop invoice.</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Nomor WhatsApp CS (Official)</label>
          <div className="relative">
            <input 
              type="tel" 
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setIsSaved(false); }}
              placeholder="Contoh: 081234567890"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 pl-11 text-white focus:outline-none focus:border-playbox-accent transition-colors"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base">📱</span>
          </div>
          <p className="text-[10px] text-white/40 mt-1.5">Nomor ini menjadi tujuan tombol "Hubungi CS" pelanggan & tertera di invoice.</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Alamat Lengkap Toko / Rental</label>
          <textarea 
            rows={2}
            value={address}
            onChange={(e) => { setAddress(e.target.value); setIsSaved(false); }}
            placeholder="Contoh: Jl. Soekarno Hatta No. 12, Malang (Patokan: Samping Alfamart)"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-playbox-accent transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Deskripsi / Bio Etalase</label>
          <input 
            type="text" 
            value={bio}
            onChange={(e) => { setBio(e.target.value); setIsSaved(false); }}
            placeholder="Contoh: Rental PS5 & PS4 Terlengkap di Malang"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-playbox-accent transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Slug URL Toko</label>
          <div className="flex items-center">
            <span className="bg-white/5 border border-white/10 border-r-0 rounded-l-xl px-3 py-3 text-white/40 text-sm">
              /store/
            </span>
            <input 
              type="text" 
              value={slug}
              onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setIsSaved(false); }}
              placeholder="nama-toko"
              className="flex-1 bg-black/40 border border-white/10 rounded-r-xl px-4 py-3 text-white focus:outline-none focus:border-playbox-accent transition-colors"
            />
          </div>
        </div>

        <button 
          onClick={handleSave}
          className={`w-full py-3.5 rounded-xl font-bold text-white transition-all shadow-lg active:scale-95 ${
            isSaved ? 'bg-green-500 shadow-green-500/30' : 'bg-playbox-accent hover:bg-opacity-90 shadow-playbox-accent/30'
          }`}
        >
          {isSaved ? '✓ Tersimpan ke Cloud!' : 'Simpan Profil Toko'}
        </button>
      </div>

      {/* Link Generator Result */}
      <div className="glass-surface p-1 rounded-3xl bg-gradient-to-br from-playbox-accent/20 to-transparent">
        <div className="bg-playbox-bg rounded-[22px] p-6">
          <h2 className="text-sm font-bold text-white mb-1 flex items-center">
            <span className="mr-2">🔗</span> Link Etalase Otomatis
          </h2>
          <p className="text-xs text-playbox-text-secondary mb-4 leading-relaxed">
            Link ini secara otomatis menampilkan katalog unit, no WA CS, dan alamat toko Anda. 
            Pasang link ini di <span className="font-bold text-white">Bio Instagram / TikTok</span> atau kirim ke pelanggan.
          </p>

          <div className="bg-black/50 border border-white/10 rounded-xl p-3 flex items-center justify-between group overflow-hidden">
            <p className="text-playbox-accent text-sm font-medium truncate max-w-[200px] sm:max-w-xs transition-colors group-hover:text-white">
              {domain}/store/{slug || 'nama-toko'}
            </p>
            <button onClick={handleCopyLink} className="bg-playbox-accent/20 hover:bg-playbox-accent text-playbox-accent hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all ml-2 flex-shrink-0">
              Copy
            </button>
          </div>

          <div className="mt-5 pt-5 border-t border-white/10 grid grid-cols-2 gap-3">
            <button onClick={() => window.open(`/store/${slug || 'nama-toko'}`, '_blank')} className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-medium text-white transition-colors flex items-center justify-center">
              <span>👁️ Buka Etalase</span>
            </button>
            <button 
              onClick={handleCopyLink} 
              className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-medium text-white transition-colors flex items-center justify-center"
            >
              <span>📋 Salin Link</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
