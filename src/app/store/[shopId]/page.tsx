'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

export default function StorefrontPage({ params }: { params: Promise<{ shopId: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  
  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [duration, setDuration] = useState(24);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [tempTime, setTempTime] = useState('08:00');
  const [ktpFileName, setKtpFileName] = useState('');
  const [ktpDataUrl, setKtpDataUrl] = useState('');
  const [paymentProofFileName, setPaymentProofFileName] = useState('');
  const [paymentProofDataUrl, setPaymentProofDataUrl] = useState('');
  const [requireDelivery, setRequireDelivery] = useState(false);
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submittedBooking, setSubmittedBooking] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);

  const [displayShopName, setDisplayShopName] = useState<string>('');
  const [shopProfile, setShopProfile] = useState<{
    brandName?: string;
    phone?: string;
    instagram?: string;
    address?: string;
    bio?: string;
    logo?: string;
  }>({});

  useEffect(() => {
    const fetchStoreData = async () => {
      // Dynamic SaaS Loading: Get settings from Firestore first, then localStorage
      let loadedProfile: any = null;
      try {
        const snap = await getDoc(doc(db, 'settings', 'shop'));
        if (snap.exists()) {
          loadedProfile = snap.data();
        }
      } catch (e) {
        console.warn('Firestore shop settings fallback in store:', e);
      }

      if (!loadedProfile) {
        const settings = localStorage.getItem('playbox_shop_settings');
        if (settings) {
          loadedProfile = JSON.parse(settings);
        }
      }

      let loadedBrand = loadedProfile?.brandName || '';
      
      // Fallback if not found, just format the slug nicely
      if (!loadedBrand) {
        loadedBrand = unwrappedParams.shopId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      
      setDisplayShopName(loadedBrand);
      if (loadedProfile) {
        setShopProfile(loadedProfile);
      }
      
      // Fetch units from local storage initially
      const savedUnits = localStorage.getItem('playbox_mock_units');
      if (savedUnits) {
        setUnits(JSON.parse(savedUnits));
      } else {
        const defaultUnits = [
          {
            id: 'U01', name: 'PS5 Premium Set (#01)', type: 'PlayStation 5', status: 'Ready', price: 150000, 
            image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=500&q=80',
            specs: ['2 Stik', 'FIFA 24', 'GTA V']
          }
        ];
        setUnits(defaultUnits);
      }

      // Fetch payment methods
      const savedPayments = localStorage.getItem('playbox_payments');
      if (savedPayments) {
        const parsed = JSON.parse(savedPayments);
        setPaymentMethods(parsed.filter((p: any) => p.active));
      }
    };

    fetchStoreData();

    // Setup Realtime Listener for Units Availability
    const unsubscribeUnits = onSnapshot(collection(db, 'units'), (snapshot) => {
      if (!snapshot.empty) {
        const liveUnits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUnits(liveUnits);
        localStorage.setItem('playbox_mock_units', JSON.stringify(liveUnits));
      }
    }, (error) => {
      console.warn('Units realtime listener fallback in store:', error);
    });

    return () => unsubscribeUnits();
  }, [unwrappedParams.shopId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setKtpFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        setKtpDataUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaymentProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setPaymentProofFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        setPaymentProofDataUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit || !customerName || !customerPhone || !ktpDataUrl || !address) {
      alert('Mohon lengkapi semua formulir dan upload foto KTP!');
      return;
    }

    if (!startDate || !startTime) {
      alert('Mohon pilih tanggal dan jam mulai sewa!');
      return;
    }

    setIsSubmitting(true);

    try {
      const savedBookings = localStorage.getItem('playbox_mock_bookings');
      const bookings = savedBookings ? JSON.parse(savedBookings) : [];
      
      const newId = `B0${bookings.length + 1}`;
      const randomInv = Math.floor(100000 + Math.random() * 900000);
      const invoiceCode = `INV-${randomInv}`;

      const totalDays = duration / 24;
      const basePrice = selectedUnit.price * totalDays;
      const calculatedTotalPrice = basePrice;

      const formattedStartDate = format(new Date(startDate), 'yyyy-MM-dd');
      const isoStartDateTime = `${formattedStartDate}T${startTime}:00`;
      const timeDisplay = `${formattedStartDate}, ${startTime} (${duration === 12 ? '12 Jam' : duration === 168 ? '1 Minggu' : `${duration/24} Hari`})`;

      const newBooking = {
        id: newId,
        code: invoiceCode,
        customer: customerName,
        customerPhone: customerPhone,
        unit: selectedUnit.name,
        unitId: selectedUnit.id,
        time: timeDisplay,
        isoStart: isoStartDateTime,
        duration: duration,
        status: 'Perlu Verifikasi',
        statusColor: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20',
        paymentStatus: 'Belum Lunas',
        deliveryStatus: requireDelivery ? 'Diantar (+Ongkir)' : 'Ambil di Toko',
        requireDelivery: requireDelivery,
        address: address,
        totalPrice: calculatedTotalPrice,
        unitPrice: selectedUnit.price,
        deliveryFee: 0,
        ktpUrl: ktpDataUrl,
        paymentProofUrl: paymentProofDataUrl || null,
        needAction: true,
        fines: null,
        createdAt: new Date().toISOString()
      };

      // 1. Simpan ke Cloud Firestore (Real-Time)
      try {
        await setDoc(doc(db, 'bookings', newId), newBooking);
      } catch (err) {
        console.error('Gagal sync ke Firestore:', err);
      }

      // 2. Simpan juga ke localStorage (Fallback)
      bookings.push(newBooking);
      localStorage.setItem('playbox_mock_bookings', JSON.stringify(bookings));
      
      setSubmittedBooking(newBooking);
      setIsSubmitting(false);
      setShowSuccess(true);
    } catch (error) {
      console.error('Error submitting booking:', error);
      setIsSubmitting(false);
      setShowSuccess(true);
    }
  };

  const handleCloseModal = () => {
    setShowSuccess(false);
    setSelectedUnit(null);
    setSubmittedBooking(null);
    setCustomerName('');
    setCustomerPhone('');
    setKtpFileName('');
    setKtpDataUrl('');
    setPaymentProofFileName('');
    setPaymentProofDataUrl('');
    setAddress('');
    setRequireDelivery(false);
    setDuration(24);
  };

  return (
    <div className="min-h-screen bg-playbox-bg text-playbox-text-primary font-sans relative overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="ambient-glow"></div>
      
      {/* Header */}
      <header className="relative z-10 p-5 pt-8 text-center pb-6 border-b border-white/5 bg-black/30 backdrop-blur-md">
        
        {/* Custom Logo / Initial Avatar */}
        <div className="w-20 h-20 mx-auto rounded-3xl bg-black/40 border border-white/15 flex items-center justify-center shadow-[0_10px_30px_rgba(226,23,142,0.3)] mb-3 overflow-hidden">
          {shopProfile.logo ? (
            <img src={shopProfile.logo} alt="Shop Logo" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-playbox-gradient-start to-playbox-gradient-end flex items-center justify-center text-3xl font-black text-white uppercase">
              {displayShopName ? displayShopName.charAt(0) : 'P'}
            </div>
          )}
        </div>

        <h1 className="text-2xl font-black tracking-tight text-white mb-1">{displayShopName}</h1>
        <p className="text-xs text-playbox-text-secondary max-w-xs mx-auto mb-3">
          {shopProfile.bio || 'Pusat Sewa PlayStation 5 & PS4 Premium Terpercaya'}
        </p>

        {shopProfile.address && (
          <p className="text-[11px] text-white/60 flex items-center justify-center mb-3.5 px-4">
            <span className="mr-1">📍</span> {shopProfile.address}
          </p>
        )}

        {/* Action Contact Buttons (WA CS & Instagram) */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {shopProfile.phone && (
            <button 
              onClick={() => {
                let p = shopProfile.phone || '';
                if (p.startsWith('0')) p = '62' + p.substring(1);
                window.open(`https://wa.me/${p}?text=${encodeURIComponent(`Halo ${displayShopName}, saya ingin bertanya seputar sewa konsol PlayStation.`)}`, '_blank');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#25D366]/20 border border-[#25D366]/40 text-[#25D366] text-xs font-bold hover:bg-[#25D366]/30 active:scale-95 transition-all shadow-[0_0_15px_rgba(37,211,102,0.15)]"
            >
              <span>💬</span> WhatsApp CS
            </button>
          )}

          {shopProfile.instagram && (
            <button 
              onClick={() => {
                const ig = shopProfile.instagram?.replace(/^@/, '').trim();
                window.open(`https://instagram.com/${ig}`, '_blank');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-400 text-xs font-bold hover:bg-pink-500/30 active:scale-95 transition-all shadow-[0_0_15px_rgba(226,23,142,0.15)]"
            >
              <span>📸</span> Instagram
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-lg mx-auto p-4 space-y-5 pb-24">
        <div className="flex justify-between items-end mb-1">
          <h2 className="text-base font-bold text-white tracking-tight">Katalog Unit PlayStation</h2>
          <span className="text-[11px] text-white/50">{units.filter(u => u.status === 'Ready').length} Unit Tersedia</span>
        </div>

        <div className="space-y-3.5">
          {units.map(unit => (
            <div key={unit.id} className="glass-surface rounded-3xl p-3.5 flex gap-3.5 overflow-hidden relative group border border-white/5">
              <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 relative bg-black/40">
                <img src={unit.image} alt={unit.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute bottom-1.5 left-1.5 right-1.5 z-20">
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full block text-center uppercase tracking-wider backdrop-blur-md ${unit.status === 'Ready' ? 'bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/40' : 'bg-red-500/30 text-red-300 border border-red-500/40'}`}>
                    {unit.status}
                  </span>
                </div>
              </div>
              
              <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-sm text-white truncate">{unit.name}</h3>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {unit.specs?.slice(0, 2).map((spec: string, idx: number) => (
                      <span key={`s-${idx}`} className="text-[8px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                        {spec}
                      </span>
                    ))}
                    {unit.games?.slice(0, 2).map((game: string, idx: number) => (
                      <span key={`g-${idx}`} className="text-[8px] px-1.5 py-0.5 rounded bg-playbox-accent/10 text-playbox-accent border border-playbox-accent/20">
                        {game}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-between items-end mt-2 pt-1 border-t border-white/5">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-white/40">Tarif / 24 Jam</p>
                    <p className="text-xs font-black text-white">Rp {(unit.price || 0).toLocaleString('id-ID')}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedUnit(unit)}
                    disabled={unit.status !== 'Ready'}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      unit.status === 'Ready' 
                      ? 'bg-playbox-accent text-white hover:bg-opacity-90 active:scale-95 shadow-[0_4px_12px_rgba(226,23,142,0.35)]' 
                      : 'bg-white/5 text-white/30 cursor-not-allowed'
                    }`}
                  >
                    {unit.status === 'Ready' ? 'Booking' : 'Disewa'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Booking / Success Modal (Compact Mobile Bottom-Sheet) */}
      {selectedUnit && (
        <div className={`fixed inset-0 z-50 max-w-md mx-auto flex justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${showSuccess ? 'items-center p-4' : 'items-end sm:items-center p-0 sm:p-4'}`}>
          <div className={`w-full max-w-md bg-[#0D1122] shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[88vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 ${showSuccess ? 'rounded-3xl' : 'rounded-t-3xl sm:rounded-3xl'}`}>
            
            {/* Modal Header */}
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
              <div>
                <h3 className="font-bold text-base text-white">{showSuccess ? 'Status Pemesanan' : 'Formulir Booking'}</h3>
                <p className="text-[10px] text-white/50">{selectedUnit.name}</p>
              </div>
              <button 
                onClick={handleCloseModal}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 transition-colors text-xs"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            {showSuccess ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-[#25D366]/20 rounded-full flex items-center justify-center mx-auto border border-[#25D366]/40 shadow-[0_0_20px_rgba(37,211,102,0.2)] animate-bounce">
                  <span className="text-3xl">✅</span>
                </div>

                <div>
                  <h2 className="text-lg font-black text-white">Booking Berhasil Diajukan!</h2>
                  <p className="text-xs text-white/60 mt-1 max-w-xs mx-auto">
                    Pesanan Anda telah masuk dan sedang menunggu persetujuan admin rental.
                  </p>
                </div>

                {/* Compact Booking Summary */}
                {submittedBooking && (
                  <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-left space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/50">ID Invoice:</span>
                      <span className="font-bold text-white">{submittedBooking.code}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Unit:</span>
                      <span className="font-bold text-white truncate max-w-[170px]">{submittedBooking.unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Jadwal:</span>
                      <span className="font-medium text-white">{submittedBooking.time}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-white/5">
                      <span className="text-white/50">Total Biaya:</span>
                      <span className="font-black text-playbox-accent">Rp {submittedBooking.totalPrice?.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                )}

                <button 
                  onClick={handleCloseModal}
                  className="w-full py-3.5 bg-playbox-accent text-white rounded-xl font-bold transition-all text-xs shadow-lg active:scale-95"
                >
                  Selesai & Kembali ke Katalog
                </button>
              </div>
            ) : (
              <div className="p-4 overflow-y-auto flex-1 space-y-4">
                <form id="booking-form" onSubmit={handleSubmit} className="space-y-4">
                  
                  {/* Durasi Sewa */}
                  <div>
                    <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1.5">Durasi Sewa</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[12, 24, 48, 72].map(h => (
                        <button 
                          key={h}
                          type="button"
                          onClick={() => setDuration(h)}
                          className={`py-2 rounded-xl border text-[11px] font-bold transition-all ${duration === h ? 'bg-playbox-accent/20 border-playbox-accent text-playbox-accent shadow-sm' : 'bg-black/30 border-white/5 text-white/60 hover:bg-white/5'}`}
                        >
                          {h === 12 ? '12 Jam' : `${h/24} Hari`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tanggal & Jam Mulai */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">Tanggal Sewa</label>
                      <div 
                        onClick={() => { setIsDatePickerOpen(!isDatePickerOpen); setIsTimePickerOpen(false); }}
                        className={`w-full p-3 rounded-xl bg-black/30 border text-xs flex justify-between items-center cursor-pointer transition-all ${isDatePickerOpen ? 'border-playbox-accent text-white' : 'border-white/10 text-white/80'}`}
                      >
                        <span className="truncate">{startDate ? format(new Date(startDate), 'dd MMM yyyy', { locale: idLocale }) : 'Pilih Tanggal'}</span>
                        <span className="opacity-70 text-xs">📅</span>
                      </div>
                      
                      {isDatePickerOpen && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                          <div className="p-4 bg-playbox-surface border border-white/10 rounded-2xl shadow-2xl relative max-w-[300px] w-full flex flex-col items-center">
                            <div className="w-full flex justify-between items-center mb-3">
                              <h3 className="text-white font-bold text-xs">Pilih Tanggal</h3>
                              <button type="button" onClick={() => setIsDatePickerOpen(false)} className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-white/50 text-xs">✕</button>
                            </div>
                            <style>{`
                              .rdp { --rdp-cell-size: 34px; --rdp-accent-color: #e2178e; --rdp-background-color: rgba(226,23,142,0.2); margin: 0; }
                              .rdp-day_selected, .rdp-day_selected:focus-visible, .rdp-day_selected:hover { background-color: var(--rdp-accent-color); color: white; font-weight: bold; }
                              .rdp-button:hover:not([disabled]):not(.rdp-day_selected) { background-color: rgba(255,255,255,0.1); }
                              .rdp-day { color: white; font-size: 12px; }
                            `}</style>
                            <DayPicker
                              mode="single"
                              selected={startDate ? new Date(startDate) : undefined}
                              onSelect={(d) => {
                                if (d) {
                                  setStartDate(format(d, 'yyyy-MM-dd'));
                                  setIsDatePickerOpen(false);
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">Jam Mulai</label>
                      <div 
                        onClick={() => { 
                          setTempTime(startTime || '08:00'); 
                          setIsTimePickerOpen(true); 
                          setIsDatePickerOpen(false); 
                        }}
                        className={`w-full p-3 rounded-xl bg-black/30 border text-xs flex justify-between items-center cursor-pointer transition-all ${isTimePickerOpen ? 'border-playbox-accent text-white' : 'border-white/10 text-white/80'}`}
                      >
                        <span>{startTime || 'Pilih Jam'}</span>
                        <span className="opacity-70 text-xs">⏰</span>
                      </div>
                      
                      {isTimePickerOpen && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                          <div className="p-4 bg-playbox-surface border border-white/10 rounded-2xl shadow-2xl relative max-w-[280px] w-full">
                            <div className="flex justify-between items-center mb-3">
                              <h3 className="text-white font-bold text-xs">Pilih Jam Mulai</h3>
                              <button type="button" onClick={() => setIsTimePickerOpen(false)} className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-white/50 text-xs">✕</button>
                            </div>

                            <div className="grid grid-cols-4 gap-2 mb-4">
                              {['08:00', '10:00', '13:00', '15:00', '17:00', '19:00', '21:00', '23:00'].map(t => (
                                <button 
                                  key={t}
                                  type="button"
                                  onClick={() => setTempTime(t)}
                                  className={`py-2 rounded-lg text-xs font-bold border transition-all ${tempTime === t ? 'bg-playbox-accent border-playbox-accent text-white' : 'bg-white/5 border-transparent text-white/60 hover:bg-white/10'}`}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>

                            <button 
                              type="button"
                              onClick={() => {
                                setStartTime(tempTime);
                                setIsTimePickerOpen(false);
                              }}
                              className="w-full py-2.5 bg-playbox-accent text-white font-bold rounded-xl text-xs"
                            >
                              Simpan Jam
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Nama Lengkap */}
                  <div>
                    <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">Nama Lengkap</label>
                    <input 
                      type="text" 
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white text-xs focus:outline-none focus:border-playbox-accent"
                      placeholder="Nama penyewa..."
                      required
                    />
                  </div>

                  {/* No WhatsApp */}
                  <div>
                    <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">No. WhatsApp</label>
                    <input 
                      type="tel" 
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white text-xs focus:outline-none focus:border-playbox-accent"
                      placeholder="0812xxxxxxx"
                      required
                    />
                  </div>
                  
                  {/* Upload KTP */}
                  <div>
                    <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">Upload KTP (Jaminan)</label>
                    <div className="relative">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        required
                      />
                      <div className={`w-full p-3 rounded-xl border flex items-center justify-between transition-colors ${ktpFileName ? 'bg-[#25D366]/10 border-[#25D366]/30 text-[#25D366]' : 'bg-black/30 border-white/10 text-white/50'}`}>
                        <span className="text-xs truncate mr-2">{ktpFileName || 'Pilih Foto KTP...'}</span>
                        <span className="text-sm">{ktpFileName ? '✅' : '📷'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Metode Pengiriman */}
                  <div>
                    <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">Metode Pengiriman</label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className={`flex items-center justify-center p-2.5 rounded-xl border cursor-pointer transition-all ${!requireDelivery ? 'bg-playbox-accent/20 border-playbox-accent text-white' : 'bg-black/30 border-white/5 text-white/50'}`}>
                        <input type="radio" name="delivery" checked={!requireDelivery} onChange={() => setRequireDelivery(false)} className="hidden" />
                        <span className="text-xs font-bold">🏪 Ambil di Toko</span>
                      </label>
                      <label className={`flex items-center justify-center p-2.5 rounded-xl border cursor-pointer transition-all ${requireDelivery ? 'bg-playbox-accent/20 border-playbox-accent text-white' : 'bg-black/30 border-white/5 text-white/50'}`}>
                        <input type="radio" name="delivery" checked={requireDelivery} onChange={() => setRequireDelivery(true)} className="hidden" />
                        <span className="text-xs font-bold">🛵 Diantar (+Ongkir)</span>
                      </label>
                    </div>
                  </div>

                  {/* Alamat Lengkap */}
                  <div>
                    <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">Alamat Lengkap</label>
                    <textarea 
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white text-xs focus:outline-none focus:border-playbox-accent resize-none min-h-[60px]"
                      placeholder="Detail alamat domisili..."
                      required
                    />
                  </div>

                  {/* Pembayaran Toko jika Ambil di Toko */}
                  {!requireDelivery && paymentMethods.length > 0 && (
                    <div className="pt-3 border-t border-white/5 space-y-3">
                      <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider">Transfer Pembayaran ke:</label>
                      <div className="bg-black/40 rounded-xl border border-white/10 p-3 space-y-2">
                        {paymentMethods.map((pm, idx) => (
                          <div key={idx} className="bg-white/5 p-2.5 rounded-lg border border-white/5 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-white">{pm.name}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">{pm.type}</span>
                            </div>
                            <p className="font-mono text-sm font-bold text-playbox-accent mt-0.5">{pm.account}</p>
                            <p className="text-[10px] text-white/50">a.n. {pm.owner}</p>
                          </div>
                        ))}
                      </div>

                      {/* Upload Bukti */}
                      <div>
                        <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">Upload Bukti Transfer</label>
                        <div className="relative">
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={handlePaymentProofUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            required={!requireDelivery}
                          />
                          <div className={`w-full p-3 rounded-xl border flex items-center justify-between transition-colors ${paymentProofFileName ? 'bg-[#25D366]/10 border-[#25D366]/30 text-[#25D366]' : 'bg-black/30 border-white/10 text-white/50'}`}>
                            <span className="text-xs truncate mr-2">{paymentProofFileName || 'Pilih Bukti Transfer...'}</span>
                            <span className="text-sm">{paymentProofFileName ? '✅' : '📷'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Summary Footer */}
                  <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                    <div>
                      <p className="text-[9px] text-white/50 uppercase tracking-wider">Tarif Sewa</p>
                      <p className="text-base font-black text-white">Rp {(selectedUnit.price * (duration / 24)).toLocaleString('id-ID')}</p>
                    </div>
                    {requireDelivery && (
                      <p className="text-[9px] text-playbox-accent font-bold">+ Ongkir Diinfokan Admin</p>
                    )}
                  </div>
                </form>
              </div>
            )}
            
            {/* Modal Footer Button */}
            {!showSuccess && (
              <div className="p-3.5 border-t border-white/5 bg-black/40 backdrop-blur-md">
                <button 
                  type="submit"
                  form="booking-form"
                  disabled={isSubmitting || !customerName || !customerPhone || !ktpFileName || !address || (!requireDelivery && paymentMethods.length > 0 && !paymentProofFileName)}
                  className="w-full py-3.5 bg-playbox-accent text-white rounded-xl font-bold shadow-[0_4px_15px_rgba(226,23,142,0.35)] tracking-wide hover:bg-opacity-90 active:scale-95 transition-all text-xs flex items-center justify-center disabled:opacity-50 disabled:active:scale-100"
                >
                  {isSubmitting ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Memproses...
                    </span>
                  ) : 'Ajukan Booking Sekarang'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Storefront Footer */}
      <footer className="text-center pb-8 opacity-40">
        <p className="text-[10px]">Powered by PlayBox OS</p>
      </footer>
    </div>
  );
}
