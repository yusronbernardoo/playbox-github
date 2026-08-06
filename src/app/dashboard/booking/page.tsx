'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore';

export default function BookingList() {
  const [filter, setFilter] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const filters = ['Semua', 'Perlu Verifikasi', 'Aktif', 'Selesai'];

  const [bookings, setBookings] = useState<any[]>([]);
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    setNow(Date.now());

    const params = new URLSearchParams(window.location.search);
    const filterParam = params.get('filter');
    if (filterParam && filters.includes(filterParam)) {
      setFilter(filterParam);
    }

    // 1. Real-Time Cloud Firestore Listener
    const unsubscribe = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      if (!snapshot.empty) {
        const cloudBookings: any[] = [];
        snapshot.forEach((docSnap) => {
          cloudBookings.push({ ...docSnap.data(), id: docSnap.id });
        });
        
        // Sort descending by id/createdAt
        cloudBookings.sort((a, b) => (b.createdAt || b.id).localeCompare(a.createdAt || a.id));
        setBookings(cloudBookings);
        localStorage.setItem('playbox_mock_bookings', JSON.stringify(cloudBookings));
      } else {
        const saved = localStorage.getItem('playbox_mock_bookings');
        if (saved) {
          try {
            setBookings(JSON.parse(saved));
          } catch {
            setBookings([]);
          }
        }
      }
    }, (error) => {
      console.warn('Firestore real-time error (fallback to local):', error);
      const saved = localStorage.getItem('playbox_mock_bookings');
      if (saved) setBookings(JSON.parse(saved));
    });

    // Live countdown timer (tick every 10 seconds for smoothness)
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 10000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleReject = async (id: string) => {
    const confirmReject = window.confirm("Yakin ingin menolak dan membatalkan booking ini?");
    if (!confirmReject) return;

    try {
      await deleteDoc(doc(db, 'bookings', id));
    } catch (err) {
      console.error('Error deleting from firestore:', err);
    }
    const updated = bookings.filter(b => b.id !== id);
    setBookings(updated);
    localStorage.setItem('playbox_mock_bookings', JSON.stringify(updated));
  };

  const formatCustomDate = (dateVal?: string) => {
    if (!dateVal) return '-';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return dateVal;
      return d.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(/\./g, ':');
    } catch {
      return dateVal;
    }
  };

  const getComputedDates = (booking: any) => {
    let startStr = booking.startTime || booking.isoStart;
    let endStr = booking.endTime || booking.isoEnd;
    const durHours = Number(booking.durationHours || booking.duration || 24);

    if (!startStr && booking.date) {
      startStr = `${booking.date}T10:00:00`;
    }

    if (startStr && !endStr) {
      const sDate = new Date(startStr);
      if (!isNaN(sDate.getTime())) {
        endStr = new Date(sDate.getTime() + durHours * 60 * 60 * 1000).toISOString();
      }
    }

    return {
      formattedStart: formatCustomDate(startStr) || booking.time || '-',
      formattedEnd: formatCustomDate(endStr) || `+${durHours} Jam`,
      rawEnd: endStr
    };
  };

  const filteredBookings = bookings.filter(b => {
    const matchFilter = filter === 'Semua' 
      ? true 
      : filter === 'Aktif' 
        ? b.status === 'Sedang Dipakai' || b.status === 'Diantar'
        : b.status === filter;
    
    const matchSearch = b.customer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        b.code?.toLowerCase().includes(searchQuery.toLowerCase());
                        
    return matchFilter && matchSearch;
  });

  return (
    <div className="p-4 space-y-6 pb-28 h-full">
      {/* Header */}
      <div className="flex justify-between items-center mt-2">
        <h1 className="text-2xl font-bold tracking-tight">Booking</h1>
        <Link href="/dashboard/booking/new" className="saas-button px-4 py-2 rounded-xl text-sm flex items-center shadow-sm hover:shadow-[0_4px_15px_rgba(226,23,142,0.5)] transition-all">
          <span className="mr-1 text-lg font-light leading-none">+</span> Catat Manual
        </Link>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <input 
          type="text" 
          placeholder="Cari nama pelanggan atau invoice..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-10 text-sm text-white placeholder-white/40 focus:outline-none focus:border-playbox-accent transition-colors"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">🔍</span>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide mask-edges">
        {filters.map(f => (
          <button 
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
              filter === f 
                ? 'bg-white text-black shadow-[0_4px_15px_rgba(255,255,255,0.2)]' 
                : 'glass-surface text-playbox-text-secondary hover:text-white hover:bg-white/5'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-4">
        {filteredBookings.map(booking => {
          const { formattedStart, formattedEnd, rawEnd } = getComputedDates(booking);
          const durHours = Number(booking.durationHours || booking.duration || 24);

          // Timer calculation
          let timerBadge = null;
          if (rawEnd && booking.status !== 'Selesai' && booking.status !== 'Perlu Verifikasi') {
            const endMs = new Date(rawEnd).getTime();
            const diff = endMs - now;
            if (diff <= 0) {
              const lateHours = Math.max(1, Math.ceil(Math.abs(diff) / (1000 * 60 * 60)));
              timerBadge = (
                <span className="bg-red-500 text-white text-[9px] px-2.5 py-0.5 rounded-full font-bold shadow-[0_2px_10px_rgba(239,68,68,0.6)] animate-pulse">
                  🚨 Telat {lateHours} Jam!
                </span>
              );
            } else {
              const h = Math.floor(diff / (1000 * 60 * 60));
              const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
              timerBadge = (
                <span className="bg-playbox-accent text-white text-[9px] px-2.5 py-0.5 rounded-full font-bold shadow-[0_2px_10px_rgba(226,23,142,0.6)]">
                  ⏱️ Sisa: {h} Jam {m} Mnt
                </span>
              );
            }
          }

          return (
            <div key={booking.id} className="glass-surface rounded-3xl p-5 flex flex-col group hover:bg-white/5 transition-all duration-300 relative overflow-hidden border border-white/10">
              {booking.needAction && (
                <div className="absolute top-0 left-0 w-1.5 h-full bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.8)]"></div>
              )}
              
              <div className="flex justify-between items-start gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-playbox-accent mb-1 tracking-wider">{booking.code}</p>
                  <h3 className="font-bold text-lg tracking-tight text-white/90 truncate" title={booking.customer}>{booking.customer}</h3>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full inline-block mb-1 ${booking.statusColor}`}>
                    {booking.status}
                  </span>
                  <p className="text-sm font-black text-playbox-ready whitespace-nowrap">Rp {Number(booking.totalPrice || 0).toLocaleString('id-ID')}</p>
                </div>
              </div>
              
              <div className="text-sm text-playbox-text-secondary mb-4 space-y-3">
                <div className="flex justify-between items-center gap-2">
                  <p className="flex items-center text-white/90 font-bold min-w-0 flex-1 truncate">
                    <span className="w-2 h-2 rounded-full bg-playbox-accent mr-2 shrink-0"></span> <span className="truncate">{booking.unit}</span>
                  </p>
                  <span className="text-xs font-semibold text-white/60 shrink-0 whitespace-nowrap">
                    {durHours === 168 ? '1 Minggu' : durHours >= 24 ? `${durHours/24} Hari` : `${durHours} Jam`}
                  </span>
                </div>
                
                {/* Clean Date Box with Time and Automatic Live Countdown */}
                <div className="bg-black/30 p-3.5 rounded-2xl border border-white/5 flex flex-col space-y-2 relative">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex-1">
                      <p className="text-[9px] uppercase tracking-wider text-white/40 font-bold mb-0.5">Mulai Sewa</p>
                      <p className="font-semibold text-white/90">{formattedStart}</p>
                    </div>
                    <div className="px-2 text-white/30">➔</div>
                    <div className="flex-1 text-right">
                      <p className="text-[9px] uppercase tracking-wider text-white/40 font-bold mb-0.5">Akhir Sewa</p>
                      <p className="font-semibold text-white/90">{formattedEnd}</p>
                    </div>
                  </div>

                  {timerBadge && (
                    <div className="pt-2 border-t border-white/5 flex justify-end">
                      {timerBadge}
                    </div>
                  )}
                </div>
                
                <div className="pt-1 flex flex-col space-y-1.5 border-t border-white/5">
                  <p className="flex items-center text-xs text-white/70 min-w-0"><span className="opacity-60 mr-2 shrink-0">📞</span> <span className="truncate flex-1">{booking.customerPhone || '-'}</span></p>
                  <p className="flex items-start text-xs text-white/70 min-w-0"><span className="opacity-60 mr-2 shrink-0 mt-0.5">🛵</span> <span className="flex-1 leading-snug truncate">{booking.requireDelivery ? `Diantar: ${booking.deliveryAddress || booking.address || '-'}` : 'Ambil di Toko (Mandiri)'}</span></p>
                </div>
              </div>

              {booking.needAction ? (
                <div className="flex space-x-3 border-t border-white/10 pt-4">
                  <Link 
                    href={`/dashboard/booking/${booking.id}/verify`} 
                    className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold text-sm rounded-xl flex items-center justify-center shadow-[0_4px_15px_rgba(234,179,8,0.4)] transition-all active:scale-95"
                  >
                    <span>⚡ Verifikasi Pesanan</span>
                  </Link>
                  <button 
                    onClick={() => handleReject(booking.id)} 
                    className="px-4 py-3 bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-sm rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-95"
                  >
                    Tolak
                  </button>
                </div>
              ) : (
                <div className="flex justify-end border-t border-white/5 pt-3">
                  <Link href={`/dashboard/booking/${booking.id}/timeline`} className="text-xs font-bold text-playbox-accent hover:text-playbox-accent-hover transition-colors flex items-center group-hover:translate-x-1 duration-200">
                    Lihat Detail & Timeline <span className="ml-1 opacity-60">→</span>
                  </Link>
                </div>
              )}
            </div>
          );
        })}
        
        {filteredBookings.length === 0 && (
          <div className="text-center py-16 text-playbox-text-secondary flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <span className="text-2xl opacity-50">📋</span>
            </div>
            <p className="text-sm font-medium">Tidak ada data booking.</p>
          </div>
        )}
      </div>
    </div>
  );
}
