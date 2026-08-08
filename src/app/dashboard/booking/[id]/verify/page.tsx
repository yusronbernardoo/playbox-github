'use client';
import { getStoreId, getTenantStorageKey } from '@/lib/tenant';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { formatSmartCountdown, formatSmartDuration } from '@/lib/format';
import { toPng } from 'html-to-image';
import { useRef } from 'react';

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
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  
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
    const unsubscribe = onSnapshot(doc(db, 'stores', getStoreId(), 'bookings', id), (docSnap) => {
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
    const unsubscribeShop = onSnapshot(doc(db, 'stores', getStoreId()), (snap) => {
      if (snap.exists()) {
        const s = snap.data();
        if (s.brandName) setBusinessName(s.brandName);
        if (s.logo) setBusinessLogo(s.logo);
      } else {
        const saved = localStorage.getItem(getTenantStorageKey('playbox_shop_settings'));
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.brandName) setBusinessName(parsed.brandName);
          if (parsed.logo) setBusinessLogo(parsed.logo);
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
    const savedPayments = localStorage.getItem(getTenantStorageKey('playbox_payments'));
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
    const savedBookings = localStorage.getItem(getTenantStorageKey('playbox_mock_bookings'));
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
      await updateDoc(doc(db, 'stores', getStoreId(), 'bookings', id), updatePayload);
    } catch (err) {
      console.error('Failed to update status in Firestore:', err);
    }

    // 2. Sync ke localStorage
    const saved = localStorage.getItem(getTenantStorageKey('playbox_mock_bookings'));
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
      localStorage.setItem(getTenantStorageKey('playbox_mock_bookings'), JSON.stringify(updated));
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

  const handleSendWA = async () => {
    if (!booking) return;

    const phone = booking.customerPhone.startsWith('0') ? '62' + booking.customerPhone.slice(1) : booking.customerPhone;
    const durationText = formatSmartDuration(Number(booking.durationHours || booking.duration || 24));

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
    
    // Generate Invoice
    if (invoiceRef.current) {
      setIsGeneratingInvoice(true);
      try {
        await new Promise(r => setTimeout(r, 100)); // wait for render
        const dataUrl = await toPng(invoiceRef.current, {
          quality: 1,
          pixelRatio: 2,
          backgroundColor: '#0a0a0a'
        });
        
        // Trigger download
        const link = document.createElement('a');
        link.download = `Tagihan_${booking.code}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Failed to generate billing invoice:', err);
      } finally {
        setIsGeneratingInvoice(false);
      }
    }

    // Give a short delay before opening WA to ensure download starts
    setTimeout(() => {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    }, 500);
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
      await deleteDoc(doc(db, 'stores', getStoreId(), 'bookings', id));
    } catch (err) {
      console.error('Error deleting doc from firestore:', err);
    }

    const saved = localStorage.getItem(getTenantStorageKey('playbox_mock_bookings'));
    if (saved) {
      const bookings = JSON.parse(saved);
      const updated = bookings.filter((b: any) => b.id !== id);
      localStorage.setItem(getTenantStorageKey('playbox_mock_bookings'), JSON.stringify(updated));
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
            disabled={isGeneratingInvoice}
            className={`w-full py-4 text-black font-bold rounded-2xl transition-all flex items-center justify-center mt-4 text-sm
              ${isGeneratingInvoice 
                ? 'bg-[#25D366]/50 cursor-not-allowed shadow-none' 
                : 'bg-[#25D366] shadow-[0_4px_20px_rgba(37,211,102,0.4)] hover:bg-[#20bd5a] active:scale-95'
              }`}
          >
            {isGeneratingInvoice ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Menyiapkan Tagihan...
              </>
            ) : (
              <><span className="mr-2 text-lg">💬</span> Kirim Tagihan ke WhatsApp</>
            )}
          </button>
        </div>
      )}

      {/* Floating Action Buttons */}
      <div className="fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2 p-4 pb-6 sm:pb-4 bg-[#0A0F1F]/95 backdrop-blur-2xl border-t border-white/10 z-50 shadow-2xl">
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

      {/* Hidden Billing Invoice Template with QRIS */}
      <div className="fixed top-[-9999px] left-[-9999px] z-[-1]">
        <div ref={invoiceRef} className="w-[800px] p-10 bg-[#0E1221] text-white flex flex-col relative overflow-hidden font-sans border-t-[10px] border-playbox-accent shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-playbox-accent/10 rounded-full blur-3xl"></div>
          
          <div className="flex justify-between items-start mb-10 border-b border-white/10 pb-8 relative z-10">
            <div className="flex items-center space-x-4">
              {businessLogo && (
                <img src={businessLogo} alt="Logo" className="w-16 h-16 rounded-2xl object-cover border border-white/10 shadow-lg" />
              )}
              <div>
                <h1 className="text-3xl font-black tracking-tighter text-playbox-accent uppercase">{businessName}</h1>
                <p className="text-[#9BA1B0] text-sm mt-1 font-medium">Rental PlayStation Premium</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold tracking-tight text-white/90">TAGIHAN</p>
              <p className="text-playbox-accent font-bold mt-1 text-xl">{booking?.code}</p>
            </div>
          </div>

          <div className="flex justify-between mb-10 relative z-10">
            <div>
              <p className="text-[#9BA1B0] text-sm font-semibold uppercase tracking-wider mb-2">Customer</p>
              <p className="text-2xl font-bold text-white mb-2">{booking?.customer}</p>
              <p className="text-white/60 text-sm flex items-center mb-1"><svg className="w-3.5 h-3.5 mr-2 text-green-400 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.086 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> {booking?.customerPhone || '-'}</p>
            </div>
            <div className="text-right">
              <p className="text-[#9BA1B0] text-sm font-semibold uppercase tracking-wider mb-2">Periode Sewa</p>
              <p className="text-lg font-bold text-white">
                {booking?.startTime ? new Date(booking.startTime).toLocaleDateString('id-ID') : booking?.startDate}
              </p>
              <p className="text-white/60 text-lg mt-1">{formatSmartDuration(Number(booking?.durationHours || booking?.duration || 24))}</p>
            </div>
          </div>

          <div className="bg-black/30 rounded-2xl border border-white/10 p-6 mb-10 relative z-10">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-[#9BA1B0] text-sm font-semibold uppercase tracking-wider">
                  <th className="pb-4 font-semibold">Deskripsi</th>
                  <th className="pb-4 font-semibold text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody className="text-xl">
                <tr className="border-b border-white/5">
                  <td className="py-6">
                    <p className="font-bold text-white">{booking?.unit}</p>
                  </td>
                  <td className="py-6 text-right font-bold text-white">Rp {Number(booking?.unitPrice || booking?.totalPrice || 0).toLocaleString('id-ID')}</td>
                </tr>
                {booking?.requireDelivery && (
                  <tr className="border-b border-white/5">
                    <td className="py-6">
                      <p className="font-bold text-white">Ongkos Kirim</p>
                      <p className="text-sm text-white/50 font-normal mt-1">Layanan Antar-Jemput</p>
                    </td>
                    <td className="py-6 text-right font-bold text-white">Rp {Number(booking?.deliveryFee || calculatedOngkir || 0).toLocaleString('id-ID')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-end mb-10 relative z-10">
            <div>
              <p className="text-[#9BA1B0] text-sm font-semibold uppercase tracking-wider mb-3">Metode Pembayaran</p>
              <div className="space-y-1">
                {paymentMethods.length > 0 ? paymentMethods.map((p, i) => (
                  <p key={i} className="text-white/80 text-sm font-medium">{p.name}: <span className="text-white font-bold">{p.account}</span> (a.n {p.owner})</p>
                )) : (
                  <p className="text-white/80 text-sm">Transfer Bank / Kasir Toko</p>
                )}
              </div>
            </div>
            
            <div className="text-right bg-playbox-accent/10 p-6 rounded-2xl border border-playbox-accent/20 min-w-[300px]">
              <p className="text-[#9BA1B0] text-sm font-semibold uppercase tracking-wider mb-2">Total Tagihan</p>
              <p className="text-4xl font-black text-playbox-accent">Rp {Number(booking?.totalPrice || 0).toLocaleString('id-ID')}</p>
            </div>
          </div>
          
          {paymentMethods.some(p => p.type === 'QRIS' && p.qrisImage) && (
            <div className="border-t border-white/10 pt-8 mt-4 relative z-10 flex flex-col items-center">
              <p className="text-white/80 font-bold mb-4 uppercase tracking-widest text-sm">Scan QRIS Untuk Membayar</p>
              <div className="bg-white p-4 rounded-3xl w-48 h-48 flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.1)]">
                <img 
                  src={paymentMethods.find(p => p.type === 'QRIS' && p.qrisImage)?.qrisImage} 
                  alt="QRIS" 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}

          <div className="mt-8 pt-8 border-t border-white/10 text-center relative z-10">
            <p className="text-white/40 text-sm font-medium">Terima kasih telah mempercayakan hiburan Anda pada kami.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
