'use client';
import { getStoreId, getTenantStorageKey } from '@/lib/tenant';
import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { formatSmartCountdown, formatSmartDuration } from '@/lib/format';
import { toPng } from 'html-to-image';

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
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  
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
    const savedRules = localStorage.getItem(getTenantStorageKey('playbox_delivery_rules')) || localStorage.getItem('playbox_delivery_rules');
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

    // 1. Update state local immediately
    setBooking((prev: any) => ({ ...prev, ...updatePayload }));

    // 2. Sync ke Cloud Firestore using setDoc with merge: true
    try {
      await setDoc(doc(db, 'stores', getStoreId(), 'bookings', id), updatePayload, { merge: true });
    } catch (err) {
      console.error('Failed to update status in Firestore:', err);
    }

    // 3. Sync ke localStorage
    try {
      const saved = localStorage.getItem(getTenantStorageKey('playbox_mock_bookings'));
      let bookings = saved ? JSON.parse(saved) : [];
      const exists = bookings.some((b: any) => b.id === id);
      if (exists) {
        bookings = bookings.map((b: any) => b.id === id ? { ...b, ...updatePayload } : b);
      } else if (booking) {
        bookings.unshift({ ...booking, ...updatePayload });
      }
      localStorage.setItem(getTenantStorageKey('playbox_mock_bookings'), JSON.stringify(bookings));
    } catch (err) {
      console.warn('LocalStorage sync warning:', err);
    }
  };

  const handleVerify = async () => {
    if (booking?.requireDelivery && !distance) {
      alert('Mohon masukkan estimasi Jarak Pengiriman (Km) terlebih dahulu!');
      return;
    }

    setIsUpdating(true);
    try {
      await handleUpdateStatus('Menunggu Pembayaran', 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20', {
        deliveryFee: calculatedOngkir,
        totalPrice: (Number(booking.unitPrice) || Number(booking.totalPrice) || 0) + calculatedOngkir,
        needAction: true
      });
      alert('⚡ Pesanan berhasil diverifikasi!\n\nStatus pesanan sekarang "Menunggu Pembayaran". Anda dapat membagikan rincian tagihan ke WhatsApp customer.');
    } catch (err) {
      console.error('Error verifying booking:', err);
      alert('Gagal memverifikasi pesanan. Silakan coba lagi.');
    } finally {
      setIsUpdating(false);
    }
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
    const confirm = window.confirm('Apakah bukti transfer sudah valid dan pembayaran sudah diterima?');
    if (confirm) {
      setIsUpdating(true);
      try {
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
        alert('✅ Pesanan Lunas! Status telah diaktifkan menjadi Sedang Dipakai.');
        router.push('/dashboard/booking');
      } catch (err) {
        console.error('Error confirming payment:', err);
        alert('Gagal mengonfirmasi pembayaran. Silakan coba lagi.');
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const handleReject = async () => {
    const confirmReject = window.confirm("Yakin ingin menolak pesanan ini? Pesanan akan dihapus.");
    if (!confirmReject) return;

    setIsUpdating(true);
    try {
      await deleteDoc(doc(db, 'stores', getStoreId(), 'bookings', id));
    } catch (err) {
      console.error('Error deleting doc from firestore:', err);
    }

    try {
      const saved = localStorage.getItem(getTenantStorageKey('playbox_mock_bookings'));
      if (saved) {
        const bookings = JSON.parse(saved);
        const updated = bookings.filter((b: any) => b.id !== id);
        localStorage.setItem(getTenantStorageKey('playbox_mock_bookings'), JSON.stringify(updated));
      }
    } catch {}
    
    setIsUpdating(false);
    alert('Pesanan telah ditolak dan dihapus.');
    router.push('/dashboard/booking');
  };

  if (!booking) {
    return (
      <div className="p-8 text-center text-white/50 min-h-screen flex items-center justify-center">
        <div className="space-y-2">
          <div className="w-8 h-8 border-2 border-playbox-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm">Memuat data pesanan...</p>
        </div>
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
    <div className="max-w-xl mx-auto p-4 space-y-6 pb-48 relative min-h-screen">
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

      {/* Hero Booking Status Card */}
      <div className="glass-surface-elevated p-6 rounded-3xl relative overflow-hidden">
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className="text-[10px] font-bold text-playbox-text-secondary uppercase tracking-widest block mb-1">KODE BOOKING</span>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-black text-white tracking-wider">{booking.code}</span>
              <button 
                onClick={() => handleCopyText(booking.code, 'code')}
                className="text-xs bg-white/10 hover:bg-white/20 text-white/70 px-2 py-0.5 rounded transition-colors flex items-center space-x-1"
              >
                <span>{copiedField === 'code' ? '✓ Tersalin' : 'Salin'}</span>
              </button>
            </div>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${booking.statusColor || 'bg-white/10 text-white'}`}>
            {displayStatus}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5 text-sm">
          <div>
            <span className="text-[10px] text-white/50 block">Unit Rental</span>
            <span className="font-bold text-white text-base">{booking.unit}</span>
          </div>
          <div>
            <span className="text-[10px] text-white/50 block">Durasi Sewa</span>
            <span className="font-bold text-white text-base">{formatSmartDuration(Number(displayDuration))}</span>
          </div>
          <div>
            <span className="text-[10px] text-white/50 block">Tanggal Sewa</span>
            <span className="font-medium text-white/90">{displayDate}</span>
          </div>
          <div>
            <span className="text-[10px] text-white/50 block">Tipe Layanan</span>
            <span className="font-medium text-white/90">{booking.requireDelivery ? '🚚 Antar - Jemput' : '🏪 Ambil Sendiri'}</span>
          </div>
        </div>

        {timeLeft && (
          <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center bg-white/5 -mx-6 -mb-6 p-4 px-6 rounded-b-3xl">
            <span className="text-xs text-white/70">{timeLabel}</span>
            <span className="text-xs font-black text-playbox-accent bg-playbox-accent/10 px-2.5 py-1 rounded-lg">{timeLeft}</span>
          </div>
        )}
      </div>

      {/* Customer Info Card */}
      <div className="glass-surface p-6 rounded-3xl space-y-4">
        <h2 className="text-xs font-bold text-playbox-text-secondary uppercase tracking-widest flex items-center">
          <span className="mr-2 text-lg">👤</span> Informasi Customer
        </h2>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-white/50 text-xs">Nama Lengkap</span>
            <span className="font-bold text-white">{booking.customer}</span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-white/50 text-xs">Nomor WhatsApp</span>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-white">{booking.customerPhone}</span>
              <a 
                href={`https://wa.me/${booking.customerPhone?.startsWith('0') ? '62' + booking.customerPhone.slice(1) : booking.customerPhone}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs bg-[#25D366]/20 text-[#25D366] px-2 py-0.5 rounded font-bold hover:bg-[#25D366]/30 transition-colors"
              >
                Chat WA
              </a>
            </div>
          </div>

          <div className="py-2 border-b border-white/5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-white/50 text-xs">Alamat Pengiriman</span>
              {displayAddress !== '-' && (
                <button 
                  onClick={() => handleCopyText(displayAddress, 'address')}
                  className="text-[11px] text-playbox-accent hover:underline"
                >
                  {copiedField === 'address' ? '✓ Tersalin' : 'Salin Alamat'}
                </button>
              )}
            </div>
            <p className="text-white/90 text-xs leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5 mt-1">
              {displayAddress}
            </p>
          </div>

          {booking.notes && (
            <div className="py-2">
              <span className="text-white/50 text-xs block mb-1">Catatan Tambahan Customer</span>
              <p className="text-white/80 text-xs italic bg-white/5 p-3 rounded-xl border border-white/5">
                "{booking.notes}"
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Dokumen Jaminan & KTP */}
      <div className="glass-surface p-6 rounded-3xl space-y-4">
        <h2 className="text-xs font-bold text-playbox-text-secondary uppercase tracking-widest flex items-center">
          <span className="mr-2 text-lg">🪪</span> Dokumen Jaminan & Identitas
        </h2>

        {ktpImage ? (
          <div className="space-y-2">
            <span className="text-xs text-white/60 block">Foto KTP / Identitas:</span>
            <div 
              className="relative aspect-video rounded-2xl overflow-hidden bg-black/40 border border-white/10 cursor-pointer group"
              onClick={() => setZoomImage(ktpImage)}
            >
              <img src={ktpImage} alt="KTP Customer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-xs bg-black/70 px-3 py-1.5 rounded-full text-white font-medium">🔍 Klik untuk perbesar</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-white/5 rounded-2xl text-center text-xs text-white/40">
            Tidak ada foto identitas diunggah
          </div>
        )}

        {booking.documents && booking.documents.length > 0 && (
          <div className="pt-2">
            <span className="text-xs text-white/60 block mb-2">Jaminan yang Ditahan:</span>
            <div className="flex flex-wrap gap-2">
              {booking.documents.map((docItem: any, idx: number) => (
                <span key={idx} className="bg-playbox-accent/15 text-playbox-accent border border-playbox-accent/30 text-xs px-3 py-1 rounded-xl font-medium">
                  📌 {docItem.title || docItem.name || 'Dokumen ' + (idx + 1)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bukti Pembayaran */}
      {paymentProofImage && (
        <div className="glass-surface p-6 rounded-3xl space-y-4 border border-green-500/20 bg-green-500/5">
          <h2 className="text-xs font-bold text-green-400 uppercase tracking-widest flex items-center">
            <span className="mr-2 text-lg">💸</span> Bukti Pembayaran Masuk
          </h2>
          <div 
            className="relative aspect-[3/4] max-h-72 rounded-2xl overflow-hidden bg-black/40 border border-green-500/30 cursor-pointer group mx-auto"
            onClick={() => setZoomImage(paymentProofImage)}
          >
            <img src={paymentProofImage} alt="Bukti Transfer" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <span className="text-xs bg-black/70 px-3 py-1.5 rounded-full text-white font-medium">🔍 Klik untuk perbesar</span>
            </div>
          </div>
        </div>
      )}

      {/* Ongkir Calculation Card (Khusus Antar-Jemput saat Perlu Verifikasi) */}
      {booking.requireDelivery && booking.status === 'Perlu Verifikasi' && (
        <div className="glass-surface-elevated p-6 rounded-3xl space-y-4 border border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-yellow-400 uppercase tracking-widest flex items-center">
              <span className="mr-2 text-lg">🚚</span> Hitung Ongkir Pengiriman
            </h2>
            <span className="text-[10px] bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-md font-bold">Wajib Diisi</span>
          </div>
          
          <p className="text-xs text-white/70 leading-relaxed">
            Masukkan estimasi jarak ke lokasi customer untuk menghitung tarif ongkos kirim secara otomatis sesuai aturan ongkir toko.
          </p>

          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-[11px] font-semibold text-white/70 mb-1.5">Jarak Pengiriman (Km)</label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.1"
                  value={distance} 
                  onChange={e => setDistance(e.target.value)}
                  placeholder="Contoh: 4.5"
                  className="w-full p-3.5 pr-14 rounded-xl bg-black/30 border border-white/15 text-white font-bold text-sm focus:outline-none focus:border-yellow-500"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40">KM</span>
              </div>
            </div>

            <div className="flex justify-between items-center p-4 bg-black/20 rounded-xl border border-white/10">
              <span className="text-xs text-white/70">Biaya Ongkir Dihitung:</span>
              <span className="text-lg font-bold text-white">Rp {calculatedOngkir.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Rincian Tagihan & Kirim Tagihan WhatsApp */}
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

      {/* Docked Action Bar at the Bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 bg-[#0A0F1F]/95 backdrop-blur-2xl border-t border-white/10 z-50 shadow-2xl">
        <div className="max-w-xl mx-auto flex space-x-3">
          {booking.status === 'Perlu Verifikasi' ? (
            <>
              <button 
                onClick={handleReject} 
                disabled={isUpdating}
                className="flex-[0.4] py-4 bg-red-500/20 text-red-400 border border-red-500/30 font-bold rounded-2xl hover:bg-red-500 hover:text-white transition-all active:scale-95 text-sm disabled:opacity-50"
              >
                Tolak
              </button>
              <button 
                onClick={handleVerify} 
                disabled={isUpdating}
                className="flex-1 py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold rounded-2xl shadow-[0_4px_20px_rgba(234,179,8,0.5)] transition-all active:scale-95 text-sm flex items-center justify-center disabled:opacity-50"
              >
                {isUpdating ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Memverifikasi...
                  </span>
                ) : (
                  <span>⚡ Verifikasi Pesanan</span>
                )}
              </button>
            </>
          ) : booking.status === 'Menunggu Pembayaran' ? (
            <button 
              onClick={handleMarkAsPaid} 
              disabled={isUpdating}
              className="w-full py-4 bg-playbox-accent text-white font-bold rounded-2xl shadow-[0_4px_20px_rgba(37,99,235,0.4)] hover:bg-opacity-90 transition-all active:scale-95 text-sm flex items-center justify-center disabled:opacity-50"
            >
              {isUpdating ? 'Memproses...' : '✅ Konfirmasi Lunas & Aktifkan Unit'}
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
