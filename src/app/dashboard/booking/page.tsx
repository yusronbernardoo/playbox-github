'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { useFirebase } from '@/context/FirebaseContext';

export default function BookingList() {
  const { bookings } = useFirebase();
  const [filter, setFilter] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const filters = ['Semua', 'Perlu Verifikasi', 'Aktif', 'Selesai'];

  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    setNow(Date.now());

    const params = new URLSearchParams(window.location.search);
    const filterParam = params.get('filter');
    if (filterParam && filters.includes(filterParam)) {
      setFilter(filterParam);
    }

    // Live countdown timer (tick every 10 seconds for smoothness)
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 10000);

    return () => {
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
        <Link href="/dashboard/booking/new" className="saas-button px-4 py-2 rounded-xl text-sm flex items-center shadow-sm hover:shadow-[0_4px_15px_rgba(37,99,235,0.5)] transition-all">
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
                <span className="bg-playbox-accent text-white text-[9px] px-2.5 py-0.5 rounded-full font-bold shadow-[0_2px_10px_rgba(37,99,235,0.6)]">
                  ⏱️ Sisa: {h} Jam {m} Mnt
                </span>
              );
            }
          }
               const getBadgeStyle = (status: string) => {
        if (status === 'Selesai') return 'bg-playbox-ready/10 text-playbox-ready border border-playbox-ready/20';
        if (status === 'Sedang Dipakai' || status === 'Diantar') return 'bg-playbox-disewa/10 text-playbox-disewa border border-playbox-disewa/20';
        if (status === 'Dibatalkan') return 'bg-red-500/10 text-red-500 border border-red-500/20';
        if (status === 'Perlu Verifikasi' || status === 'Menunggu Pembayaran') return 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20';
        return 'bg-blue-500/10 text-blue-500 border border-blue-500/20'; // default/Persiapan
      };

      return (
        <div key={booking.id} className="glass-surface p-4 rounded-3xl relative overflow-hidden group hover:bg-white/5 transition-all duration-300">
          <Link href={booking.needAction ? `/dashboard/booking/${booking.id}/verify` : `/dashboard/booking/${booking.id}/timeline`} className="absolute inset-0 z-0"></Link>
          
          <div className="relative z-10 pointer-events-none">
            {booking.needAction && (
              <div className="absolute top-0 left-0 w-1.5 h-full bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.8)]"></div>
            )}
            
            <div className="flex justify-between items-start gap-3 mb-3 pointer-events-auto">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-playbox-accent mb-1 tracking-wider">{booking.code}</p>
                <h3 className="font-bold text-lg tracking-tight text-white/90 truncate" title={booking.customer}>{booking.customer}</h3>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-[10px] font-bold px-3 py-1 rounded-full inline-block mb-1 ${getBadgeStyle(booking.status)}`}>
                  {booking.status}
                </span>
                <p className="text-sm font-black text-playbox-ready whitespace-nowrap">Rp {Number(booking.totalPrice || 0).toLocaleString('id-ID')}</p>
              </div>
            </div>
            
            <div className="text-sm text-playbox-text-secondary mb-4 space-y-3 pointer-events-auto">
              <div className="flex justify-between items-center gap-2">
                <p className="flex items-center text-white/90 font-bold min-w-0 flex-1 truncate">
                  <span className="w-2 h-2 rounded-full bg-playbox-accent mr-2 shrink-0"></span> <span className="truncate">{booking.unit}</span>
                </p>
                <p className="text-xs font-medium text-white/50 shrink-0">{durHours} Jam</p>
              </div>

              <div className="bg-black/40 p-3 rounded-2xl border border-white/5 shadow-inner">
                <div className="flex justify-between items-center text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1.5 px-1">
                  <span>Mulai Sewa</span>
                  <span className="opacity-50 text-playbox-accent">&rarr;</span>
                  <span>Akhir Sewa</span>
                </div>
                <div className="flex justify-between items-center text-xs font-medium text-white/80 px-1">
                  <span>{formattedStart}</span>
                  <span>{formattedEnd}</span>
                </div>
                
                {timerBadge && (
                  <div className="mt-3 flex justify-end">
                    {timerBadge}
                  </div>
                )}
              </div>
              
              <div className="pt-1 flex flex-col space-y-1.5 border-t border-white/5">
                <p className="flex items-center text-xs text-white/70 min-w-0">
                  <svg className="w-3.5 h-3.5 opacity-60 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                  <span className="truncate flex-1">{booking.customerPhone || '-'}</span>
                </p>
                <p className="flex items-start text-xs text-white/70 min-w-0">
                  <svg className="w-3.5 h-3.5 opacity-60 mr-2 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                  <span className="flex-1 leading-snug truncate">{booking.requireDelivery ? `Diantar: ${booking.deliveryAddress || booking.address || '-'}` : 'Ambil di Toko (Mandiri)'}</span>
                </p>
              </div>
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
