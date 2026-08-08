'use client';
import { getStoreId, getTenantStorageKey } from '@/lib/tenant';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export default function DendaSettingsPage() {
  const router = useRouter();

  const [tolerance, setTolerance] = useState('15');
  const [hourlyRate, setHourlyRate] = useState('20000');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // 1. Real-time Firestore Listener
    const unsubscribe = onSnapshot(doc(db, 'stores', getStoreId(), 'settings', 'denda'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.tolerance !== undefined) setTolerance(data.tolerance.toString());
        if (data.hourlyRate !== undefined) setHourlyRate(data.hourlyRate.toString());
        localStorage.setItem(getTenantStorageKey('playbox_denda_rules'), JSON.stringify(data));
        return;
      }

      // Fallback to localStorage
      const saved = localStorage.getItem(getTenantStorageKey('playbox_denda_rules'));
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setTolerance(parsed.tolerance?.toString() || '15');
          setHourlyRate(parsed.hourlyRate?.toString() || '20000');
        } catch {}
      }
    }, (err) => {
      console.warn('Firestore denda listener error:', err);
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tolerance || !hourlyRate) return alert('Lengkapi semua kolom!');
    
    setIsSaving(true);
    const rules = {
      tolerance: parseInt(tolerance) || 0,
      hourlyRate: parseInt(hourlyRate) || 0,
      updatedAt: new Date().toISOString()
    };
    
    localStorage.setItem(getTenantStorageKey('playbox_denda_rules'), JSON.stringify(rules));

    try {
      await setDoc(doc(db, 'stores', getStoreId(), 'settings', 'denda'), rules, { merge: true });
    } catch (err) {
      console.error('Failed to sync denda settings to Firestore:', err);
    }

    setIsSaving(false);
    alert('Pengaturan Denda berhasil disimpan!');
    router.back();
  };

  return (
    <div className="p-4 max-w-xl mx-auto pb-48 min-h-screen flex flex-col relative">
      <div className="ambient-glow"></div>

      {/* Header */}
      <div className="flex items-center mt-2 mb-6 relative z-10">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl mr-4 hover:bg-white/10 transition-colors">
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Pengaturan Denda</h1>
          <p className="text-xs text-playbox-text-secondary mt-0.5">Tarif Keterlambatan Sewa</p>
        </div>
      </div>

      <div className="relative z-10 space-y-6 mb-12">
        <form onSubmit={handleSave} className="glass-surface p-6 rounded-3xl space-y-6">
          <div className="p-4 bg-playbox-ready/10 border border-playbox-ready/20 rounded-2xl text-playbox-ready text-xs leading-relaxed">
            <strong className="block mb-1 font-bold">💡 Cara Kerja:</strong>
            Sistem akan menghitung denda keterlambatan secara otomatis saat Anda membuat Invoice Selesai. Jika penyewa lewat dari masa toleransi, akan otomatis dikalikan dengan tarif per jam di bawah ini.
          </div>

          <div>
            <label className="block text-xs font-bold text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Masa Toleransi (Menit)</label>
            <p className="text-xs text-white/50 mb-2">Batas waktu aman setelah jam sewa habis sebelum mulai dihitung denda.</p>
            <div className="relative">
              <input 
                type="number" 
                value={tolerance}
                onChange={e => setTolerance(e.target.value)}
                className="w-full p-4 pr-16 rounded-2xl bg-black/30 border border-white/10 text-white text-sm font-semibold focus:outline-none focus:border-playbox-accent transition-colors"
                placeholder="Mis: 15"
                min="0"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-playbox-text-secondary text-sm font-bold">Menit</span>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Tarif Denda (Per Jam)</label>
            <p className="text-xs text-white/50 mb-2">Tarif denda per jam keterlambatan (berlaku kelipatan, misal telat 2 jam = 2 x tarif).</p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-playbox-text-secondary text-sm font-bold">Rp</span>
              <input 
                type="number" 
                value={hourlyRate}
                onChange={e => setHourlyRate(e.target.value)}
                className="w-full p-4 pl-12 rounded-2xl bg-black/30 border border-white/10 text-white text-sm font-semibold focus:outline-none focus:border-playbox-accent transition-colors"
                placeholder="Mis: 20000"
                min="0"
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={isSaving}
              className="w-full py-4 saas-button rounded-2xl font-bold shadow-[0_4px_20px_rgba(37,99,235,0.4)] text-sm tracking-wide disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center"
            >
              {isSaving ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Menyimpan...
                </span>
              ) : (
                'Simpan Pengaturan Denda'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
