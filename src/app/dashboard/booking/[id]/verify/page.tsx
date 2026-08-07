'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { formatSmartCountdown, formatSmartDuration } from '@/lib/format';

export default function VerifyBooking({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;

  const [booking, setBooking] = useState<any>(null);
  const [distance, setDistance] = useState<string>('');
  const [calculatedOngkir, setCalculatedOngkir] = useState<number>(0);
  const [deliveryRules, setDeliveryRules] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [timeLabel, setTimeLabel] = useState<string>('Sisa Waktu');
  const [businessName, setBusinessName] = useState('PLAYBOX');
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  
  // Lightbox Modal
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopyText = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  useEffect(() => {
    // 1. Real-time Firestore Document Listener
    const unsubscribe = onSnapshot(doc(db, 'bookings', id), (docSnap) => {
      if (docSnap.exists()) {
        const data: any = { ...docSnap.data(), id: docSnap.id };
        setBooking(data);
        if (data.deliveryFee) {
          setCalculatedOngkir(data.deliveryFee);
        }
      } else {
        loadBookingLocal();
      }
    }, (err) => {
      console.warn('Firestore doc listener fallback:', err);
      loadBookingLocal();
    });

    // 2. Real-time Shop Settings Listener
    const unsubscribeShop = onSnapshot(doc(db, 'settings', 'shop'), (snap) => {
      if (snap.exists()) {
        const s = snap.data();
        if (s.brandName) setBusinessName(s.brandName);
      } else {
        const saved = localStorage.getItem('playbox_shop_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.brandName) setBusinessName(parsed.brandName);
        }
      }
    });

    // Load Ongkir Rules
    const savedRules = localStorage.getItem('playbox_delivery_rules');
    if (savedRules) {
      setDeliveryRules(JSON.parse(savedRules));
    } else {
      setDeliveryRules([
        { minKm: 0, maxKm: 5, fee: 0 },
        { minKm: 6, maxKm: 10, fee: 10000 },
        { minKm: 11, maxKm: 15, fee: 20000 },
        { minKm: 16, maxKm: 999, fee: 50000 }
      ]);
    }

    // Load Payment Methods
    const savedPayments = localStorage.getItem('playbox_payments');
    if (savedPayments) {
      const parsed = JSON.parse(savedPayments);
      setPaymentMethods(parsed.filter((p: any) => p.active));
    }

    return () => {
      unsubscribe();
      unsubscribeShop();
    };
  }, [id]);

  const loadBookingLocal = () => {
    const savedBookings = localStorage.getItem('playbox_mock_bookings');
    if (savedBookings) {
      const parsed = JSON.parse(savedBookings);
      const found = parsed.find((b: any) => b.id === id);
      if (found) {
        setBooking(found);
        if (found.deliveryFee) {
          setCalculatedOngkir(found.deliveryFee);
        }
      }
    }
  };

  useEffect(() => {
    if (booking && booking.status === 'Perlu Verifikasi') {
      if (distance && deliveryRules.length > 0) {
        const dist = parseFloat(distance);
        const rule = deliveryRules.find(r => dist >= r.minKm && dist <= r.maxKm);
        if (rule) {
          setCalculatedOngkir(rule.fee);
        } else {
          const highest = [...deliveryRules].sort((a, b) => b.fee - a.fee)[0];
          setCalculatedOngkir(highest ? highest.fee : 0);
        }
      } else {
        setCalculatedOngkir(0);
      }
    }
  }, [distance, deliveryRules, booking]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const endStr = booking?.endTime || booking?.isoEnd;
    if (endStr) {
      const calculateTimeLeft = () => {
        const end = new Date(endStr).getTime();
        const startMs = booking?.isoStart ? new Date(booking.isoStart).getTime() : 
                       (booking?.startTime ? new Date(`${booking.startDate || ''} ${booking.startTime}`).getTime() : 0);
        const now = new Date().getTime();
        
        if (startMs && now < startMs) {
          const diffToStart = startMs - now;
          setTimeLabel('Mulai Dalam');
          setTimeLeft(formatSmartCountdown(diffToStart).replace('J ', ' Jam ').replace('M', ' Menit'));
        } else {
          const diff = end - now;
          if (diff <= 0) {
            setTimeLabel('Sisa Waktu');
            setTimeLeft('Waktu Habis');
            return;
          }
          setTimeLabel('Sisa Waktu');
          setTimeLeft(formatSmartCountdown(diff).replace('J ', ' Jam ').replace('M', ' Menit'));
        }
      };

      calculateTimeLeft();
      interval = setInterval(calculateTimeLeft, 60000);
    }
    return () => clearInterval(interval);
  }, [booking?.endTime, booking?.isoEnd]);

  const handleUpdateStatus = async (newStatus: string, color: string, extraData: any = {}) => {
    const updatePayload = {
      status: newStatus,
      statusColor: color,
      needAction: newStatus === 'Menunggu Pembayaran',
      ...extraData
    };

    // 1. Sync ke Cloud Firestore
    try {
      await updateDoc(doc(db, 'bookings', id), updatePayload);
    } catch (err) {
      console.error('Failed to update status in Firestore:', err);
    }

    // 2. Sync ke localStorage
    const saved = localStorage.getItem('playbox_mock_bookings');
    if (saved) {
      const bookings = JSON.parse(saved);
      const updated = bookings.map((b: any) => {
        if (b.id === id) {
          return {
            ...b,
            ...updatePayload
          };
        }
        return b;
      });
      localStorage.setItem('playbox_mock_bookings', JSON.stringify(updated));
      setBooking((prev: any) => ({ ...prev, ...updatePayload }));
    }
  };

  const handleVerify = () => {
    if (booking?.requireDelivery && !distance) {
      alert('Mohon masukkan estimasi Jarak Pengiriman (Km) terlebih dahulu!');
      return;
    }

    handleUpdateStatus('Menunggu Pembayaran', 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20', {
      deliveryFee: calculatedOngkir,
      totalPrice: (Number(booking.unitPrice) || Number(booking.totalPrice) || 0) + calculatedOngkir,
      needAction: true
    });
  };

  const handleSendWA = () => {
    const phone = booking.customerPhone.startsWith('0') ? '62' + booking.customerPhone.slice(1) : booking.customerPhone;
    const durationText = (booking.durationHours || booking.duration) === 168 
      ? '1 Minggu' 
      : (booking.durationHours || booking.duration) >= 24 
        ? `${(booking.durationHours || booking.duration)/24} Hari` 
        : `${booking.durationHours || booking.duration || 24} Jam`;

    const bankInfo = paymentMethods.length > 0
      ? paymentMethods.map(p => `- ${p.name}: ${p.account} (a.n ${p.owner})`).join('\n')
      : '- Transfer Bank / Kasir Toko';

    const text = `Halo Kak ${booking.customer}!

Terima kasih telah memesan sewa di ${businessName}.
Pesanan Anda (*${booking.code}*) telah diverifikasi dan diterima.

Rincian Pesanan:
- Unit: ${booking.unit}
- Durasi: ${durationText}
- Pengiriman: ${booking.requireDelivery ? 'Antar - Jemput' : 'Ambil di Toko'}
- Total Tagihan: Rp ${(booking.totalPrice || 0).toLocaleString('id-ID')}

Silakan transfer pembayaran ke rekening berikut:
${bankInfo}

Mohon balas pesan ini dengan mengirimkan foto Bukti Transfer Anda. Terima kasih!`;
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleMarkAsPaid = async () => {
    const confirm = window.confirm('Apakah bukti transfer sudah valid dan uang sudah diterima?');
    if (confirm) {
      // 1. Update status booking menjadi Sedang Dipakai
      // Jangan timpa isoStart dan isoEnd jika customer sudah memilih jadwal di masa depan!
      const updateData: any = { 
        needAction: false,
        paymentStatus: 'Lunas'
      };

      if (!booking.isoStart) {
        // Fallback untuk data lama yang tidak punya isoStart
        const now = new Date();
        const dur = Number(booking.durationHours || booking.duration || 24);
        const endTime = new Date(now.getTime() + (dur * 60 * 60 * 1000));
        
        updateData.startTime = now.toISOString();
        updateData.endTime = endTime.toISOString();
        updateData.isoStart = now.toISOString();
        updateData.isoEnd = endTime.toISOString();
      }

      await handleUpdateStatus('Sedang Dipakai', 'bg-playbox-disewa/10 text-playbox-accent border border-playbox-disewa/20', updateData);
      
      // 2. Update status unit di katalog (Firestore & localStorage)
      // DIHAPUS: Kita tidak lagi memaksa status unit menjadi 'Disewa' di database.
      // Ketersediaan unit sekarang dihitung otomatis secara dinamis (real-time calendar) di halaman katalog.

      alert('Pesanan Lunas! Jadwal telah diamankan.');
      router.push('/dashboard/booking');
    }
  };

  const handleReject = async () => {
    const confirmReject = window.confirm("Yakin ingin menolak pesanan ini?");
    if (!confirmReject) return;

    try {
      await deleteDoc(doc(db, 'bookings', id));
    } catch (err) {
      console.error('Error deleting doc from firestore:', err);
    }

    const saved = localStorage.getItem('playbox_mock_bookings');
    if (saved) {
      const bookings = JSON.parse(saved);
      const updated = bookings.filter((b: any) => b.id !== id);
      localStorage.setItem('playbox_mock_bookings', JSON.stringify(updated));
    }
    
    router.push('/dashboard/booking');
  };

  if (!booking) {
    return (
      <div className="p-8 text-center text-white/50">
        <p>Memuat data pesanan...</p>
      </div>
    );
  }

  const ktpImage = booking.ktpPhoto || booking.ktpUrl || (booking.documents && booking.documents[0]?.file);
  const paymentProofImage = booking.paymentProof || booking.paymentProofUrl;
  const displayDuration = booking.durationHours || booking.duration || 24;
  const displayAddress = booking.deliveryAddress || booking.address || '-';
  const displayDate = booking.date || booking.startDate || (booking.startTime ? new Date(booking.startTime).toLocaleDateString('id-ID') : booking.time || '-');

  const startMs = booking?.isoStart ? new Date(booking.isoStart).getTime() : 
                 (booking?.startTime ? new Date(`${booking.startDate || ''} ${booking.startTime}`).getTime() : 0);
  
  let displayStatus = booking?.status || '';
  if (displayStatus === 'Sedang Dipakai' && startMs && new Date().getTime() < startMs) {
    displayStatus = 'Menunggu Hari H';
  }

  return (
    <div className="p-4 space-y-6 pb-36 relative">
      <div className="ambient-glow"></div>
      
      {/* Header */}
      <div className="flex items-center mt-2 mb-6">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl mr-4 hover:bg-white/10 transition-colors">
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Verifikasi Booking</h1>
          <p className="text-xs text-playbox-text-secondary mt-0.5">Kelola pesanan masuk & pembayaran</p>
        </div>
      </div>

      <div className="glass-surface-elevated p-6 rounded-3xl relative overflow-hidden border border-white/10">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-playbox-accent/10 rounded-full blur-3xl"></div>
        <div className="flex justify-between items-start mb-1">
          <h2 className="text-xs font-semibold text-playbox-text-secondary uppercase tracking-widest">Kode Invoice</h2>
          <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${displayStatus === 'Menunggu Hari H' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : booking.statusColor}`}>
            {displayStatus}
          </span>
        </div>
        <p className="font-bold text-2xl text-white tracking-tight">{booking.code}</p>
        
        <div className="mt-5 space-y-3 pt-5 border-t border-white/5">
          <div className="flex items-start">
            <span className="w-6 text-playbox-text-secondary">🎮</span>
            <div>
              <p className="text-sm font-semibold text-white">{booking.unit}</p>
            </div>
          </div>
          <div className="flex items-start">
            <span className="w-6 text-playbox-text-secondary">🕒</span>
            <div>
              <p className="text-sm font-semibold text-white">
                {displayDate} <span className="text-playbox-accent ml-1 font-bold">({formatSmartDuration(Number(displayDuration))})</span>
              </p>
            </div>
          </div>
          <div className="flex items-start">
            <span className="w-6 text-playbox-text-secondary">🛵</span>
            <div>
              <p className="text-sm font-semibold text-white">
                {booking.requireDelivery ? 'Antar - Jemput (+Ongkir)' : 'Ambil di Toko (Mandiri)'}
              </p>
            </div>
          </div>
        </div>

        {(booking.startTime || booking.isoStart) && (booking.endTime || booking.isoEnd) && (
          <div className="mt-4 flex flex-col space-y-2 mb-2">
            <div className="flex justify-between items-center p-4 bg-gradient-to-r from-playbox-accent/20 to-playbox-accent/5 border border-playbox-accent/30 rounded-2xl">
              <div>
                <p className="text-[10px] text-playbox-accent font-bold uppercase tracking-wider mb-1">Mulai Sewa</p>
                <p className="text-sm font-bold text-white">{new Date(booking.startTime || booking.isoStart).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-playbox-accent font-bold uppercase tracking-wider mb-1">Akhir Sewa</p>
                <p className="text-sm font-bold text-white">{new Date(booking.endTime || booking.isoEnd).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>
            </div>
            {booking.status === 'Selesai' ? (
              <div className="flex justify-between items-center px-4 py-3 bg-playbox-ready/10 border border-playbox-ready/20 rounded-2xl">
                <span className="text-xs font-bold text-playbox-ready uppercase tracking-wider">Status Waktu</span>
                <span className="text-sm font-black text-playbox-ready">SELESAI ✔️</span>
              </div>
              ) : (
                <div className="flex justify-between items-center px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl">
                  <span className="text-xs font-bold text-yellow-500/90 uppercase tracking-wider">{timeLabel}</span>
                  <span className="text-sm font-black text-yellow-500 animate-pulse drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">{timeLeft || 'Menghitung...'}</span>
                </div>
              )}
          </div>
        )}
      </div>

      <div className="glass-surface p-5 rounded-3xl space-y-4 border border-white/5">
        <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest">Data Customer</h2>
        
        {/* Nama Lengkap */}
        <div className="bg-black/25 p-3 rounded-2xl border border-white/5">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-medium text-playbox-text-secondary">Nama Lengkap</span>
            {copiedField === 'name' && <span className="text-[10px] text-[#25D366] font-bold animate-pulse">Tersalin!</span>}
          </div>
          <div className="flex items-center justify-between gap-2 min-w-0">
            <p className="font-bold text-sm text-white/95 truncate min-w-0 flex-1">{booking.customer || '-'}</p>
            <button 
              type="button"
              onClick={() => handleCopyText(booking.customer, 'name')}
              title="Salin Nama"
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs shrink-0 transition-colors"
            >
              📋 Salin
            </button>
          </div>
        </div>

        {/* Nomor WhatsApp */}
        <div className="bg-black/25 p-3 rounded-2xl border border-white/5">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-medium text-playbox-text-secondary">Nomor WhatsApp</span>
            {copiedField === 'phone' && <span className="text-[10px] text-[#25D366] font-bold animate-pulse">Tersalin!</span>}
          </div>
          <div className="flex items-center justify-between gap-2 min-w-0">
            <p className="font-bold text-sm text-white/95 truncate min-w-0 flex-1">{booking.customerPhone || '-'}</p>
            <div className="flex items-center space-x-1.5 shrink-0">
              {booking.customerPhone && (
                <a 
                  href={`https://wa.me/${booking.customerPhone.replace(/\D/g, '').startsWith('0') ? '62' + booking.customerPhone.replace(/\D/g, '').slice(1) : booking.customerPhone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] border border-[#25D366]/30 text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <span>💬</span> WA
                </a>
              )}
              <button 
                type="button"
                onClick={() => handleCopyText(booking.customerPhone, 'phone')}
                title="Salin Nomor"
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-colors"
              >
                📋
              </button>
            </div>
          </div>
        </div>

        {/* Alamat Domisili / Pengiriman */}
        <div className="bg-black/25 p-3 rounded-2xl border border-white/5">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-medium text-playbox-text-secondary">Alamat Domisili / Pengiriman</span>
            {copiedField === 'address' && <span className="text-[10px] text-[#25D366] font-bold animate-pulse">Tersalin!</span>}
          </div>
          <div className="flex items-center justify-between gap-2 min-w-0">
            <p className="font-semibold text-sm text-white/90 truncate min-w-0 flex-1">{displayAddress || '-'}</p>
            <button 
              type="button"
              onClick={() => handleCopyText(displayAddress, 'address')}
              title="Salin Alamat"
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs shrink-0 transition-colors"
            >
              📋 Salin
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs text-playbox-text-secondary mb-2">Foto KTP / Identitas Jaminan</p>
          {ktpImage ? (
            <div 
              onClick={() => setZoomImage(ktpImage)}
              className="w-full h-44 bg-black/40 rounded-2xl border border-white/10 overflow-hidden cursor-zoom-in relative group"
            >
              <img src={ktpImage} alt="KTP" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white bg-black/70 px-4 py-2 rounded-full text-xs font-bold backdrop-blur-md shadow-lg">🔍 Klik untuk Zoom</span>
              </div>
            </div>
          ) : (
            <div className="w-full h-32 bg-red-500/10 rounded-2xl border border-red-500/20 flex flex-col items-center justify-center text-red-400">
              <span className="text-2xl mb-1">⚠️</span>
              <span className="text-xs font-medium">Tidak ada foto KTP</span>
            </div>
          )}
        </div>

        {/* Bukti Transfer */}
        <div>
          <p className="text-xs text-playbox-text-secondary mb-2">Foto Bukti Transfer (Jika Ada)</p>
          {paymentProofImage ? (
            <div 
              onClick={() => setZoomImage(paymentProofImage)}
              className="w-full h-44 bg-black/40 rounded-2xl border border-white/10 overflow-hidden cursor-zoom-in relative group"
            >
              <img src={paymentProofImage} alt="Bukti Transfer" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white bg-black/70 px-4 py-2 rounded-full text-xs font-bold backdrop-blur-md shadow-lg">🔍 Klik untuk Zoom</span>
              </div>
            </div>
          ) : (
            <div className="w-full h-24 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-white/40">
              <span className="text-xl mb-0.5">📄</span>
              <span className="text-xs font-medium">Belum ada bukti transfer</span>
            </div>
          )}
        </div>
      </div>

      {booking.status === 'Perlu Verifikasi' && booking.requireDelivery && (
        <div className="glass-surface p-5 rounded-3xl space-y-4 border border-playbox-accent/30 bg-playbox-accent/5">
          <h2 className="text-xs font-bold text-playbox-accent uppercase tracking-widest flex items-center">
            <span className="mr-2 text-lg">🛵</span> Hitung Ongkir Pengiriman
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-white/70 mb-2">Jarak Rumah Pelanggan ke Toko (Km)</label>
              <input 
                type="number"
                value={distance}
                onChange={e => setDistance(e.target.value)}
                placeholder="Misal: 8"
                className="w-full p-4 rounded-xl bg-black/40 border border-playbox-accent/50 text-white text-lg font-bold focus:outline-none focus:border-playbox-accent"
              />
              <p className="text-[10px] text-white/40 mt-2 italic">*Cek jarak di Google Maps berdasarkan alamat pelanggan di atas.</p>
            </div>

            <div className="bg-black/30 p-4 rounded-xl flex justify-between items-center border border-white/5">
              <span className="text-sm text-white/70">Tarif Ongkir Terhitung:</span>
              <span className="text-lg font-bold text-white">Rp {calculatedOngkir.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Rincian Tagihan & Kirim Tagihan */}
      {booking.status !== 'Perlu Verifikasi' && (
        <div className="glass-surface p-6 rounded-3xl space-y-5 border border-yellow-500/20 bg-yellow-500/5 mt-6">
          <h2 className="text-xs font-bold text-yellow-400 uppercase tracking-widest flex items-center">
            <span className="mr-2 text-lg">💳</span> Rincian Tagihan
          </h2>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm text-white/70">
              <span>Sewa Unit ({displayDuration} Jam)</span>
              <span>Rp {((booking.totalPrice || 0) - (booking.deliveryFee || 0)).toLocaleString('id-ID')}</span>
            </div>
            {booking.requireDelivery && (
              <div className="flex justify-between items-center text-sm text-white/70">
                <span>Ongkir Pengiriman</span>
                <span>Rp {(booking.deliveryFee || 0).toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="pt-3 border-t border-white/10 flex justify-between items-center">
              <span className="font-bold text-white">Total Tagihan</span>
              <span className="text-xl font-black text-yellow-400">Rp {(booking.totalPrice || 0).toLocaleString('id-ID')}</span>
            </div>
          </div>

          <button 
            onClick={handleSendWA}
            className="w-full py-4 bg-[#25D366] text-black font-bold rounded-2xl shadow-[0_4px_20px_rgba(37,211,102,0.4)] hover:bg-[#20bd5a] transition-all active:scale-95 text-sm flex items-center justify-center mt-4"
          >
            <span className="mr-2 text-lg">💬</span> Kirim Tagihan ke WhatsApp
          </button>
        </div>
      )}

      {/* Floating Action Buttons */}
      <div className="fixed bottom-[72px] w-full max-w-md left-1/2 -translate-x-1/2 p-4 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/10 z-40">
        <div className="flex space-x-3 max-w-md mx-auto">
          {booking.status === 'Perlu Verifikasi' ? (
            <>
              <button 
                onClick={handleReject} 
                className="flex-[0.4] py-3.5 bg-red-500/20 text-red-400 border border-red-500/30 font-bold rounded-2xl hover:bg-red-500 hover:text-white transition-all active:scale-95 text-sm"
              >
                Tolak
              </button>
              <button 
                onClick={handleVerify} 
                className="flex-1 py-3.5 bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold rounded-2xl shadow-[0_4px_20px_rgba(234,179,8,0.5)] transition-all active:scale-95 text-sm flex items-center justify-center"
              >
                <span>⚡ Verifikasi</span>
              </button>
            </>
          ) : booking.status === 'Menunggu Pembayaran' ? (
            <button 
              onClick={handleMarkAsPaid} 
              className="w-full py-4 bg-playbox-accent text-white font-bold rounded-2xl shadow-[0_4px_20px_rgba(37,99,235,0.4)] hover:bg-opacity-90 transition-all active:scale-95 text-sm flex items-center justify-center"
            >
              ✅ Konfirmasi Lunas & Aktifkan Unit
            </button>
          ) : (
            <button 
              onClick={() => router.push('/dashboard/booking')} 
              className="w-full py-4 bg-white/10 text-white font-bold rounded-2xl hover:bg-white/20 transition-all active:scale-95 text-sm flex items-center justify-center"
            >
              Kembali ke Dashboard Booking
            </button>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {zoomImage && (
        <div 
          className="fixed inset-0 z-50 max-w-md mx-auto flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setZoomImage(null)}
        >
          <button 
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors z-50"
            onClick={() => setZoomImage(null)}
          >
            ✕
          </button>
          <img 
            src={zoomImage} 
            alt="Zoomed" 
            className="w-full max-h-[85vh] object-contain rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] cursor-zoom-out" 
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
