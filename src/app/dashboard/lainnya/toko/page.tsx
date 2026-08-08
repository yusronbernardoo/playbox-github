'use client';
import { getStoreId, getTenantStorageKey } from '@/lib/tenant';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { QRCodeCanvas } from 'qrcode.react';

export default function PengaturanTokoPage() {
  const router = useRouter();
  const [brandName, setBrandName] = useState('PlayBox Malang');
  const [slug, setSlug] = useState('playbox-malang');
  const [phone, setPhone] = useState('081234567890');
  const [instagram, setInstagram] = useState('playbox.rental');
  const [address, setAddress] = useState('Jl. Soekarno Hatta No. 12, Malang');
  const [bio, setBio] = useState('Pusat Sewa PlayStation 5 & PS4 Premium, Unit Bersih & Game Update.');
  const [logo, setLogo] = useState<string>('');
  const [isSaved, setIsSaved] = useState(false);
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(true);

  const qrCanvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDomain(window.location.origin);
    }
    
    const loadSettings = async () => {
      let loaded: any = null;

      // 1. Try fetching from Cloud Firestore
      try {
        const snap = await getDoc(doc(db, 'stores', getStoreId()));
        if (snap.exists()) {
          loaded = snap.data();
        }
      } catch (err) {
        console.warn('Firestore shop settings fallback:', err);
      }

      // 2. Fallback to localStorage
      if (!loaded) {
        const local = localStorage.getItem(getTenantStorageKey('playbox_shop_settings'));
        if (local) {
          loaded = JSON.parse(local);
        }
      }

      if (loaded) {
        setBrandName(loaded.brandName || 'PlayBox Malang');
        setSlug(loaded.slug || 'playbox-malang');
        setPhone(loaded.phone || '081234567890');
        setInstagram(loaded.instagram || '');
        setAddress(loaded.address || 'Jl. Soekarno Hatta No. 12, Malang');
        setBio(loaded.bio || 'Pusat Sewa PlayStation 5 & PS4 Premium, Unit Bersih & Game Update.');
        setLogo(loaded.logo || '');
      }
      setLoading(false);
    };

    loadSettings();
  }, []);

  const handleBrandNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setBrandName(name);
    setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
    setIsSaved(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          const MAX_SIZE = 400;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
          setLogo(compressedBase64);
          setIsSaved(false);
        };
        img.src = uploadEvent.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogo('');
    setIsSaved(false);
  };

  const handleSave = async () => {
    const finalSlug = slug || 'toko-baru';
    const cleanIg = instagram.replace(/^@/, '').trim();
    const settingsData = {
      brandName: brandName || 'Nama Toko',
      slug: finalSlug,
      phone: phone || '',
      instagram: cleanIg,
      address: address || '',
      bio: bio || '',
      logo: logo || '',
      updatedAt: new Date().toISOString()
    };

    // 1. Save to Cloud Firestore
    try {
      await setDoc(doc(db, 'stores', getStoreId()), settingsData, { merge: true });
      
      // Simpan slug mapping agar URL /store/[slug] bisa langsung meresolusi storeId secara real-time
      if (finalSlug) {
        await setDoc(doc(db, 'store_slugs', finalSlug), {
          storeId: getStoreId(),
          slug: finalSlug,
          brandName: brandName || 'Nama Toko',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
      
      // 2. Save to localStorage only if Firestore succeeds
      const oldRaw = localStorage.getItem(getTenantStorageKey('playbox_shop_settings'));
      let oldData = {};
      try { if (oldRaw) oldData = JSON.parse(oldRaw); } catch(e) {}

      const newSettingsString = JSON.stringify({ ...oldData, ...settingsData });
      localStorage.setItem(getTenantStorageKey('playbox_shop_settings'), newSettingsString);
      window.dispatchEvent(new CustomEvent('local-sync', { detail: { key: 'playbox_shop_settings', newValue: newSettingsString } }));
      
      setSlug(finalSlug);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      console.error('Failed saving shop settings to Firestore:', err);
      alert('Gagal menyimpan profil: ' + err.message);
    }
  };

  const storeUrl = `${domain}/store/${slug || 'nama-toko'}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(storeUrl);
    alert('Link Etalase berhasil disalin!\n' + storeUrl);
  };

  const handleDownloadQR = () => {
    if (!qrCanvasRef.current) return;
    const canvas = qrCanvasRef.current.querySelector('canvas');
    if (canvas) {
      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `QR_Etalase_${slug || 'playbox'}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  return (
    <div className="p-4 space-y-6 pb-28 relative min-h-screen">
      <div className="ambient-glow"></div>
      
      {/* Header */}
      <div className="flex items-center mt-2 mb-6">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl mr-4 hover:bg-white/10 transition-colors">
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Profil & Link Toko</h1>
          <p className="text-xs text-playbox-text-secondary mt-0.5">Identitas Rental, Logo & Kontak Pelanggan</p>
        </div>
      </div>

      {/* Main Settings Card */}
      <div className="glass-surface p-6 rounded-3xl space-y-5">
        
        {/* Upload Logo Section */}
        <div>
          <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Logo Rental / Store</label>
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 relative group shadow-inner">
              {logo ? (
                <img src={logo} alt="Store Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl opacity-40">🎮</span>
              )}
            </div>
            <div className="space-y-2 flex-1">
              <label className="inline-block px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors border border-white/10">
                <span>📁 Upload Logo Baru</span>
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/webp" 
                  onChange={handleLogoUpload} 
                  className="hidden" 
                />
              </label>
              {logo && (
                <button 
                  type="button" 
                  onClick={handleRemoveLogo}
                  className="block text-[11px] text-red-400 hover:text-red-300 transition-colors font-semibold"
                >
                  ✕ Hapus Logo
                </button>
              )}
              <p className="text-[10px] text-white/40">Rekomendasi rasio 1:1 (PNG/JPG max 2MB). Tampil di dashboard & etalase customer.</p>
            </div>
          </div>
        </div>

        {/* Nama Brand */}
        <div>
          <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Nama Brand / Toko</label>
          <input 
            type="text" 
            value={brandName}
            onChange={handleBrandNameChange}
            placeholder="Contoh: Budi Rental PlayStation"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-playbox-accent transition-colors"
          />
          <p className="text-[10px] text-white/40 mt-1.5">Akan tampil sebagai judul di etalase, invoice, dan pesan WhatsApp.</p>
        </div>

        {/* WhatsApp CS */}
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
          <p className="text-[10px] text-white/40 mt-1.5">Nomor tujuan tombol "Hubungi CS" etalase & tertera di invoice.</p>
        </div>

        {/* Instagram */}
        <div>
          <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Akun Instagram Toko</label>
          <div className="relative">
            <input 
              type="text" 
              value={instagram}
              onChange={(e) => { setInstagram(e.target.value); setIsSaved(false); }}
              placeholder="Contoh: playbox.malang (tanpa @)"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 pl-11 text-white focus:outline-none focus:border-playbox-accent transition-colors"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base">📸</span>
          </div>
          <p className="text-[10px] text-white/40 mt-1.5">Pelanggan bisa langsung klik tombol Instagram di katalog.</p>
        </div>

        {/* Alamat Lengkap */}
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

        {/* Deskripsi Bio */}
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

        {/* Slug URL */}
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

      {/* Link Generator & QR Code Result */}
      <div className="glass-surface p-1 rounded-3xl bg-gradient-to-br from-playbox-accent/20 to-transparent">
        <div className="bg-playbox-bg rounded-[22px] p-6 space-y-5">
          <div>
            <h2 className="text-sm font-bold text-white mb-1 flex items-center">
              <span className="mr-2">🔗</span> Link & QR Code Etalase Otomatis
            </h2>
            <p className="text-xs text-playbox-text-secondary leading-relaxed">
              Link dan QR Code ini siap dipasang di meja kasir, standing banner, atau Bio Instagram untuk memudahkan customer booking langsung.
            </p>
          </div>

          {/* QR Code Display & Download */}
          <div className="p-5 bg-black/40 border border-white/10 rounded-2xl flex flex-col items-center justify-center space-y-4">
            <div ref={qrCanvasRef} className="p-3 bg-white rounded-2xl shadow-xl flex items-center justify-center">
              <QRCodeCanvas 
                value={storeUrl}
                size={180}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="text-center">
              <p className="text-xs font-bold text-white">{brandName}</p>
              <p className="text-[10px] text-white/50">{storeUrl}</p>
            </div>

            <button 
              onClick={handleDownloadQR}
              className="w-full py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-xs rounded-xl transition-all active:scale-95 flex items-center justify-center space-x-2 shadow-sm"
            >
              <span>📥 Download QR Code (PNG)</span>
            </button>
          </div>

          <div className="bg-black/50 border border-white/10 rounded-xl p-3 flex items-center justify-between group overflow-hidden">
            <p className="text-playbox-accent text-sm font-medium truncate max-w-[200px] sm:max-w-xs transition-colors group-hover:text-white">
              {storeUrl}
            </p>
            <button onClick={handleCopyLink} className="bg-playbox-accent/20 hover:bg-playbox-accent text-playbox-accent hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all ml-2 flex-shrink-0">
              Copy
            </button>
          </div>

          <div className="pt-2 grid grid-cols-2 gap-3">
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
