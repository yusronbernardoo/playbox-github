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
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    // Client-side initialization
    setNow(new Date().getTime());

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
        // Jika cloud kosong, fallback ke localStorage
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

    // Live timer
    const interval = setInterval(() => {
      setNow(new Date().getTime());
    }, 60000); // update every minute

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleReject = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'bookings', id));
    } catch (err) {
      console.error('Error deleting from firestore:', err);
    }
    const updated = bookings.filter(b => b.id !== id);
    setBookings(updated);
    localStorage.setItem('playbox_mock_bookings', JSON.stringify(updated));
  };

  const filteredBookings = bookings.filter(b => {
    const matchFilter = filter === 'Semua' 
      ? true 
      : filter === 'Aktif' 
        ? b.status === 'Sedang Dipakai' 
        : b.status === filter;
    
    const matchSearch = b.customer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        b.code?.toLowerCase().includes(searchQuery.toLowerCase());
                        
    return matchFilter && matchSearch;
  });

  return (
    <div className="p-4 space-y-6 pb-24 h-full">
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

      {/* List */}
      <div className="space-y-4">
        {filteredBookings.map(booking => (
          <div key={booking.id} className="glass-surface rounded-2xl p-5 flex flex-col group hover:bg-white/5 transition-all duration-300 relative overflow-hidden">
            {booking.needAction && (
              <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.8)]"></div>
            )}
            
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-[11px] font-medium text-playbox-text-secondary mb-1 tracking-wider">{booking.code}</p>
                <h3 className="font-bold text-lg tracking-tight text-white/90">{booking.customer}</h3>
              </div>
              <div className="text-right">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full inline-block mb-1 ${booking.statusColor}`}>
                  {booking.status}
                </span>
                <p className="text-sm font-bold text-playbox-ready">Rp {Number(booking.totalPrice || 0).toLocaleString('id-ID')}</p>
              </div>
            </div>
            
            <div className="text-sm text-playbox-text-secondary mb-5 space-y-3">
              <p className="flex items-center text-white/90 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-playbox-accent mr-2"></span> {booking.unit}</p>
              
              {/* Compact Date Box */}
              <div className="bg-black/20 p-3 rounded-xl border border-white/5 flex justify-between items-center relative">
                <div className="flex items-center space-x-3 text-[11px]">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-white/40 mb-0.5">Mulai Sewa</p>
                    <p className="font-semibold text-white/80">
                      {(booking.startTime || booking.isoStart)
                        ? new Date(booking.startTime || booking.isoStart).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).replace(/\./g, ':') 
                        : (booking.startDate || booking.time || '-')}
                    </p>
                  </div>
                  <span className="text-white/20">➔</span>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-white/40 mb-0.5">Akhir Sewa</p>
                    <p className="font-semibold text-white/80">
                      {(booking.endTime || booking.isoEnd)
                        ? new Date(booking.endTime || booking.isoEnd).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).replace(/\./g, ':')
                        : (booking.endDate || `+${booking.durationHours || 24} Jam`)}
                    </p>
                  </div>
                </div>

                {(booking.endTime || booking.isoEnd) && booking.status !== 'Selesai' && booking.status !== 'Perlu Verifikasi' && (
                  <span className="absolute -top-2 -right-2 bg-playbox-accent text-white text-[9px] px-2 py-0.5 rounded-full font-bold shadow-[0_2px_10px_rgba(226,23,142,0.6)] animate-pulse">
                    Sisa: {
                      (() => {
                        const end = new Date(booking.endTime || booking.isoEnd).getTime();
                        const diff = end - now;
                        if (diff <= 0) return 'Habis';
                        const h = Math.floor(diff / (1000*60*60));
                        const m = Math.floor((diff % (1000*60*60)) / (1000*60));
                        return `${h}j ${m}m`;
                      })()
                    }
                  </span>
                )}
              </div>
              
              <div className="pt-1 flex flex-col space-y-1.5 border-t border-white/5 mt-3">
                <p className="flex items-center text-xs mt-2"><span className="opacity-50 mr-2">📞</span> {booking.customerPhone || '-'}</p>
                <p className="flex items-start text-xs mt-1"><span className="opacity-50 mr-2">📍</span> <span className="flex-1 leading-snug">{booking.requireDelivery ? booking.deliveryAddress : 'Ambil di Toko'}</span></p>
              </div>
            </div>

            {booking.needAction ? (
              <div className="flex space-x-3 border-t border-white/5 pt-4">
                <Link href={`/dashboard/booking/${booking.id}/verify`} className="flex-1 py-2.5 bg-playbox-ready text-white font-medium text-sm rounded-xl hover:bg-opacity-90 flex items-center justify-center shadow-[0_4px_15px_rgba(35,197,82,0.3)] transition-all active:scale-95">
                  {booking.status === 'Menunggu Pembayaran' ? 'Cek Pembayaran' : 'Terima & Verifikasi'}
                </Link>
                <button onClick={() => handleReject(booking.id)} className="flex-1 py-2.5 bg-white/5 border border-white/5 text-white/70 font-medium text-sm rounded-xl hover:bg-red-500 hover:text-white hover:border-red-500 transition-all active:scale-95">
                  Tolak
                </button>
              </div>
            ) : (
              <div className="flex justify-end border-t border-white/5 pt-4">
                <Link href={`/dashboard/booking/${booking.id}/timeline`} className="text-sm font-semibold text-playbox-accent hover:text-playbox-accent-hover transition-colors flex items-center group-hover:translate-x-1 duration-200">
                  Lihat Detail & Timeline <span className="ml-1 opacity-50">→</span>
                </Link>
              </div>
            )}
          </div>
        ))}
        
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
