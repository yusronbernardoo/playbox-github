'use client';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, getDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

export default function UnitDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [unit, setUnit] = useState<any>(null);

  useEffect(() => {
    if (!id || typeof id !== 'string') return;

    // Real-time listener for unit details
    const unsub = onSnapshot(doc(db, 'units', id), (snap) => {
      if (snap.exists()) {
        setUnit({ ...snap.data(), id: snap.id });
      } else {
        const saved = localStorage.getItem('playbox_mock_units');
        if (saved) {
          try {
            const units = JSON.parse(saved);
            const found = units.find((u: any) => u.id === id);
            if (found) setUnit(found);
          } catch {}
        }
      }
    }, (err) => {
      console.warn('Unit snapshot error:', err);
      const saved = localStorage.getItem('playbox_mock_units');
      if (saved) {
        try {
          const units = JSON.parse(saved);
          const found = units.find((u: any) => u.id === id);
          if (found) setUnit(found);
        } catch {}
      }
    });

    return () => unsub();
  }, [id]);

  const handleDelete = async () => {
    if (confirm('Yakin ingin menghapus unit ini? Tindakan ini tidak dapat dibatalkan.')) {
      try {
        if (id && typeof id === 'string') {
          await deleteDoc(doc(db, 'units', id));
        }
      } catch (err) {
        console.error('Error deleting unit from Firestore:', err);
      }

      const saved = localStorage.getItem('playbox_mock_units');
      if (saved) {
        try {
          let units = JSON.parse(saved);
          units = units.filter((u: any) => u.id !== id);
          localStorage.setItem('playbox_mock_units', JSON.stringify(units));
        } catch {}
      }
      alert('Unit berhasil dihapus!');
      router.push('/dashboard/unit');
    }
  };

  if (!unit) return <div className="p-8 text-center text-white/50">Memuat...</div>;

  return (
    <div className="pb-28 relative">
      <div className="ambient-glow"></div>

      {/* Hero Image */}
      <div className="relative w-full h-72 bg-black">
        <img src={unit.image} alt={unit.name} className="w-full h-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0E1221] via-[#0E1221]/50 to-transparent"></div>
        
        {/* Back Button */}
        <button onClick={() => router.back()} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-xl text-white hover:bg-black/70 transition-colors z-10 border border-white/10">
          ←
        </button>
      </div>

      <div className="p-4 -mt-20 relative z-10 space-y-6">
        
        {/* Header Info */}
        <div className="glass-surface-elevated p-6 rounded-3xl shadow-2xl">
          <div className="flex justify-between items-start mb-2">
            <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest ${unit.statusColor}`}>
              {unit.status}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">{unit.name}</h1>
          <p className="text-sm text-playbox-text-secondary">{unit.type}</p>
          
          <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-5">
            <div>
              <p className="text-xs text-playbox-text-secondary uppercase tracking-wider mb-1">Harga Sewa</p>
              <p className="text-2xl font-bold text-white tracking-tight">
                  {unit.priceTiers && unit.priceTiers.length > 0 ? (
                    <>
                      Rp {(unit.priceTiers[0].price || 0).toLocaleString('id-ID')} <span className="text-sm font-normal text-playbox-text-secondary">/ {unit.priceTiers[0].durationVal} {unit.priceTiers[0].durationUnit}</span>
                    </>
                  ) : (
                    <>
                      Rp {(unit.price || 0).toLocaleString('id-ID')} <span className="text-sm font-normal text-playbox-text-secondary">/ 24j</span>
                    </>
                  )}
              </p>
            </div>
          </div>
        </div>

        {/* Spesifikasi / Kelengkapan */}
        <div className="glass-surface p-6 rounded-3xl space-y-4">
          <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest">Kelengkapan Standar</h2>
          <div className="grid grid-cols-2 gap-3">
            {unit.specs?.map((spec: string, idx: number) => (
              <div key={idx} className="flex items-center space-x-2 bg-white/5 p-3 rounded-xl border border-white/5">
                <span className="w-1.5 h-1.5 rounded-full bg-playbox-accent/50"></span>
                <span className="text-sm text-white/90 font-medium">{spec}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Game Terinstal */}
        {unit.games && unit.games.length > 0 && (
          <div className="glass-surface p-6 rounded-3xl space-y-4">
            <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest">Game Terinstal</h2>
            <div className="flex flex-wrap gap-2">
              {unit.games.map((game: string, idx: number) => (
                <div key={idx} className="flex items-center space-x-2 bg-white/5 px-3 py-2 rounded-xl border border-white/5">
                  <span className="text-sm text-white/90 font-medium">{game}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History / Info Lain */}
        <div className="glass-surface p-6 rounded-3xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest">Riwayat Terakhir</h2>
            <Link href="#" className="text-xs text-playbox-accent hover:underline">Lihat Semua</Link>
          </div>
          
          {unit.status === 'Disewa' ? (
            <div className="flex justify-between items-center py-3 border-b border-white/5">
              <div>
                <p className="text-sm font-semibold text-white/90">Budi Santoso</p>
                <p className="text-xs text-playbox-text-secondary">Sewa 24 Jam</p>
              </div>
              <span className="text-xs text-playbox-accent bg-playbox-accent/10 px-2.5 py-1 rounded-full font-medium">Sedang Jalan</span>
            </div>
          ) : (
             <div className="py-4 text-center">
               <p className="text-sm text-playbox-text-secondary">Belum ada riwayat aktif.</p>
             </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-[72px] w-full max-w-md left-1/2 -translate-x-1/2 p-4 bg-playbox-bg/80 backdrop-blur-xl border-t border-white/5 z-40">
        <div className="max-w-md mx-auto flex space-x-3">
          <button 
            onClick={handleDelete}
            className="py-4 px-6 bg-white/5 border border-white/10 text-white font-medium rounded-2xl hover:bg-red-500/20 hover:border-red-500/30 transition-all active:scale-95 flex items-center justify-center shadow-inner group"
            title="Hapus Unit"
          >
            <span className="text-lg opacity-70 group-hover:opacity-100 transition-opacity">🗑️</span>
          </button>
          <Link href={`/dashboard/unit/${id}/edit`} className="flex-1 py-4 saas-button rounded-2xl font-semibold shadow-[0_4px_20px_rgba(226,23,142,0.4)] text-sm tracking-wide text-center">
            Edit Unit
          </Link>
        </div>
      </div>
    </div>
  );
}
