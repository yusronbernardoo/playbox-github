'use client';
import { getStoreId, getTenantStorageKey } from '@/lib/tenant';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export default function ReturnCheck() {
  const { id } = useParams();
  const router = useRouter();
  const [bookingData, setBookingData] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);

  // Fine states
  const [lateHours, setLateHours] = useState(0);
  const [lateFinePerHour, setLateFinePerHour] = useState(20000);
  const [damageFine, setDamageFine] = useState('');
  const [internalFine, setInternalFine] = useState('');
  const [notes, setNotes] = useState('');
  const [proofPhotos, setProofPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      let b: any = null;
      
      // 1. Fetch from Firestore
      try {
        if (id && typeof id === 'string') {
          const docRef = doc(db, 'stores', getStoreId(), 'bookings', id);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            b = { ...snap.data(), id: snap.id };
          }
        }
      } catch (err) {
        console.warn('Firestore getDoc fallback:', err);
      }

      // 2. Fallback to localStorage
      if (!b) {
        const savedBookings = localStorage.getItem(getTenantStorageKey('playbox_mock_bookings'));
        if (savedBookings) {
          const bookings = JSON.parse(savedBookings);
          b = bookings.find((item: any) => item.id === id);
        }
      }

      if (b) {
        setBookingData(b);

        // Calculate late hours using isoEnd or endTime
        try {
          const endStr = b.isoEnd || b.endTime;
          if (endStr) {
            const endDate = new Date(endStr);
            const now = new Date();
            if (now > endDate) {
              const diffMs = now.getTime() - endDate.getTime();
              const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
              setLateHours(diffHours);
            }
          }
        } catch (e) {
          console.error(e);
        }

        // Setup unit specs checklist
        const savedUnits = localStorage.getItem(getTenantStorageKey('playbox_mock_units'));
        if (savedUnits) {
          const units = JSON.parse(savedUnits);
          const unit = units.find((u: any) => u.id === b.unitId || u.name === b.unit);
          if (unit && unit.specs) {
            setItems([
              { id: 0, name: `Console ${unit.name}`, status: 'Lengkap' },
              ...unit.specs.map((spec: string, idx: number) => ({
                id: idx + 1,
                name: spec,
                status: 'Lengkap'
              }))
            ]);
            return;
          }
        }
      }

      // Default checklist
      setItems([
        { id: 1, name: 'Console PS5 Disc Edition', status: 'Lengkap' },
        { id: 2, name: '2x DualSense Controller', status: 'Lengkap' },
        { id: 3, name: 'Kabel HDMI 2.1', status: 'Lengkap' },
        { id: 4, name: 'Kabel Power', status: 'Lengkap' },
      ]);
    };

    loadData();
  }, [id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newPhotos = Array.from(e.target.files).map(file => URL.createObjectURL(file));
      setProofPhotos(prev => [...prev, ...newPhotos]);
    }
  };

  const toggleStatus = (id: number) => {
    setItems(items.map(i => {
      if (i.id === id) {
        return {
          ...i,
          status: i.status === 'Lengkap' ? 'Rusak/Hilang' : 'Lengkap'
        };
      }
      return i;
    }));
  };

  const allComplete = items.every(i => i.status === 'Lengkap');

  const handleFinish = async () => {
    setIsSubmitting(true);
    const totalLateFine = lateHours * lateFinePerHour;
    const totalDamageFine = Number(damageFine) || 0;
    const totalInternalFine = Number(internalFine) || 0;
    const currentPrice = Number(bookingData?.totalPrice) || 0;
    const updatedTotalPrice = currentPrice + totalLateFine + totalDamageFine + totalInternalFine;

    const finesData = {
      lateHours,
      lateFinePerHour,
      totalLateFine,
      totalDamageFine,
      totalInternalFine,
      notes,
      proofPhotos
    };

    // 1. Update Firestore
    try {
      if (id && typeof id === 'string') {
        await updateDoc(doc(db, 'stores', getStoreId(), 'bookings', id), {
          status: 'Selesai',
          statusColor: 'bg-playbox-ready/15 text-playbox-ready border border-playbox-ready/20',
          needAction: false,
          fines: finesData,
          totalPrice: updatedTotalPrice,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Failed to update booking status in Firestore:', err);
    }

    // 2. Update localStorage
    const savedBookings = localStorage.getItem(getTenantStorageKey('playbox_mock_bookings'));
    const savedUnits = localStorage.getItem(getTenantStorageKey('playbox_mock_units'));
    
    if (savedBookings) {
      let bookings = JSON.parse(savedBookings);
      const bookingIndex = bookings.findIndex((b: any) => b.id === id);
      if (bookingIndex !== -1) {
        bookings[bookingIndex] = {
          ...bookings[bookingIndex],
          status: 'Selesai',
          statusColor: 'bg-playbox-ready/15 text-playbox-ready border border-playbox-ready/20',
          needAction: false,
          fines: finesData,
          totalPrice: updatedTotalPrice
        };
        localStorage.setItem(getTenantStorageKey('playbox_mock_bookings'), JSON.stringify(bookings));
      }
    }

    if (bookingData?.unitId) {
      try {
        await updateDoc(doc(db, 'stores', getStoreId(), 'units', bookingData.unitId), {
          status: 'Ready',
          statusColor: 'bg-playbox-ready/10 text-playbox-ready hover:bg-playbox-ready/20',
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error('Failed to update unit status in Firestore:', err);
      }
    }

    if (savedUnits && bookingData?.unitId) {
      let units = JSON.parse(savedUnits);
      units = units.map((u: any) => {
        if (u.id === bookingData.unitId || u.name === bookingData.unit) {
          return {
            ...u,
            status: 'Ready',
            statusColor: 'bg-playbox-ready/10 text-playbox-ready hover:bg-playbox-ready/20'
          };
        }
        return u;
      });
      localStorage.setItem(getTenantStorageKey('playbox_mock_units'), JSON.stringify(units));
    }

    setIsSubmitting(false);
    alert("Pengecekan selesai! Status booking telah diubah menjadi Selesai.");
    router.push(`/dashboard/booking/${id}/timeline`);
  };

  return (
    <div className="max-w-xl mx-auto p-4 space-y-6 pb-48 relative min-h-screen">
      <div className="ambient-glow"></div>

      {/* Header */}
      <div className="flex items-center mt-2 mb-6">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl mr-4 hover:bg-white/10 transition-colors">
          ←
        </button>
        <h1 className="text-xl font-bold tracking-tight">Pengecekan Return</h1>
      </div>

      {lateHours > 0 && (
        <div className="glass-surface-elevated p-5 rounded-3xl border-l-4 border-l-red-500 animate-in fade-in">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-bold text-red-500 flex items-center">
              <span className="mr-2">⚠️</span> Keterlambatan Pengembalian
            </h2>
            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded font-bold">{lateHours} Jam</span>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Denda per Jam</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-playbox-text-secondary text-sm">Rp</span>
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={lateFinePerHour ? Number(lateFinePerHour).toLocaleString('id-ID') : ''}
                  onChange={e => setLateFinePerHour(Number(e.target.value.replace(/\D/g, '')))}
                  className="w-full p-3 pl-12 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
            <div className="flex justify-between items-center text-sm pt-2 border-t border-white/5 font-bold">
              <span>Total Denda Telat</span>
              <span className="text-red-400">Rp {(lateHours * lateFinePerHour).toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>
      )}

      <div className="glass-surface p-6 rounded-3xl">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest">Checklist Barang</h2>
          <span className="text-xs text-playbox-text-secondary bg-white/5 px-2 py-1 rounded-md">{items.filter(i => i.status === 'Lengkap').length}/{items.length} Lengkap</span>
        </div>
        
        <div className="space-y-2">
          {items.map(item => (
            <div 
              key={item.id} 
              onClick={() => toggleStatus(item.id)}
              className={`flex justify-between items-center p-4 rounded-2xl border cursor-pointer transition-all duration-200 group active:scale-[0.98]
                ${item.status === 'Lengkap' 
                  ? 'bg-playbox-ready/10 border-playbox-ready/20 hover:bg-playbox-ready/15' 
                  : 'bg-red-500/10 border-red-500/20 hover:bg-red-500/15'
                }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${item.status === 'Lengkap' ? 'bg-playbox-ready border-playbox-ready text-white' : 'border-red-500 text-red-500'}`}>
                  {item.status === 'Lengkap' ? '✓' : '!'}
                </div>
                <span className={`text-sm font-medium ${item.status === 'Lengkap' ? 'text-white' : 'text-red-400'}`}>{item.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {(!allComplete || true) && (
        <div className="glass-surface p-6 rounded-3xl space-y-4 animate-in fade-in">
          <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest">Denda Tambahan</h2>
          
          <div>
            <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Denda Kerusakan / Kehilangan</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-playbox-text-secondary text-sm">Rp</span>
              <input 
                type="text" 
                inputMode="numeric"
                value={damageFine ? Number(damageFine).toLocaleString('id-ID') : ''}
                onChange={e => setDamageFine(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                className="w-full p-4 pl-12 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-red-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Denda Internal (Aturan Khusus)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-playbox-text-secondary text-sm">Rp</span>
              <input 
                type="text" 
                inputMode="numeric"
                value={internalFine ? Number(internalFine).toLocaleString('id-ID') : ''}
                onChange={e => setInternalFine(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                className="w-full p-4 pl-12 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-red-500"
              />
            </div>
            <p className="text-[10px] text-playbox-text-secondary mt-1.5">Misal: unit bau rokok, stiker dilepas, dsb.</p>
          </div>
        </div>
      )}

      <div className="glass-surface p-6 rounded-3xl space-y-4">
        <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest">Catatan Tambahan & Bukti</h2>
        
        <textarea 
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Tuliskan keterangan detail tentang kondisi unit..."
          rows={3}
          className="w-full p-4 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent transition-colors placeholder:text-white/20"
        ></textarea>

        <div>
          <div className="flex flex-wrap gap-2">
            {proofPhotos.map((url, i) => (
              <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10">
                <img src={url} alt={`Bukti ${i}`} className="w-full h-full object-cover" />
              </div>
            ))}
            <div className="relative w-16 h-16 border-2 border-dashed border-white/20 rounded-xl flex items-center justify-center text-white/50 hover:text-playbox-accent hover:border-playbox-accent transition-colors">
              <input type="file" multiple accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <span className="text-xl">+</span>
            </div>
          </div>
        </div>
        
      </div>

      {/* Docked Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 bg-[#0A0F1F]/95 backdrop-blur-2xl border-t border-white/10 z-50 shadow-2xl">
        <div className="max-w-xl mx-auto space-y-3">
          {bookingData?.documents && bookingData.documents.length > 0 && (
            <div className="bg-yellow-500/20 border border-yellow-500/50 p-3 rounded-xl flex items-start space-x-3 shadow-[0_0_15px_rgba(234,179,8,0.2)] animate-pulse">
              <svg className="w-6 h-6 text-yellow-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <div>
                <p className="text-yellow-500 font-bold text-sm">PENGEMBALIAN JAMINAN</p>
                <p className="text-yellow-500/90 text-[11px] mt-0.5 leading-tight">Jangan lupa kembalikan dokumen: <span className="font-bold text-white bg-yellow-500/30 px-1 rounded">{bookingData.documents.map((d: any) => d.title).join(', ')}</span> milik pelanggan sebelum menekan tombol Selesai!</p>
              </div>
            </div>
          )}
          <button 
            onClick={handleFinish} 
            disabled={isSubmitting}
            className="w-full py-4 saas-button rounded-2xl font-bold shadow-[0_0_20px_rgba(37,99,235,0.4)] text-sm tracking-wide disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center"
          >
            {isSubmitting ? 'Menyimpan...' : 'Selesai Pengecekan'}
          </button>
        </div>
      </div>
    </div>
  );
}
