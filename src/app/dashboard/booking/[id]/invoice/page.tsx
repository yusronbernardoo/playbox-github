'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import * as htmlToImage from 'html-to-image';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useFirebase } from '@/context/FirebaseContext';

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;

  const router = useRouter();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fines states
  const [lateMins, setLateMins] = useState(0);
  const [autoLateFee, setAutoLateFee] = useState(0);
  const [manualDamageFee, setManualDamageFee] = useState('');
  const [damageDesc, setDamageDesc] = useState('');

  // Rules & Shop Info (from context)
  const { shopInfo } = useFirebase();
  const [dendaRules, setDendaRules] = useState({ tolerance: 15, hourlyRate: 20000 });

  useEffect(() => {
    const loadBookingData = async () => {

      // Load Rules
      let rules = { tolerance: 15, hourlyRate: 20000 };
      const savedRules = localStorage.getItem('playbox_denda_rules');
      if (savedRules) {
        rules = JSON.parse(savedRules);
        setDendaRules(rules);
      }

      let found: any = null;

      // 1. Fetch from Firestore
      try {
        if (id && typeof id === 'string') {
          const docSnap = await getDoc(doc(db, 'bookings', id));
          if (docSnap.exists()) {
            found = { ...docSnap.data(), id: docSnap.id };
          }
        }
      } catch (e) {
        console.warn('Firestore fallback on invoice:', e);
      }

      // 2. Fallback to localStorage
      if (!found) {
        const savedBookings = localStorage.getItem('playbox_mock_bookings');
        if (savedBookings) {
          const parsed = JSON.parse(savedBookings);
          found = parsed.find((b: any) => b.id === id);
        }
      }

      if (found) {
        setBooking(found);
        calculateLateFee(found, rules);
      }
      setLoading(false);
    };

    loadBookingData();
  }, [id]);

  const calculateLateFee = (bookData: any, rules: any) => {
    if (!bookData.isoEnd) return;
    
    const end = new Date(bookData.isoEnd).getTime();
    const now = new Date().getTime();
    const diffMs = now - end;
    
    if (diffMs > 0) {
      const diffMins = Math.floor(diffMs / 60000);
      setLateMins(diffMins);
      
      if (diffMins > rules.tolerance) {
        const lateHours = Math.ceil(diffMins / 60);
        setAutoLateFee(lateHours * rules.hourlyRate);
      }
    }
  };

  const handleFinish = async () => {
    const finalDamageFee = parseInt(manualDamageFee.replace(/\D/g, '')) || 0;
    const totalDenda = autoLateFee + finalDamageFee;
    const currentPrice = Number(booking?.totalPrice) || 0;
    const updatedTotalPrice = currentPrice + totalDenda;

    const finesData = {
      lateFee: autoLateFee,
      damageFee: finalDamageFee,
      damageDesc: damageDesc,
      total: totalDenda
    };

    // 1. Update Firestore
    try {
      if (id && typeof id === 'string') {
        await updateDoc(doc(db, 'bookings', id), {
          status: 'Selesai',
          statusColor: 'bg-playbox-ready/15 text-playbox-ready border border-playbox-ready/20',
          needAction: false,
          fines: finesData,
          totalPrice: updatedTotalPrice,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Failed to update booking to Selesai in Firestore:', err);
    }

    // 2. Update localStorage
    const savedBookings = localStorage.getItem('playbox_mock_bookings');
    if (savedBookings) {
      let parsedBookings = JSON.parse(savedBookings);
      parsedBookings = parsedBookings.map((b: any) => {
        if (b.id === id) {
          return {
            ...b,
            status: 'Selesai',
            statusColor: 'bg-playbox-ready/15 text-playbox-ready border border-playbox-ready/20',
            fines: finesData,
            totalPrice: updatedTotalPrice
          };
        }
        return b;
      });
      localStorage.setItem('playbox_mock_bookings', JSON.stringify(parsedBookings));
    }

    // 3. Release Unit to Ready
    if (booking?.unitId) {
      const savedUnits = localStorage.getItem('playbox_mock_units');
      if (savedUnits) {
        let parsedUnits = JSON.parse(savedUnits);
        parsedUnits = parsedUnits.map((u: any) => {
          if (u.id === booking.unitId || u.name === booking.unit) {
            return { ...u, status: 'Ready' };
          }
          return u;
        });
        localStorage.setItem('playbox_mock_units', JSON.stringify(parsedUnits));
      }
    }

    alert('Pesanan berhasil diselesaikan! Unit kembali berstatus Ready.');
    router.push('/dashboard/booking');
  };

  const handleDownloadInvoice = async () => {
    const element = document.getElementById('invoice-capture');
    if (!element) return alert('Elemen invoice tidak ditemukan.');
    
    try {
      // 1. Generate Image (Download) using html-to-image
      const image = await htmlToImage.toPng(element, { 
        backgroundColor: '#0A0F1F', 
        pixelRatio: 2
      });
      
      const link = document.createElement('a');
      link.href = image;
      link.download = `Playbox-Invoice-${booking.id}.png`;
      link.click();
      
      // 2. Open WhatsApp with formatted text
      let phone = booking.customerPhone || '';
      if (phone.startsWith('0')) phone = '62' + phone.substring(1);
      
      const totalDenda = autoLateFee + (parseInt(manualDamageFee.replace(/\D/g, '')) || 0);
      
      const shopName = shopInfo?.brandName || 'Playbox Rental';
      const text = `Halo ${booking.customer},\n\nTerima kasih telah menyewa di *${shopName}*! 🎮\nBerikut adalah rincian Invoice Akhir (Selesai) untuk pesanan Anda (ID: *${booking.id}*).\n\nBiaya Denda (Telat/Kerusakan): *Rp ${totalDenda.toLocaleString('id-ID')}*\n\n_(Catatan: Jika ada gambar struk yang dilampirkan, silakan cek rincian lengkapnya di situ)_\n\nHubungi CS kami: *${shopInfo.phone || ''}*\nTerima kasih telah berlangganan! 🔥`;
      
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
      
      // Kasih delay dikit biar download jalan dulu baru buka WA tab baru
      setTimeout(() => {
        window.open(waUrl, '_blank');
      }, 500);

    } catch (err) {
      console.error('Gagal membuat struk:', err);
      alert('Terjadi kesalahan saat memproses gambar struk.');
    }
  };

  if (loading || !booking) return <div className="p-8 text-center text-white">Memuat...</div>;

  const finalDamageFeeNum = parseInt(manualDamageFee.replace(/\D/g, '')) || 0;
  const totalDenda = autoLateFee + finalDamageFeeNum;

  return (
    <div className="p-4 pb-48 min-h-screen flex flex-col relative bg-playbox-bg">
      <div className="ambient-glow"></div>

      {/* Header */}
      <div className="flex items-center mt-2 mb-6 relative z-10">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl mr-4 hover:bg-white/10 transition-colors">
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Invoice Akhir</h1>
          <p className="text-xs text-playbox-text-secondary mt-0.5">#{booking.id} • {booking.customer}</p>
        </div>
      </div>

      <div id="invoice-capture" className="relative z-10 space-y-5 bg-playbox-bg rounded-2xl p-2 -mx-2">
        
        {/* Kop Struk (khusus untuk di gambar) */}
        <div className="flex flex-col items-center justify-center text-center mb-6 pt-4 border-b border-white/10 pb-4">
          {shopInfo?.logo && (
            <img src={shopInfo.logo} alt="Shop Logo" className="w-16 h-16 rounded-xl object-cover mb-3" />
          )}
          <h2 className="text-xl font-black text-white tracking-tighter uppercase">{shopInfo?.brandName || 'PLAYBOX RENTAL'}</h2>
          <p className="text-xs text-white/70 mt-0.5">{shopInfo?.address || 'Struk Penyewaan Resmi'}</p>
          <p className="text-[11px] text-white/50">WA CS: {shopInfo?.phone || '-'}</p>
          <p className="text-[10px] text-playbox-accent font-mono mt-2">ID: {booking.id} | Nama: {booking.customer}</p>
        </div>

        {/* Ringkasan Pesanan */}
        <div className="glass-surface p-5 rounded-2xl">
          <h2 className="text-sm font-bold text-white mb-4 border-b border-white/10 pb-3">Ringkasan Awal</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/60">Tarif Sewa ({booking.durationHours} Jam)</span>
              <span className="text-sm font-medium text-white">Rp {(booking.totalPrice - (booking.deliveryFee || 0)).toLocaleString('id-ID')}</span>
            </div>
            {booking.requireDelivery && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/60">Ongkos Kirim</span>
                <span className="text-sm font-medium text-white">Rp {(booking.deliveryFee || 0).toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-white/5">
              <span className="text-xs font-bold text-white">Total Dibayar Klien</span>
              <span className="text-sm font-bold text-playbox-ready">Rp {booking.totalPrice.toLocaleString('id-ID')} ✅</span>
            </div>
          </div>
        </div>

        {/* Denda Keterlambatan (Otomatis) */}
        <div className="glass-surface p-5 rounded-2xl border border-orange-500/20">
          <div className="flex items-center mb-4 border-b border-white/10 pb-3">
            <span className="text-xl mr-2">⏱️</span>
            <div>
              <h2 className="text-sm font-bold text-white">Denda Keterlambatan</h2>
              <p className="text-[10px] text-white/50">Dihitung otomatis (Toleransi {dendaRules.tolerance} mnt, Rp{dendaRules.hourlyRate.toLocaleString('id-ID')}/jam)</p>
            </div>
          </div>

          <div className="flex justify-between items-center bg-black/20 p-4 rounded-xl">
            <div>
              <p className="text-xs text-white/70">Waktu Keterlambatan:</p>
              <p className="text-sm font-bold text-orange-400 mt-1">{lateMins > 0 ? `${lateMins} Menit` : 'Tepat Waktu'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/70">Denda:</p>
              <p className="text-lg font-bold text-orange-400 mt-0.5">Rp {autoLateFee.toLocaleString('id-ID')}</p>
            </div>
          </div>
        </div>

        {/* Denda Kerusakan (Read-Only untuk Struk) */}
        {finalDamageFeeNum > 0 && (
          <div className="glass-surface p-5 rounded-2xl border border-red-500/20">
            <div className="flex items-center mb-4 border-b border-red-500/10 pb-3">
              <span className="text-xl mr-2">⚠️</span>
              <div>
                <h2 className="text-sm font-bold text-white">Denda Kerusakan / Lainnya</h2>
              </div>
            </div>
            <div className="flex justify-between items-center bg-black/20 p-4 rounded-xl">
              <div>
                <p className="text-xs text-white/70">Keterangan:</p>
                <p className="text-sm font-medium text-red-400 mt-1">{damageDesc || 'Kerusakan Unit'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/70">Nominal:</p>
                <p className="text-lg font-bold text-red-400 mt-0.5">Rp {finalDamageFeeNum.toLocaleString('id-ID')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Grand Total */}
        <div className="glass-surface p-5 rounded-2xl bg-playbox-accent/10 border border-playbox-accent/30 mt-4">
           <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-white">TOTAL KESELURUHAN (SEWA + DENDA)</span>
              <span className="text-xl font-black text-playbox-accent">Rp {(booking.totalPrice + totalDenda).toLocaleString('id-ID')}</span>
           </div>
        </div>

      </div>

      {/* --- PANEL KASIR (TIDAK MASUK GAMBAR STRUK) --- */}
      <div className="mt-8 space-y-5 relative z-10">
        <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest pl-2">Panel Admin (Tidak Masuk Struk)</h3>
        
        {/* Form Denda Kerusakan (Manual) */}
        <div className="glass-surface p-5 rounded-2xl border border-white/5">
           <div className="flex items-center mb-4 border-b border-white/10 pb-3">
            <span className="text-xl mr-2">📝</span>
            <div>
              <h2 className="text-sm font-bold text-white">Input Denda Tambahan</h2>
              <p className="text-[10px] text-white/50">Diisi manual oleh kasir jika ada kerusakan/kehilangan</p>
            </div>
          </div>

          <div className="space-y-4">
             <div>
              <label className="block text-[11px] uppercase tracking-wider text-white/60 mb-2">Nominal Denda (Rp)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">Rp</span>
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={manualDamageFee ? Number(manualDamageFee.replace(/\D/g, '')).toLocaleString('id-ID') : ''}
                  onChange={e => setManualDamageFee(e.target.value)}
                  placeholder="Mis: 150.000 (Kosongkan jika aman)"
                  className="w-full p-4 pl-12 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
            </div>
            {manualDamageFee && (
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-white/60 mb-2">Keterangan Kerusakan</label>
                <input 
                  type="text" 
                  value={damageDesc}
                  onChange={e => setDamageDesc(e.target.value)}
                  placeholder="Mis: Kabel HDMI putus"
                  className="w-full p-4 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
                  required
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="fixed bottom-[72px] w-full max-w-md left-1/2 -translate-x-1/2 p-4 bg-[#0A0F1F]/90 backdrop-blur-xl border-t border-white/10 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-md mx-auto space-y-3">
          <div className="flex justify-between items-center px-2">
            <span className="text-xs font-bold text-white/70 uppercase tracking-wider">Total Denda Dibayar</span>
            <span className="text-2xl font-black text-red-500">Rp {totalDenda.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={handleDownloadInvoice}
              className="flex-1 py-4 bg-[#25D366]/20 text-[#25D366] rounded-2xl font-bold hover:bg-[#25D366]/30 active:scale-95 transition-all text-[11px] uppercase tracking-wider flex flex-col items-center justify-center border border-[#25D366]/30"
            >
              <span className="text-lg mb-0.5">💬</span>
              Kirim ke WA
            </button>
            <button 
              onClick={handleFinish}
              className="flex-[2] py-4 bg-playbox-accent text-white rounded-2xl font-bold shadow-[0_4px_20px_rgba(37,99,235,0.4)] tracking-wide hover:bg-opacity-90 active:scale-95 transition-all text-sm"
            >
              Selesaikan Pesanan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
