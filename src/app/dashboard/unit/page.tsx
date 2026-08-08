'use client';
import { getStoreId } from '@/lib/tenant';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { formatSmartDuration } from '@/lib/format';

export default function UnitList() {
  const router = useRouter();
  const [role, setRole] = useState('');
  const [filter, setFilter] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const filters = ['Semua', 'Ready', 'Disewa', 'Maintenance'];

  const defaultUnits: any[] = [];
  const [units, setUnits] = useState<any[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filterParam = params.get('filter');
    if (filterParam && filters.includes(filterParam)) {
      setFilter(filterParam);
    }

    const authData = localStorage.getItem('playbox_auth');
    if (authData) {
      setRole(JSON.parse(authData).role);
    }

    // 1. Live state for active bookings
    let cachedActiveBookings: any[] = [];

    const applyStatusUpdate = (rawUnits: any[]) => {
      const now = Date.now();
      
      return rawUnits.map(u => {
        if (u.status === 'Maintenance') {
          return {
            ...u,
            statusColor: 'bg-playbox-maintenance/10 text-playbox-maintenance border border-playbox-maintenance/20'
          };
        }
        
        const unitBookings = cachedActiveBookings.filter(b => b.unitId === u.id || b.unit === u.name);
        
        let isCurrentlyBusy = false;
        let nextBooking = null;
        let nextBookingStartMs = Infinity;

        unitBookings.forEach(b => {
          const startMs = b.isoStart ? new Date(b.isoStart).getTime() : 
                         (b.startTime ? new Date(`${b.startDate || ''} ${b.startTime}`).getTime() : 0);
          const durHours = Number(b.durationHours || b.duration || 24);
          const endMs = b.isoEnd ? new Date(b.isoEnd).getTime() : startMs + (durHours * 60 * 60 * 1000);

          if (now >= startMs && now <= endMs) {
            isCurrentlyBusy = true;
          } else if (startMs > now && startMs < nextBookingStartMs) {
            nextBooking = b;
            nextBookingStartMs = startMs;
          }
        });

        // If the admin manually set status to Disewa in Firestore, we still respect it as a fallback, 
        // but only if it's not dynamically ready. (However, we stopped doing that in verify page).
        const finalIsBusy = isCurrentlyBusy || u.status === 'Sedang Dipakai';

        return {
          ...u,
          status: finalIsBusy ? 'Disewa' : 'Ready',
          statusColor: finalIsBusy 
            ? 'bg-playbox-disewa/10 text-playbox-disewa border border-playbox-disewa/20' 
            : 'bg-playbox-ready/10 text-playbox-ready border border-playbox-ready/20',
          nextBooking: !finalIsBusy && nextBooking ? nextBooking : null
        };
      });
    };

    // 2. Real-time Firestore units listener
    const unsubUnits = onSnapshot(collection(db, 'stores', getStoreId(), 'units'), async (snapshot) => {
      if (!snapshot.empty) {
        const cloudUnits: any[] = [];
        snapshot.forEach((d) => {
          cloudUnits.push({ ...d.data(), id: d.id });
        });
        localStorage.setItem('playbox_mock_units', JSON.stringify(cloudUnits));
        setUnits(applyStatusUpdate(cloudUnits));
      } else {
        // If Firestore is empty, auto-sync existing local units to Firestore
        const saved = localStorage.getItem('playbox_mock_units');
        if (saved) {
          try {
            const localUnits = JSON.parse(saved);
            if (Array.isArray(localUnits) && localUnits.length > 0) {
              setUnits(applyStatusUpdate(localUnits));
              // Push to Cloud Firestore
              for (const u of localUnits) {
                if (u.id) {
                  await setDoc(doc(db, 'stores', getStoreId(), 'units', u.id), u);
                }
              }
              return;
            }
          } catch {}
        }
        setUnits(defaultUnits);
      }
    }, (err) => {
      console.warn('Unit listener err:', err);
      const saved = localStorage.getItem('playbox_mock_units');
      if (saved) {
        try { setUnits(JSON.parse(saved)); } catch {}
      }
    });

    // 3. Real-time Firestore active bookings listener
    const unsubBookings = onSnapshot(collection(db, 'stores', getStoreId(), 'bookings'), (snapshot) => {
      const activeBookings = snapshot.docs
        .map(d => d.data())
        .filter((b: any) => b.status && b.status !== 'Selesai' && b.status !== 'Dibatalkan');
      
      cachedActiveBookings = activeBookings;
      setUnits(prev => applyStatusUpdate(prev));
    }, (err) => {
      console.warn('Unit bookings listener err:', err);
    });

    return () => {
      unsubUnits();
      unsubBookings();
    };
  }, []);

  const filteredUnits = units.filter(u => {
    const matchFilter = filter === 'Semua' || u.status === filter;
    const matchSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        u.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="p-4 space-y-6 h-full">
      {/* Header */}
      <div className="flex justify-between items-center mt-2">
        <h1 className="text-2xl font-bold tracking-tight">Daftar Unit</h1>
        {role === 'owner' && (
          <Link href="/dashboard/unit/new" className="saas-button px-4 py-2 rounded-xl text-sm flex items-center shadow-[0_4px_15px_rgba(37,99,235,0.4)]">
            <span className="mr-1 text-lg font-light leading-none">+</span> Tambah
          </Link>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <input 
          type="text" 
          placeholder="Cari nama unit atau jenis konsol..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-10 text-sm text-white placeholder-white/40 focus:outline-none focus:border-playbox-accent transition-colors"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">🔍</span>
      </div>

      {/* Filter Tabs */}
      <div>
        <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide mask-edges">
          {filters.map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                filter === f 
                  ? 'bg-white text-black shadow-[0_4px_15px_rgba(255,255,255,0.2)]' 
                  : 'glass-surface text-playbox-text-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-white/50 px-1 mt-1">Menampilkan {filteredUnits.length} Unit</p>
      </div>

      {/* Grid Unit */}
      <div className="grid grid-cols-1 gap-4">
        {filteredUnits.map(unit => {
          const content = (
            <>
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-white/5 shrink-0 shadow-inner relative">
                {/* Fallback pattern / gradient if image fails, but we have url */}
                <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-black/60 z-10 mix-blend-overlay"></div>
                <img src={unit.image} alt={unit.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${unit.statusColor}`}>
                    {unit.status}
                  </span>
                  {role === 'owner' && (
                    <div className="flex items-center space-x-1.5 opacity-80">
                      <button 
                        onClick={(e) => { e.preventDefault(); router.push(`/dashboard/unit/${unit.id}/edit`); }}
                        className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs hover:bg-playbox-accent hover:text-white transition-colors"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={async (e) => { 
                          e.preventDefault(); 
                          if(confirm(`Yakin ingin menghapus unit "${unit.name}"?`)) {
                            try {
                              if (unit.id) {
                                await deleteDoc(doc(db, 'stores', getStoreId(), 'units', unit.id));
                              }
                            } catch (err) {
                              console.error('Error deleting unit from Firestore:', err);
                            }
                            const newUnits = units.filter(x => x.id !== unit.id);
                            setUnits(newUnits);
                            localStorage.setItem('playbox_mock_units', JSON.stringify(newUnits));
                          }
                        }}
                        className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs hover:bg-red-500 hover:text-white transition-colors"
                        title="Hapus"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              <h3 className="font-bold text-base truncate mt-1.5 text-white/90">{unit.name}</h3>
              <p className="text-[11px] text-playbox-text-secondary mt-0.5">{unit.type}</p>
              {(unit.specs?.length > 0 || unit.games?.length > 0) && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {unit.specs?.map((spec: string, idx: number) => (
                    <span key={`s-${idx}`} className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/70 border border-white/5">
                      {spec}
                    </span>
                  ))}
                  {unit.games?.slice(0, 3).map((game: string, idx: number) => (
                    <span key={`g-${idx}`} className="text-[9px] px-1.5 py-0.5 rounded bg-playbox-accent/10 text-playbox-accent border border-playbox-accent/20">
                      {game}
                    </span>
                  ))}
                  {unit.games?.length > 3 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/5">
                      + {unit.games.length - 3} lainnya
                    </span>
                  )}
                </div>
              )}

              {unit.nextBooking && (
                <div className="mt-3 bg-yellow-500/10 border border-yellow-500/20 p-2.5 rounded-xl flex items-start gap-2 shadow-inner">
                  <span className="text-yellow-500 text-xs shrink-0 mt-0.5">⚠️</span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider mb-0.5">Akan Disewa: {unit.nextBooking.customer}</p>
                    <p className="text-[10px] font-medium text-yellow-500/80 truncate">
                      🗓️ {new Date(unit.nextBooking.isoStart || unit.nextBooking.startTime).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} WIB 
                      <span className="opacity-70 ml-1">
                        (Selama {formatSmartDuration(Number(unit.nextBooking.durationHours || unit.nextBooking.duration || 24))})
                      </span>
                    </p>
                  </div>
                </div>
              )}
              
              <div className="flex justify-between items-end mt-3">
                <p className="text-sm font-semibold tracking-tight">
                  {unit.priceTiers && unit.priceTiers.length > 0 ? (
                    <>
                      Rp {(unit.priceTiers[0].price || 0).toLocaleString('id-ID')} <span className="text-[10px] font-normal text-playbox-text-secondary">/ {unit.priceTiers[0].durationVal} {unit.priceTiers[0].durationUnit}</span>
                    </>
                  ) : (
                    <>
                      Rp {(unit.price || 0).toLocaleString('id-ID')} <span className="text-[10px] font-normal text-playbox-text-secondary">/ 24j</span>
                    </>
                  )}
                </p>
              </div>
              </div>
            </>
          );

          if (role === 'owner') {
            return (
              <Link href={`/dashboard/unit/${unit.id}`} key={unit.id} className="glass-surface p-4 rounded-3xl flex items-center space-x-4 group hover:bg-white/5 transition-all duration-300 active:scale-[0.98]">
                {content}
              </Link>
            );
          } else {
            return (
              <div key={unit.id} className="glass-surface p-4 rounded-3xl flex items-center space-x-4 group">
                {content}
              </div>
            );
          }
        })}

        {filteredUnits.length === 0 && (
          <div className="text-center py-16 text-playbox-text-secondary glass-surface rounded-3xl">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 mx-auto">
              <span className="text-2xl opacity-50">🎮</span>
            </div>
            <p className="text-sm font-medium">Tidak ada unit di kategori ini.</p>
          </div>
        )}
      </div>
    </div>
  );
}
