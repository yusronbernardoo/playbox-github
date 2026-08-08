'use client';
import { getStoreId, getTenantStorageKey } from '@/lib/tenant';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export default function TermsAndConditions() {
  const router = useRouter();

  const [terms, setTerms] = useState(
    "1. Penyewa wajib menyertakan KTP/SIM asli saat penyewaan sebagai jaminan.\n2. Waktu sewa dihitung 24 jam sejak unit diserahkan.\n3. Keterlambatan pengembalian dikenakan denda Rp 10.000/jam.\n4. Segala bentuk kerusakan hardware maupun controller akibat kelalaian penyewa menjadi tanggung jawab penyewa secara penuh (wajib mengganti biaya servis/komponen).\n5. Tidak diperkenankan meminjamkan kembali (sub-rental) unit kepada pihak ketiga tanpa sepengetahuan pihak rental."
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // 1. Real-time Firestore Listener
    const unsubscribe = onSnapshot(doc(db, 'stores', getStoreId(), 'settings', 'terms'), (snap) => {
      if (snap.exists() && snap.data()?.content) {
        setTerms(snap.data().content);
        localStorage.setItem(getTenantStorageKey('playbox_terms'), snap.data().content);
        return;
      }

      // Fallback to localStorage
      const saved = localStorage.getItem(getTenantStorageKey('playbox_terms'));
      if (saved) {
        setTerms(saved);
      }
    }, (err) => {
      console.warn('Firestore terms listener error:', err);
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    localStorage.setItem(getTenantStorageKey('playbox_terms'), terms);

    try {
      await setDoc(doc(db, 'stores', getStoreId(), 'settings', 'terms'), {
        content: terms,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error('Failed to sync terms to Firestore:', err);
    }

    setIsSaving(false);
    alert('Syarat & Ketentuan berhasil disimpan!');
    router.back();
  };

  return (
    <div className="p-4 space-y-6 pb-36 relative h-full">
      <div className="ambient-glow"></div>

      {/* Header */}
      <div className="flex items-center justify-between mt-2 mb-6 relative z-10">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl mr-4 hover:bg-white/10 transition-colors">
            ←
          </button>
          <h1 className="text-xl font-bold tracking-tight">Syarat & Ketentuan</h1>
        </div>
      </div>

      <div className="relative z-10">
        <p className="text-sm text-playbox-text-secondary mb-4">
          Teks ini akan ditampilkan pada halaman checkout pelanggan dan di-print dalam invoice PDF. Pastikan aturan tertulis dengan jelas.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="glass-surface p-1 rounded-2xl">
            {/* Toolbar Editor */}
            <div className="flex space-x-2 p-3 border-b border-white/5 overflow-x-auto scrollbar-hide">
              {['B', 'I', 'U'].map(format => (
                <button key={format} type="button" className="w-8 h-8 rounded bg-white/5 text-white/70 hover:bg-white/10 font-bold transition-colors">
                  {format}
                </button>
              ))}
              <div className="w-px h-6 bg-white/10 mx-2 self-center"></div>
              <button type="button" className="px-3 h-8 rounded bg-white/5 text-white/70 hover:bg-white/10 text-xs font-bold transition-colors">
                List
              </button>
            </div>
            
            <textarea 
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className="w-full p-4 bg-transparent text-white text-sm focus:outline-none resize-none h-[45vh] leading-relaxed"
              placeholder="Ketik syarat & ketentuan di sini..."
              required
            ></textarea>
          </div>

          {/* Floating Action Button */}
          <div className="fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2 p-4 pb-6 sm:pb-4 bg-[#0A0F1F]/95 backdrop-blur-2xl border-t border-white/10 z-50 shadow-2xl">
            <div className="max-w-md mx-auto">
              <button 
                type="submit" 
                disabled={isSaving}
                className="w-full py-4 saas-button rounded-2xl font-semibold shadow-[0_4px_20px_rgba(37,99,235,0.4)] text-sm tracking-wide disabled:opacity-50"
              >
                {isSaving ? 'Menyimpan...' : 'Simpan Ketentuan'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
