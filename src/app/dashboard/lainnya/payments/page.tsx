'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoreId, getTenantStorageKey } from '@/lib/tenant';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

interface PaymentMethod {
  id: string;
  type: 'Bank Transfer' | 'E-Wallet' | 'QRIS';
  name: string; // e.g. BCA, Mandiri, GoPay, QRIS Toko
  account: string; // Account Number or Phone
  owner: string;
  active: boolean;
  qrisImage?: string; // Base64 compressed
}

// Helper to compress image down to ~30-50KB using Canvas
const compressImage = (file: File, maxWidth = 600, maxHeight = 600, quality = 0.8): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export default function PaymentMethods() {
  const router = useRouter();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [previewQris, setPreviewQris] = useState<string | null>(null);

  // Form State
  const [type, setType] = useState<'Bank Transfer' | 'E-Wallet' | 'QRIS'>('Bank Transfer');
  const [name, setName] = useState('');
  const [account, setAccount] = useState('');
  const [owner, setOwner] = useState('');
  const [active, setActive] = useState(true);
  const [qrisImage, setQrisImage] = useState('');
  
  // Loading States
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // 1. Real-time Firestore Listener
    const unsubscribe = onSnapshot(doc(db, 'stores', getStoreId(), 'settings', 'payments'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data.list)) {
          setMethods(data.list);
          localStorage.setItem(getTenantStorageKey('playbox_payments'), JSON.stringify(data.list));
          return;
        }
      }

      // Fallback to localStorage
      const saved = localStorage.getItem(getTenantStorageKey('playbox_payments'));
      if (saved) {
        try {
          setMethods(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      } else {
        const initial: PaymentMethod[] = [
          { id: 'P01', type: 'Bank Transfer', name: 'BCA', account: '1234567890', owner: 'Budi Santoso', active: true },
          { id: 'P02', type: 'E-Wallet', name: 'GoPay', account: '081234567890', owner: 'Budi Santoso', active: true },
        ];
        setMethods(initial);
        localStorage.setItem(getTenantStorageKey('playbox_payments'), JSON.stringify(initial));
      }
    }, (err) => {
      console.warn('Firestore payment listener error:', err);
    });

    return () => unsubscribe();
  }, []);

  const openAddModal = () => {
    setEditId(null);
    setType('Bank Transfer');
    setName('');
    setAccount('');
    setOwner('');
    setActive(true);
    setQrisImage('');
    setShowModal(true);
  };

  const openEditModal = (method: PaymentMethod) => {
    setEditId(method.id);
    setType(method.type);
    setName(method.name);
    setAccount(method.account || '');
    setOwner(method.owner || '');
    setActive(method.active);
    setQrisImage(method.qrisImage || '');
    setShowModal(true);
  };

  const handleQrisUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      // Auto compress image to max 600x600 px (only ~30-50KB)
      const compressed = await compressImage(file, 600, 600, 0.8);
      setQrisImage(compressed);
    } catch (err) {
      console.error('Failed to compress QRIS image:', err);
      alert('Gagal memproses gambar. Silakan coba pilih gambar lain.');
    } finally {
      setIsCompressing(false);
    }
  };

  const saveMethod = async () => {
    if (!name.trim()) {
      return alert('Mohon masukkan nama metode pembayaran (contoh: BCA / GoPay / QRIS Toko)!');
    }

    if (type === 'QRIS' && !qrisImage) {
      return alert('Mohon unggah gambar barcode QRIS terlebih dahulu!');
    }

    if (type !== 'QRIS' && !account.trim()) {
      return alert('Mohon masukkan nomor rekening atau nomor HP!');
    }

    const finalAccount = type === 'QRIS' ? (account.trim() || 'QRIS Dinamis/Statis') : account.trim();
    const finalOwner = owner.trim() || (type === 'QRIS' ? name : 'Pemilik Toko');

    setIsSaving(true);

    try {
      let updated = [...methods];
      if (editId) {
        updated = updated.map(m => m.id === editId ? { 
          id: editId, 
          type, 
          name: name.trim(), 
          account: finalAccount, 
          owner: finalOwner, 
          active, 
          qrisImage: type === 'QRIS' ? qrisImage : undefined 
        } : m);
      } else {
        updated.push({
          id: 'P' + Math.floor(1000 + Math.random() * 9000),
          type, 
          name: name.trim(), 
          account: finalAccount, 
          owner: finalOwner, 
          active, 
          qrisImage: type === 'QRIS' ? qrisImage : undefined
        });
      }

      // 1. Save to Cloud Firestore
      await setDoc(doc(db, 'stores', getStoreId(), 'settings', 'payments'), {
        list: updated,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 2. Save to localStorage
      localStorage.setItem(getTenantStorageKey('playbox_payments'), JSON.stringify(updated));
      setMethods(updated);
      setShowModal(false);
    } catch (e: any) {
      console.error('Error saving payment method:', e);
      alert('Terjadi kesalahan saat menyimpan: ' + (e.message || 'Koneksi bermasalah.'));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteMethod = async (id: string) => {
    if (confirm('Yakin ingin menghapus metode pembayaran ini?')) {
      const updated = methods.filter(m => m.id !== id);
      setMethods(updated);
      
      try {
        await setDoc(doc(db, 'stores', getStoreId(), 'settings', 'payments'), {
          list: updated,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        localStorage.setItem(getTenantStorageKey('playbox_payments'), JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to delete payment from Firestore:', err);
      }
      setShowModal(false);
    }
  };

  return (
    <div className="p-4 space-y-6 pb-28 relative h-full">
      <div className="ambient-glow"></div>

      {/* Header */}
      <div className="flex items-center justify-between mt-2 mb-6 relative z-10">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl mr-4 hover:bg-white/10 transition-colors">
            ←
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Metode Pembayaran</h1>
            <p className="text-xs text-playbox-text-secondary mt-0.5">Rekening Bank, E-Wallet & QRIS Toko</p>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-4 relative z-10">
        {methods.length === 0 ? (
          <div className="p-8 text-center text-white/50 text-sm glass-surface rounded-2xl">
            Belum ada metode pembayaran.<br/>Silakan tambahkan Rekening atau QRIS.
          </div>
        ) : (
          methods.map((method) => (
            <div key={method.id} className="glass-surface p-5 rounded-2xl group hover:bg-white/5 transition-colors relative overflow-hidden">
              {!method.active && <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-end pr-4"><span className="bg-red-500/20 text-red-400 text-xs px-2.5 py-1 rounded-full border border-red-500/30">Nonaktif</span></div>}
              
              <div className="relative z-20">
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    method.type === 'QRIS' 
                      ? 'bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30' 
                      : method.type === 'E-Wallet'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-white/10 text-white/80 border border-white/10'
                  }`}>
                    {method.type}
                  </span>
                  <button onClick={() => openEditModal(method)} className="text-xs text-playbox-accent hover:underline px-3 py-1 bg-white/10 rounded-xl transition-all">
                    ✏️ Edit
                  </button>
                </div>
                
                <div className="flex justify-between items-center mt-2">
                  <div>
                    <h3 className="font-bold text-lg text-white/95">{method.name}</h3>
                    {method.type === 'QRIS' ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-[#25D366] font-semibold flex items-center gap-1">
                          <span>✅</span> Barcode QRIS Terpasang
                        </span>
                        {method.qrisImage && (
                          <button 
                            onClick={() => setPreviewQris(method.qrisImage || null)}
                            className="text-[11px] text-playbox-accent hover:underline font-bold bg-playbox-accent/10 px-2 py-0.5 rounded"
                          >
                            Lihat QRIS 🔍
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-xl font-mono text-white tracking-wider my-1">{method.account}</p>
                    )}
                    <p className="text-xs text-playbox-text-secondary mt-1">a.n. {method.owner}</p>
                  </div>

                  {method.type === 'QRIS' && method.qrisImage && (
                    <div 
                      onClick={() => setPreviewQris(method.qrisImage || null)}
                      className="w-16 h-16 rounded-xl bg-white p-1 shadow-md cursor-pointer hover:scale-105 transition-transform flex-shrink-0"
                    >
                      <img src={method.qrisImage} alt="QRIS" className="w-full h-full object-contain" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-[72px] w-full max-w-md left-1/2 -translate-x-1/2 p-4 bg-playbox-bg/80 backdrop-blur-xl border-t border-white/5 z-40">
        <button 
          onClick={openAddModal}
          type="button" 
          className="w-full py-4 bg-gradient-to-r from-playbox-accent to-pink-600 text-white rounded-2xl font-bold shadow-[0_4px_20px_rgba(37,99,235,0.4)] hover:opacity-90 transition-all text-sm tracking-wide"
        >
          + Tambah Rekening / E-Wallet / QRIS
        </button>
      </div>

      {/* Modal Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-[100] max-w-md mx-auto flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#0A0F1F] w-full max-h-[88vh] sm:rounded-3xl rounded-t-3xl border border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 duration-300 relative overflow-hidden">
            <div className="p-5 border-b border-white/10 shrink-0 bg-[#0A0F1F]/95 backdrop-blur-md z-10 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">{editId ? 'Edit Metode Pembayaran' : 'Tambah Metode Pembayaran'}</h2>
                <p className="text-[11px] text-white/50">Tersinkronisasi otomatis ke Cloud</p>
              </div>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 text-white/70">✕</button>
            </div>
            
            <div className="p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
              <div>
                <label className="block text-xs font-bold text-white/60 uppercase mb-2">Jenis Pembayaran</label>
                <div className="flex gap-2">
                  {['Bank Transfer', 'E-Wallet', 'QRIS'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t as any)}
                      className={`flex-1 py-3 text-xs font-bold rounded-xl border transition-all ${type === t ? 'bg-playbox-accent/20 border-playbox-accent text-playbox-accent shadow-sm' : 'bg-black/40 border-white/5 text-white/60 hover:bg-white/5'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/60 uppercase mb-2">
                  {type === 'Bank Transfer' ? 'Nama Bank (contoh: BCA / Mandiri)' : type === 'E-Wallet' ? 'Nama E-Wallet (contoh: GoPay / DANA / OVO)' : 'Nama QRIS (contoh: QRIS PlayBox Store)'}
                </label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder={type === 'Bank Transfer' ? "Contoh: BCA" : type === 'E-Wallet' ? "Contoh: GoPay" : "Contoh: QRIS Toko"} 
                  className="w-full p-4 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent" 
                />
              </div>
              
              {type !== 'QRIS' ? (
                <div>
                  <label className="block text-xs font-bold text-white/60 uppercase mb-2">Nomor Rekening / No HP</label>
                  <input 
                    type="text" 
                    inputMode="numeric" 
                    value={account} 
                    onChange={e => setAccount(e.target.value)} 
                    placeholder="Contoh: 1234567890" 
                    className="w-full p-4 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-playbox-accent" 
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-white/60 uppercase mb-2">Upload Gambar QRIS Toko</label>
                  <div className="w-full min-h-[160px] bg-black/40 border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group hover:border-playbox-accent transition-colors">
                    {isCompressing ? (
                      <div className="p-6 text-center space-y-2">
                        <div className="w-8 h-8 border-3 border-playbox-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p className="text-xs text-playbox-accent font-bold">Mengompres gambar QRIS...</p>
                      </div>
                    ) : qrisImage ? (
                      <div className="relative w-full p-4 flex flex-col items-center">
                        <div className="w-40 h-40 bg-white p-2 rounded-xl shadow-lg relative group/img">
                          <img src={qrisImage} alt="QRIS Preview" className="w-full h-full object-contain" />
                        </div>
                        <p className="text-[11px] text-[#25D366] font-bold mt-2">✓ Gambar QRIS siap disimpan</p>
                        <button 
                          type="button" 
                          onClick={() => setQrisImage('')} 
                          className="mt-2 text-xs text-red-400 hover:underline"
                        >
                          Hapus & Ganti Gambar
                        </button>
                      </div>
                    ) : (
                      <div className="text-center p-6 cursor-pointer">
                        <span className="text-4xl mb-2 block">📷</span>
                        <p className="text-xs font-bold text-white/80">Klik untuk Pilih Foto / Screenshot QRIS</p>
                        <p className="text-[10px] text-white/40 mt-1">Otomatis dikompres & dioptimalkan</p>
                      </div>
                    )}
                    {!qrisImage && !isCompressing && (
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleQrisUpload} 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                      />
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-white/60 uppercase mb-2">Nama Pemilik (Atas Nama)</label>
                <input 
                  type="text" 
                  value={owner} 
                  onChange={e => setOwner(e.target.value)} 
                  placeholder="Contoh: Nama Rental / Budi Santoso" 
                  className="w-full p-4 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent" 
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 mt-4">
                <div>
                  <h3 className="font-bold text-sm text-white">Status Aktif</h3>
                  <p className="text-xs text-white/50">Tampilkan ke pelanggan pada katalog</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setActive(!active)}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${active ? 'bg-playbox-ready' : 'bg-white/20'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute transition-transform ${active ? 'translate-x-7' : 'translate-x-1'}`}></div>
                </button>
              </div>
            </div>

            <div className="p-4 pb-6 sm:pb-4 border-t border-white/10 bg-[#0A0F1F] shrink-0 flex gap-3 z-20">
              {editId && (
                <button 
                  type="button"
                  onClick={() => deleteMethod(editId)} 
                  className="p-3.5 rounded-xl font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 w-14 flex justify-center items-center border border-red-500/20 transition-colors"
                >
                  🗑
                </button>
              )}
              <button 
                type="button"
                onClick={saveMethod} 
                disabled={isSaving || isCompressing}
                className="flex-1 py-4 bg-playbox-accent text-white rounded-xl font-bold shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:bg-blue-600 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
              >
                {isSaving ? 'Menyimpan Data...' : 'Simpan Data Pembayaran'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QRIS Fullscreen Preview Modal */}
      {previewQris && (
        <div 
          onClick={() => setPreviewQris(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-200"
        >
          <div className="bg-white p-4 rounded-3xl max-w-sm w-full shadow-2xl text-center space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-black font-extrabold text-lg">Barcode QRIS Pembayaran</h3>
            <div className="w-full aspect-square bg-white rounded-2xl overflow-hidden flex items-center justify-center p-2 border">
              <img src={previewQris} alt="QRIS" className="w-full h-full object-contain" />
            </div>
            <button 
              onClick={() => setPreviewQris(null)}
              className="w-full py-3 bg-black text-white font-bold rounded-xl text-sm"
            >
              Tutup Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
