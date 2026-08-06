'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';

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
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);

  const [displayShopName, setDisplayShopName] = useState<string>('');

  useEffect(() => {
    const fetchStoreData = () => {
      // Dynamic SaaS Loading: Get settings from mock DB
      const settings = localStorage.getItem('playbox_shop_settings');
      let loadedBrand = '';
      
      if (settings) {
        const parsed = JSON.parse(settings);
        if (parsed.slug === unwrappedParams.shopId) {
          loadedBrand = parsed.brandName;
        }
      }
      
      // Fallback if not found in our "DB", just format the slug nicely
      if (!loadedBrand) {
        loadedBrand = unwrappedParams.shopId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      
      setDisplayShopName(loadedBrand);
      
      // Fetch units
      const savedUnits = localStorage.getItem('playbox_mock_units');
      if (savedUnits) {
        setUnits(JSON.parse(savedUnits));
      } else {
        // Fallback
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

    const handleStorage = (e: StorageEvent) => {
      if (['playbox_mock_units', 'playbox_shop_settings'].includes(e.key || '')) {
        fetchStoreData();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);

  }, [unwrappedParams.shopId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setKtpFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setKtpDataUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaymentProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPaymentProofFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentProofDataUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Create new booking
      const savedBookings = localStorage.getItem('playbox_mock_bookings');
      let bookings = savedBookings ? JSON.parse(savedBookings) : [];
      
      const newId = `B0${new Date().getTime().toString().slice(-4)}`;
      
      const start = startDate && startTime ? new Date(`${startDate}T${startTime}`) : new Date();
      const end = new Date(start.getTime() + duration * 60 * 60 * 1000);

      const newBooking = {
        id: newId,
        code: `INV-${new Date().getTime().toString().slice(-6)}`,
        customer: customerName,
        customerPhone: customerPhone,
        unit: selectedUnit.name,
        unitId: selectedUnit.id,
        status: 'Perlu Verifikasi',
        statusColor: 'bg-yellow-500/15 text-yellow-500',
        time: start.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        date: start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
        isoStart: start.toISOString(),
        isoEnd: end.toISOString(),
        durationHours: duration,
        requireDelivery: requireDelivery,
        deliveryAddress: address,
        deliveryFee: 0, // Akan dihitung oleh admin nanti
        totalPrice: selectedUnit.price * (duration / 24),
        ktpPhoto: ktpDataUrl,
        paymentProof: paymentProofDataUrl,
        needAction: true,
        source: 'Etalase Online',
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
      
      setIsSubmitting(false);
      setShowSuccess(true);
    } catch (error) {
      console.error('Error submitting booking:', error);
      setIsSubmitting(false);
      setShowSuccess(true);
    }
  };

  return (
    <div className="min-h-screen bg-playbox-bg text-playbox-text-primary font-sans relative overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="ambient-glow"></div>
      
      {/* Header */}
      <header className="relative z-10 p-6 pt-10 text-center pb-8 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-playbox-gradient-start to-playbox-gradient-end flex items-center justify-center text-3xl font-black text-white shadow-[0_10px_30px_rgba(226,23,142,0.4)] mb-4 uppercase">
          {displayShopName ? displayShopName.charAt(0) : 'P'}
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white mb-1">{displayShopName}</h1>
        <p className="text-sm text-playbox-text-secondary">Pusat Sewa Konsol Premium</p>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-lg mx-auto p-4 space-y-6 pb-24">
        <div className="flex justify-between items-end mb-2">
          <h2 className="text-lg font-bold text-white tracking-tight">Katalog Unit</h2>
          <span className="text-xs text-white/50">{units.filter(u => u.status === 'Ready').length} Unit Tersedia</span>
        </div>

        <div className="space-y-4">
          {units.map(unit => (
            <div key={unit.id} className="glass-surface rounded-3xl p-4 flex gap-4 overflow-hidden relative group">
              <div className="w-28 h-28 rounded-2xl overflow-hidden shrink-0 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-black/60 mix-blend-overlay z-10"></div>
                <img src={unit.image} alt={unit.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute bottom-2 left-2 right-2 z-20">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full block text-center uppercase tracking-wider backdrop-blur-md ${unit.status === 'Ready' ? 'bg-[#25D366]/20 text-[#25D366]' : 'bg-red-500/20 text-red-400'}`}>
                    {unit.status}
                  </span>
                </div>
              </div>
              
              <div className="flex-1 min-w-0 py-1 flex flex-col">
                <h3 className="font-bold text-base text-white truncate">{unit.name}</h3>
                <div className="flex flex-wrap gap-1 mt-1 mb-2">
                  {unit.specs?.map((spec: string, idx: number) => (
                    <span key={`s-${idx}`} className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/70 border border-white/5">
                      {spec}
                    </span>
                  ))}
                  {unit.games?.map((game: string, idx: number) => (
                    <span key={`g-${idx}`} className="text-[9px] px-1.5 py-0.5 rounded bg-playbox-accent/10 text-playbox-accent border border-playbox-accent/20">
                      {game}
                    </span>
                  ))}
                  {(!unit.specs?.length && !unit.games?.length) && (
                    <span className="text-[11px] text-white/60">{unit.type}</span>
                  )}
                </div>
                
                <div className="mt-auto flex justify-between items-end">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">Sewa 24 Jam</p>
                    <p className="text-sm font-black text-white">Rp {(unit.price || 0).toLocaleString('id-ID')}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedUnit(unit)}
                    disabled={unit.status !== 'Ready'}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      unit.status === 'Ready' 
                      ? 'bg-playbox-accent text-white hover:bg-opacity-90 active:scale-95 shadow-[0_4px_15px_rgba(226,23,142,0.4)]' 
                      : 'bg-white/5 text-white/30 cursor-not-allowed'
                    }`}
                  >
                    {unit.status === 'Ready' ? 'Booking' : 'Tidak Tersedia'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Booking Modal */}
      {selectedUnit && (
        <div className={`fixed inset-0 z-50 max-w-md mx-auto flex justify-center bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300 ${showSuccess ? 'items-center p-4' : 'items-end sm:items-center p-0 sm:p-4'}`}>
          <div className={`w-full max-w-md bg-[#0A0F1F] shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 ${showSuccess ? 'rounded-3xl' : 'rounded-t-3xl sm:rounded-3xl'}`}>
            {/* Modal Header */}
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
              <div>
                <h3 className="font-bold text-lg text-white">Formulir Booking</h3>
                <p className="text-[11px] text-white/60">{selectedUnit.name}</p>
              </div>
              <button 
                onClick={() => {
                  setShowSuccess(false);
                  setSelectedUnit(null);
                  setCustomerName('');
                  setCustomerPhone('');
                  setKtpFileName('');
                  setKtpDataUrl('');
                  setAddress('');
                  setRequireDelivery(false);
                  setDuration(24);
                }}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            {showSuccess ? (
              <div className="p-8 text-center flex-1 overflow-y-auto">
                <div className="flex flex-col items-center justify-center min-h-full pb-4">
                  <div className="w-20 h-20 bg-[#25D366]/20 rounded-full flex items-center justify-center mb-4 border border-[#25D366]/30 animate-bounce shrink-0">
                    <span className="text-4xl">✅</span>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Booking Berhasil!</h2>
                  <p className="text-sm text-white/60 mb-6">Pesanan Anda telah masuk dan sedang menunggu persetujuan admin rental.</p>

                  <button 
                    onClick={() => {
                      setShowSuccess(false);
                      setSelectedUnit(null);
                      setCustomerName('');
                      setCustomerPhone('');
                      setKtpFileName('');
                      setKtpDataUrl('');
                      setPaymentProofFileName('');
                      setPaymentProofDataUrl('');
                      setAddress('');
                      setRequireDelivery(false);
                      setDuration(24);
                    }}
                    className="w-full py-4 mt-2 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold transition-all text-sm"
                  >
                    Tutup & Kembali ke Katalog
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 overflow-y-auto flex-1">
                <form id="booking-form" onSubmit={handleSubmit} className="space-y-4">
                  
                  {/* 1. Durasi Sewa */}
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1.5 ml-1">Durasi Sewa</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[12, 24, 48, 72, 168].map(h => (
                        <button 
                          key={h}
                          type="button"
                          onClick={() => setDuration(h)}
                          className={`p-2 rounded-xl border text-[11px] font-bold transition-all ${duration === h ? 'bg-playbox-accent/20 border-playbox-accent text-playbox-accent' : 'bg-black/40 border-white/5 text-white/60 hover:bg-white/5'}`}
                        >
                          {h === 12 ? '12 Jam' : h === 168 ? '1 Minggu' : `${h/24} Hari`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 1.5 Tanggal & Jam Booking */}
                  <div className="grid grid-cols-2 gap-3 relative">
                    <div>
                      <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1.5 ml-1">Tanggal Sewa</label>
                      <div 
                        onClick={() => { setIsDatePickerOpen(!isDatePickerOpen); setIsTimePickerOpen(false); }}
                        className={`w-full p-4 rounded-xl bg-black/40 border text-sm flex justify-between items-center cursor-pointer transition-all ${isDatePickerOpen ? 'border-playbox-accent shadow-[0_0_10px_rgba(226,23,142,0.2)] text-white' : 'border-white/5 text-white/80'}`}
                      >
                        {startDate ? format(new Date(startDate), 'dd MMM yyyy', { locale: idLocale }) : <span className="text-white/40">Tanggal</span>}
                        <span className="opacity-70">📅</span>
                      </div>
                      
                      {isDatePickerOpen && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                          <div className="p-5 bg-playbox-surface border border-white/10 rounded-3xl shadow-2xl relative max-w-[320px] w-full flex flex-col items-center">
                            <div className="w-full flex justify-between items-center mb-4">
                              <h3 className="text-white font-bold text-sm">Pilih Tanggal</h3>
                              <button type="button" onClick={() => setIsDatePickerOpen(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors">✕</button>
                            </div>
                            <style>{`
                              .rdp { --rdp-cell-size: 38px; --rdp-accent-color: #e2178e; --rdp-background-color: rgba(226,23,142,0.2); margin: 0; }
                              .rdp-day_selected, .rdp-day_selected:focus-visible, .rdp-day_selected:hover { background-color: var(--rdp-accent-color); color: white; font-weight: bold; }
                              .rdp-button:hover:not([disabled]):not(.rdp-day_selected) { background-color: rgba(255,255,255,0.1); }
                              .rdp-day { color: white; }
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
                      <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1.5 ml-1">Jam Mulai</label>
                      <div 
                        onClick={() => { 
                          setTempTime(startTime || '08:00'); 
                          setIsTimePickerOpen(true); 
                          setIsDatePickerOpen(false); 
                        }}
                        className={`w-full p-4 rounded-xl bg-black/40 border text-sm flex justify-between items-center cursor-pointer transition-all ${isTimePickerOpen ? 'border-playbox-accent text-white shadow-[0_0_10px_rgba(226,23,142,0.2)]' : 'border-white/5 text-white/80'}`}
                      >
                        {startTime || <span className="text-white/40">00:00</span>}
                        <span className="opacity-70">⏰</span>
                      </div>
                      
                      {isTimePickerOpen && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                          <div className="bg-playbox-surface p-6 border border-white/10 rounded-3xl shadow-2xl relative max-w-[320px] w-full">
                            <div className="flex justify-between items-center mb-6">
                              <h3 className="text-white font-bold text-sm">Pilih Waktu Sewa</h3>
                              <button type="button" onClick={() => setIsTimePickerOpen(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors">✕</button>
                            </div>
                            
                            {/* Direct Input */}
                            <div className="flex justify-center items-center space-x-3 mb-8">
                              <input 
                                type="text" 
                                maxLength={2} 
                                value={tempTime.split(':')[0]} 
                                onChange={(e) => {
                                   let h = e.target.value.replace(/\D/g, '');
                                   if (parseInt(h) > 23) h = '23';
                                   setTempTime(`${h}:${tempTime.split(':')[1] || '00'}`);
                                }}
                                onBlur={(e) => {
                                   let h = e.target.value;
                                   if (h.length === 1) h = '0' + h;
                                   if (h.length === 0) h = '00';
                                   setTempTime(`${h}:${tempTime.split(':')[1] || '00'}`);
                                }}
                                className="w-20 h-20 bg-black/40 border border-white/5 rounded-2xl text-4xl text-center font-bold text-white focus:border-playbox-accent focus:bg-playbox-accent/10 focus:outline-none transition-all" 
                              />
                              <span className="text-4xl font-bold text-white/30 pb-2">:</span>
                              <input 
                                type="text" 
                                maxLength={2} 
                                value={tempTime.split(':')[1] || '00'} 
                                onChange={(e) => {
                                   let m = e.target.value.replace(/\D/g, '');
                                   if (parseInt(m) > 59) m = '59';
                                   setTempTime(`${tempTime.split(':')[0] || '00'}:${m}`);
                                }}
                                onBlur={(e) => {
                                   let m = e.target.value;
                                   if (m.length === 1) m = '0' + m;
                                   if (m.length === 0) m = '00';
                                   setTempTime(`${tempTime.split(':')[0] || '00'}:${m}`);
                                }}
                                className="w-20 h-20 bg-black/40 border border-white/5 rounded-2xl text-4xl text-center font-bold text-white focus:border-playbox-accent focus:bg-playbox-accent/10 focus:outline-none transition-all" 
                              />
                            </div>

                            {/* Quick Select Grid */}
                            <p className="text-[10px] text-white/40 text-center mb-3 uppercase tracking-widest">Pilih Cepat</p>
                            <div className="grid grid-cols-4 gap-2 mb-6">
                              {['08:00', '10:00', '13:00', '15:00', '17:00', '19:00', '21:00', '23:00'].map(t => (
                                <button 
                                  key={t}
                                  type="button"
                                  onClick={() => setTempTime(t)}
                                  className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${tempTime === t ? 'bg-playbox-accent border-playbox-accent text-white shadow-[0_0_10px_rgba(226,23,142,0.4)]' : 'bg-white/5 border-transparent text-white/60 hover:bg-white/10 hover:text-white'}`}
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
                              className="w-full py-4 bg-gradient-to-r from-playbox-gradient-start to-playbox-accent text-white font-bold rounded-xl shadow-[0_4px_15px_rgba(226,23,142,0.3)] hover:scale-[1.02] transition-transform"
                            >
                              Simpan Jam
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Nama Lengkap */}
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1.5 ml-1">Nama Lengkap</label>
                    <input 
                      type="text" 
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      className="w-full p-4 rounded-xl bg-black/40 border border-white/5 text-white text-sm focus:outline-none focus:border-playbox-accent transition-colors"
                      placeholder="Masukkan nama Anda"
                      required
                    />
                  </div>

                  {/* 3. No WhatsApp */}
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1.5 ml-1">No. WhatsApp</label>
                    <input 
                      type="tel" 
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      className="w-full p-4 rounded-xl bg-black/40 border border-white/5 text-white text-sm focus:outline-none focus:border-playbox-accent transition-colors"
                      placeholder="0812xxxxxx"
                      required
                    />
                  </div>
                  
                  {/* 4. Upload KTP */}
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1.5 ml-1">Upload KTP (Jaminan)</label>
                    <div className="relative">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        required
                      />
                      <div className={`w-full p-4 rounded-xl border flex items-center justify-between transition-colors ${ktpFileName ? 'bg-[#25D366]/10 border-[#25D366]/30 text-[#25D366]' : 'bg-black/40 border-white/5 text-white/50'}`}>
                        <span className="text-sm truncate mr-2">{ktpFileName || 'Pilih Foto KTP...'}</span>
                        <span className="text-lg">{ktpFileName ? '✅' : '📷'}</span>
                      </div>
                    </div>
                  </div>

                  {/* 5. Metode Pengiriman */}
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1.5 ml-1">Metode Pengiriman</label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-all ${!requireDelivery ? 'bg-playbox-accent/20 border-playbox-accent text-white' : 'bg-black/40 border-white/5 text-white/50'}`}>
                        <input type="radio" name="delivery" checked={!requireDelivery} onChange={() => setRequireDelivery(false)} className="hidden" />
                        <span className="text-xl mb-1">🏪</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">Ambil di Toko</span>
                      </label>
                      <label className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-all ${requireDelivery ? 'bg-playbox-accent/20 border-playbox-accent text-white' : 'bg-black/40 border-white/5 text-white/50'}`}>
                        <input type="radio" name="delivery" checked={requireDelivery} onChange={() => setRequireDelivery(true)} className="hidden" />
                        <span className="text-xl mb-1">🛵</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">Diantar (+Ongkir)</span>
                      </label>
                    </div>
                  </div>

                  {/* 6. Alamat Lengkap */}
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1.5 ml-1">Alamat Lengkap (Wajib)</label>
                    <textarea 
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      className="w-full p-4 rounded-xl bg-black/40 border border-white/5 text-white text-sm focus:outline-none focus:border-playbox-accent transition-colors min-h-[80px]"
                      placeholder="Detail alamat domisili..."
                      required
                    />
                  </div>

                  {/* 7. Pembayaran (Hanya jika Ambil di Toko) */}
                  {!requireDelivery && paymentMethods.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-white/5 space-y-4">
                      <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider ml-1">Silakan Transfer DP/Lunas ke:</label>
                      <div className="bg-black/40 rounded-2xl border border-white/10 p-4 text-left">
                        <div className="space-y-4">
                          {paymentMethods.map((pm, idx) => (
                            <div key={idx} className="bg-white/5 p-4 rounded-xl border border-white/5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${pm.type === 'QRIS' ? 'bg-[#25D366]/20 text-[#25D366]' : 'bg-white/10 text-white/70'}`}>
                                {pm.type}
                              </span>
                              <h4 className="font-bold text-white mt-2">{pm.name}</h4>
                              
                              {pm.type === 'QRIS' ? (
                                <div className="mt-2 flex justify-center bg-white p-2 rounded-xl">
                                  <img src={pm.qrisImage} alt="QRIS" className="w-40 h-40 object-contain" />
                                </div>
                              ) : (
                                <p className="font-mono text-lg tracking-widest text-white mt-1">{pm.account}</p>
                              )}
                              <p className="text-xs text-white/60 mt-1">a.n. {pm.owner}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 8. Upload Bukti Transfer */}
                      <div>
                        <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1.5 ml-1">Upload Bukti Transfer</label>
                        <div className="relative">
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={handlePaymentProofUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            required={!requireDelivery}
                          />
                          <div className={`w-full p-4 rounded-xl border flex items-center justify-between transition-colors ${paymentProofFileName ? 'bg-[#25D366]/10 border-[#25D366]/30 text-[#25D366]' : 'bg-black/40 border-white/5 text-white/50'}`}>
                            <span className="text-sm truncate mr-2">{paymentProofFileName || 'Pilih Foto Bukti Transfer...'}</span>
                            <span className="text-lg">{paymentProofFileName ? '✅' : '📷'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-white/50 uppercase tracking-wider mb-0.5">Harga Sewa Unit</p>
                      <p className="text-xl font-black text-white">Rp {(selectedUnit.price * (duration / 24)).toLocaleString('id-ID')}</p>
                      {requireDelivery && (
                        <p className="text-[9px] text-playbox-accent font-bold mt-1">+ Ongkir menyusul (Dihitung Admin)</p>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            )}
            
            {/* Modal Footer */}
            {!showSuccess && (
              <div className="p-4 border-t border-white/5 bg-black/40 backdrop-blur-md">
                <button 
                  type="submit"
                  form="booking-form"
                  disabled={isSubmitting || !customerName || !customerPhone || !ktpFileName || !address || (!requireDelivery && paymentMethods.length > 0 && !paymentProofFileName)}
                  className="w-full py-4 bg-playbox-accent text-white rounded-2xl font-bold shadow-[0_4px_20px_rgba(226,23,142,0.4)] tracking-wide hover:bg-opacity-90 active:scale-95 transition-all text-sm flex items-center justify-center disabled:opacity-50 disabled:active:scale-100"
                >
                  {isSubmitting ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Memproses...
                    </span>
                  ) : 'Ajukan Booking'}
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
