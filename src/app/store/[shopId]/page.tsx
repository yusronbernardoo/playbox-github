'use client';
import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, setDoc, query, where } from 'firebase/firestore';
import { toPng } from 'html-to-image';

export default function StorefrontPage({ params }: { params: Promise<{ shopId: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [selectedTierIndex, setSelectedTierIndex] = useState(0);
  
  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [customerInstagram, setCustomerInstagram] = useState('');
  const [duration, setDuration] = useState(24);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [customTimeInput, setCustomTimeInput] = useState('10:00');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
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
  const [activeBookingsList, setActiveBookingsList] = useState<any[]>([]);

  const [displayShopName, setDisplayShopName] = useState<string>('');
  const [zoomedQris, setZoomedQris] = useState<string | null>(null);
  const [shopProfile, setShopProfile] = useState<{
    brandName?: string;
    phone?: string;
    instagram?: string;
    address?: string;
    bio?: string;
    logo?: string;
  }>({});

  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showSuccess && submittedBooking && invoiceRef.current) {
      // Beri sedikit jeda agar gambar dan font ter-render dengan baik
      const timer = setTimeout(() => {
        toPng(invoiceRef.current as HTMLElement, { backgroundColor: '#ffffff', cacheBust: true, pixelRatio: 2 })
          .then((dataUrl) => {
            const link = document.createElement('a');
            link.download = `Invoice-${submittedBooking.code}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          })
          .catch((err) => {
            console.error('Gagal membuat gambar tagihan', err);
          });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [showSuccess, submittedBooking]);

  // Helper functions for Dynamic Price Tiers
  const getUnitTiers = (unit: any) => {
    if (unit?.priceTiers && Array.isArray(unit.priceTiers) && unit.priceTiers.length > 0) {
      return unit.priceTiers;
    }
    return [{ durationVal: 24, durationUnit: 'Jam', price: unit?.price || 150000 }];
  };

  const getTierHours = (tier: any) => {
    const val = Number(tier?.durationVal) || 24;
    const unit = (tier?.durationUnit || 'Jam').toLowerCase();
    if (unit.includes('bulan')) return val * 720;
    if (unit.includes('minggu')) return val * 168;
    if (unit.includes('hari')) return val * 24;
    return val;
  };

  const getTierLabel = (tier: any) => {
    if (!tier) return '24 Jam';
    return `${tier.durationVal} ${tier.durationUnit || 'Jam'}`;
  };

  const currentTiers = selectedUnit ? getUnitTiers(selectedUnit) : [];
  const activeTier = currentTiers[selectedTierIndex] || currentTiers[0] || { durationVal: 24, durationUnit: 'Jam', price: selectedUnit?.price || 0 };

  // Helper to compress image down to ~30-50KB using Canvas
  const compressImage = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  useEffect(() => {
    // 1. Real-time Shop Profile Listener
    const unsubscribeShop = onSnapshot(doc(db, 'settings', 'shop'), (snap) => {
      let loadedProfile: any = null;
      if (snap.exists()) {
        loadedProfile = snap.data();
      } else {
        const local = localStorage.getItem('playbox_shop_settings');
        if (local) loadedProfile = JSON.parse(local);
      }

      if (loadedProfile) {
        setShopProfile(loadedProfile);
        setDisplayShopName(loadedProfile.brandName || unwrappedParams.shopId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
      } else {
        setDisplayShopName(unwrappedParams.shopId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
      }
    }, (err) => {
      console.warn('Shop profile realtime sync error:', err);
    });

    // 2. Real-time Units & Active Bookings Listener
    let activeBusyKeys = new Set<string>();
    let rawUnitsList: any[] = [];

    const updateCombinedUnits = (unitsData: any[]) => {
      return unitsData.map(u => {
        if (u.status === 'Maintenance') return u;
        const isBusy = activeBusyKeys.has(u.id) || activeBusyKeys.has(u.name);
        return {
          ...u,
          status: isBusy ? 'Disewa' : (u.status || 'Ready')
        };
      });
    };

    const unsubscribeUnits = onSnapshot(collection(db, 'units'), (snapshot) => {
      if (!snapshot.empty) {
        const liveUnits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        rawUnitsList = liveUnits;
        setUnits(updateCombinedUnits(liveUnits));
        localStorage.setItem('playbox_mock_units', JSON.stringify(liveUnits));
      } else {
        const savedUnits = localStorage.getItem('playbox_mock_units');
        if (savedUnits) {
          try {
            const parsed = JSON.parse(savedUnits);
            rawUnitsList = parsed;
            setUnits(updateCombinedUnits(parsed));
          } catch {}
        } else {
          rawUnitsList = [];
          setUnits([]);
        }
      }
    });

    // 2. Real-time Units & Active Bookings Listener
    // OPTIMIZED: Only fetch active bookings so it loads instantly!
    const activeBookingsQuery = query(
      collection(db, 'bookings'),
      where('status', 'in', ['Perlu Verifikasi', 'Menunggu Pembayaran', 'Disewa'])
    );
    
    const unsubscribeBookings = onSnapshot(activeBookingsQuery, (snapshot) => {
      const activeBookings = snapshot.docs.map(doc => doc.data());
      setActiveBookingsList(activeBookings);
      
      activeBusyKeys = new Set(
        activeBookings.flatMap((b: any) => [b.unitId, b.unit].filter(Boolean))
      );

      if (rawUnitsList.length > 0) {
        setUnits(updateCombinedUnits(rawUnitsList));
      }
    });

    // 3. Real-time Payment Methods Listener
    const unsubscribePayments = onSnapshot(doc(db, 'settings', 'payments'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.list)) {
          setPaymentMethods(data.list.filter((p: any) => p.active));
          localStorage.setItem('playbox_payments', JSON.stringify(data.list));
          return;
        }
      }

      const savedPayments = localStorage.getItem('playbox_payments');
      if (savedPayments) {
        try {
          const parsed = JSON.parse(savedPayments);
          setPaymentMethods(parsed.filter((p: any) => p.active));
        } catch (e) {
          console.error(e);
        }
      }
    });

    return () => {
      unsubscribeShop();
      unsubscribeUnits();
      unsubscribeBookings();
      unsubscribePayments();
    };
  }, [unwrappedParams.shopId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setKtpFileName(file.name);
      try {
        const compressed = await compressImage(file, 900, 900, 0.8);
        setKtpDataUrl(compressed);
      } catch (err) {
        console.error('Error compressing KTP:', err);
      }
    }
  };

  const handlePaymentProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setPaymentProofFileName(file.name);
      try {
        const compressed = await compressImage(file, 900, 900, 0.8);
        setPaymentProofDataUrl(compressed);
      } catch (err) {
        console.error('Error compressing proof:', err);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit || !customerName || !customerPhone || !emergencyPhone || !ktpDataUrl || !address) {
      alert('Mohon lengkapi semua formulir, kontak darurat, dan upload foto KTP!');
      return;
    }

    // Cek apakah nomor HP sudah ada di booking aktif
    if (activeBookingsList.some(b => b.customerPhone === customerPhone)) {
      alert('Nomor ini masih memiliki sewa aktif! Mohon selesaikan sewa sebelumnya.');
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
      
      const newId = `B0${Date.now().toString().slice(-4)}`;
      const randomInv = Math.floor(100000 + Math.random() * 900000);
      const invoiceCode = `INV-${randomInv}`;

      const activeHours = getTierHours(activeTier);
      const calculatedTotalPrice = Number(activeTier.price || selectedUnit.price || 0);

      const formattedStartDate = format(new Date(startDate), 'yyyy-MM-dd');
      const isoStartDateTime = `${formattedStartDate}T${startTime}:00`;
      const startDateTimeObj = new Date(isoStartDateTime);
      const endDateTimeObj = new Date(startDateTimeObj.getTime() + activeHours * 60 * 60 * 1000);
      const isoEndDateTime = endDateTimeObj.toISOString();

      const tierLabel = getTierLabel(activeTier);
      const timeDisplay = `${formattedStartDate}, ${startTime} (${tierLabel})`;

      const newBooking = {
        id: newId,
        code: invoiceCode,
        customer: customerName,
        customerPhone: customerPhone,
        emergencyPhone: emergencyPhone,
        instagram: customerInstagram,
        unit: selectedUnit.name,
        unitId: selectedUnit.id,
        time: timeDisplay,
        date: formattedStartDate,
        startDate: formattedStartDate,
        startTime: isoStartDateTime,
        endTime: isoEndDateTime,
        isoStart: isoStartDateTime,
        isoEnd: isoEndDateTime,
        duration: activeHours,
        durationHours: activeHours,
        durationLabel: tierLabel,
        status: 'Perlu Verifikasi',
        statusColor: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20',
        paymentStatus: 'Belum Lunas',
        deliveryStatus: requireDelivery ? 'Diantar (+Ongkir)' : 'Ambil di Toko',
        requireDelivery: requireDelivery,
        address: address,
        deliveryAddress: address,
        totalPrice: calculatedTotalPrice,
        unitPrice: calculatedTotalPrice,
        deliveryFee: 0,
        ktpPhoto: ktpDataUrl,
        ktpUrl: ktpDataUrl,
        documents: [{ title: 'KTP Asli', file: ktpDataUrl }],
        paymentProof: paymentProofDataUrl || null,
        paymentProofUrl: paymentProofDataUrl || null,
        needAction: true,
        fines: null,
        createdAt: new Date().toISOString()
      };

      // 1. Simpan ke Cloud Firestore (Real-Time)
      try {
        await setDoc(doc(db, 'bookings', newId), newBooking);
      } catch (err) {
        console.error('Gagal sync booking ke Firestore:', err);
      }

      // 2. Simpan juga ke localStorage
      bookings.unshift(newBooking);
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
    setSelectedTierIndex(0);
    setSubmittedBooking(null);
    setCustomerName('');
    setCustomerPhone('');
    setEmergencyPhone('');
    setCustomerInstagram('');
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
      {/* Ambient Background Glow */}
      <div className="ambient-glow"></div>
      
      {/* Header */}
      <header className="relative z-10 p-5 pt-8 text-center pb-6 border-b border-white/5 bg-black/30 backdrop-blur-md">
        
        {/* Custom Logo / Avatar */}
        <div className="w-20 h-20 mx-auto rounded-3xl bg-black/40 border border-white/15 flex items-center justify-center shadow-[0_10px_30px_rgba(37,99,235,0.3)] mb-3 overflow-hidden">
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
          <p className="text-[11px] text-white/70 flex items-center justify-center mb-3.5 px-4 font-medium">
            <span className="mr-1 text-sm">📍</span> {shopProfile.address}
          </p>
        )}

        {/* Contact Buttons (WA CS & Instagram) */}
        <div className="flex items-center justify-center gap-2.5 flex-wrap">
          {shopProfile.phone && (
            <button 
              onClick={() => {
                let p = shopProfile.phone || '';
                if (p.startsWith('0')) p = '62' + p.substring(1);
                window.open(`https://wa.me/${p}?text=${encodeURIComponent(`Halo ${displayShopName}, saya ingin bertanya seputar sewa konsol PlayStation.`)}`, '_blank');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#25D366]/20 border border-[#25D366]/40 text-[#25D366] text-xs font-bold hover:bg-[#25D366]/30 active:scale-95 transition-all shadow-[0_0_15px_rgba(37,211,102,0.15)]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
              </svg>
              WhatsApp CS
            </button>
          )}

          {shopProfile.instagram && (
            <button 
              onClick={() => {
                const ig = shopProfile.instagram?.replace(/^@/, '').trim();
                window.open(`https://instagram.com/${ig}`, '_blank');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-400 text-xs font-bold hover:bg-pink-500/30 active:scale-95 transition-all shadow-[0_0_15px_rgba(37,99,235,0.15)]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.927 3.927 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.926 3.926 0 0 0-.923-1.417A3.911 3.911 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0h.003zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.036 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.478 2.478 0 0 1-.92-.598 2.48 2.48 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217zm0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334z"/>
              </svg>
              Instagram
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-lg mx-auto p-4 space-y-5 pb-24">
        <div className="flex justify-between items-end mb-1">
          <h2 className="text-base font-bold text-white tracking-tight">Katalog Unit PlayStation</h2>
          <span className="text-[11px] text-white/60 font-semibold">{units.filter(u => u.status === 'Ready').length} Unit Tersedia</span>
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
                      <span key={`s-${idx}`} className="text-[8px] px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-medium">
                        {spec}
                      </span>
                    ))}
                    {unit.games?.slice(0, 2).map((game: string, idx: number) => (
                      <span key={`g-${idx}`} className="text-[8px] px-1.5 py-0.5 rounded bg-playbox-accent/10 text-playbox-accent border border-playbox-accent/20 font-medium">
                        {game}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-between items-end mt-2 pt-1 border-t border-white/5">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-white/40 font-semibold">Mulai Dari</p>
                    <p className="text-xs font-black text-white">
                      Rp {Number(unit.priceTiers?.[0]?.price || unit.price || 0).toLocaleString('id-ID')}
                      <span className="text-[9px] font-normal text-white/50 ml-1">
                        / {unit.priceTiers?.[0]?.durationVal ? `${unit.priceTiers[0].durationVal} ${unit.priceTiers[0].durationUnit || 'Jam'}` : '24j'}
                      </span>
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedUnit(unit);
                      setSelectedTierIndex(0);
                    }}
                    disabled={unit.status !== 'Ready'}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      unit.status === 'Ready' 
                      ? 'bg-playbox-accent text-white hover:bg-opacity-90 active:scale-95 shadow-[0_4px_12px_rgba(37,99,235,0.35)]' 
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
        <div className={`fixed inset-0 z-50 max-w-md mx-auto flex justify-center bg-black/75 backdrop-blur-sm transition-opacity duration-300 ${showSuccess ? 'items-center p-4' : 'items-end sm:items-center p-0 sm:p-4'}`}>
          <div className={`w-full max-w-md bg-[#0D1122] shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[92vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 ${showSuccess ? 'rounded-3xl' : 'rounded-t-3xl sm:rounded-3xl'}`}>
            
            {/* Modal Header */}
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div>
                <h3 className="font-bold text-base text-white">{showSuccess ? 'Status Pemesanan' : 'Formulir Booking'}</h3>
                <p className="text-xs text-playbox-accent font-semibold">{selectedUnit.name}</p>
              </div>
              <button 
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 transition-colors text-sm"
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
                  <p className="text-xs text-white/70 mt-1 max-w-xs mx-auto">
                    Pesanan Anda telah masuk ke sistem kami dan sedang menunggu persetujuan admin rental.
                  </p>
                </div>

                {/* Booking Summary */}
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
                    <div className="flex justify-between">
                      <span className="text-white/50">Pengiriman:</span>
                      <span className="font-medium text-white">{submittedBooking.deliveryStatus}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-white/10">
                      <span className="text-white/70 font-semibold">Total Biaya Unit:</span>
                      <span className="font-black text-playbox-accent text-sm">Rp {submittedBooking.totalPrice?.toLocaleString('id-ID')}</span>
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
                  
                  {/* Durasi Sewa Dinamis dari Price Tiers */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[10px] font-bold text-white/70 uppercase tracking-wider">Pilihan Durasi Sewa</label>
                      <span className="text-[10px] text-playbox-accent font-bold">Pilih Paket</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {currentTiers.map((t: any, idx: number) => {
                        const isSelected = selectedTierIndex === idx;
                        return (
                          <button 
                            key={idx}
                            type="button"
                            onClick={() => setSelectedTierIndex(idx)}
                            className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                              isSelected 
                                ? 'bg-playbox-accent/20 border-playbox-accent text-white shadow-[0_0_15px_rgba(37,99,235,0.35)] ring-1 ring-playbox-accent' 
                                : 'bg-black/30 border-white/10 text-white/70 hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-bold ${isSelected ? 'text-playbox-accent' : 'text-white'}`}>
                                ⏱️ {getTierLabel(t)}
                              </span>
                              {isSelected && <span className="text-[10px] text-playbox-accent font-bold">✔️</span>}
                            </div>
                            <p className="text-xs font-black text-playbox-ready mt-1.5">
                              Rp {Number(t.price || 0).toLocaleString('id-ID')}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tanggal & Jam Mulai */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1">Tanggal Mulai</label>
                      <div 
                        onClick={() => { setIsDatePickerOpen(!isDatePickerOpen); setIsTimePickerOpen(false); }}
                        className={`w-full p-3 rounded-xl bg-black/30 border text-xs flex justify-between items-center cursor-pointer transition-all ${isDatePickerOpen ? 'border-playbox-accent text-white' : 'border-white/10 text-white/80'}`}
                      >
                        <span className="truncate font-semibold">{startDate ? format(new Date(startDate), 'dd MMM yyyy', { locale: idLocale }) : 'Pilih Tanggal'}</span>
                        <span className="opacity-70 text-xs">📅</span>
                      </div>
                      
                      {isDatePickerOpen && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                          <div className="p-4 bg-playbox-surface border border-white/10 rounded-2xl shadow-2xl relative max-w-[300px] w-full flex flex-col items-center">
                            <div className="w-full flex justify-between items-center mb-3">
                              <h3 className="text-white font-bold text-xs">Pilih Tanggal Sewa</h3>
                              <button type="button" onClick={() => setIsDatePickerOpen(false)} className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-white/50 text-xs">✕</button>
                            </div>
                            <style>{`
                              .rdp { --rdp-cell-size: 34px; --rdp-accent-color: #2563eb; --rdp-background-color: rgba(37,99,235,0.2); margin: 0; }
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
                      <label className="block text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1">Jam Mulai</label>
                      <div 
                        onClick={() => { 
                          setCustomTimeInput(startTime || '10:00');
                          setIsTimePickerOpen(true); 
                          setIsDatePickerOpen(false); 
                        }}
                        className={`w-full p-3 rounded-xl bg-black/30 border text-xs flex justify-between items-center cursor-pointer transition-all ${isTimePickerOpen ? 'border-playbox-accent text-white' : 'border-white/10 text-white/80'}`}
                      >
                        <span className="font-semibold">{startTime ? `${startTime} WIB` : 'Pilih Jam'}</span>
                        <span className="opacity-70 text-xs">⏰</span>
                      </div>
                      
                      {isTimePickerOpen && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
                          <div className="p-6 bg-[#161B30] border border-white/10 rounded-3xl shadow-2xl relative max-w-[320px] w-full space-y-5">
                            {/* Header */}
                            <div className="flex justify-between items-center">
                              <h3 className="text-white font-bold text-sm">Pilih Waktu Sewa</h3>
                              <button 
                                type="button" 
                                onClick={() => setIsTimePickerOpen(false)} 
                                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors text-xs"
                              >
                                ✕
                              </button>
                            </div>

                            {/* Direct Input (Big Display Boxes) */}
                            <div className="flex justify-center items-center space-x-3 my-2">
                              <input 
                                type="text" 
                                maxLength={2} 
                                value={(customTimeInput || '08:00').split(':')[0] || '08'} 
                                onChange={(e) => {
                                  let val = e.target.value.replace(/\D/g, '');
                                  if (parseInt(val) > 23) val = '23';
                                  const mins = (customTimeInput || '08:00').split(':')[1] || '00';
                                  setCustomTimeInput(`${val}:${mins}`);
                                }}
                                onBlur={(e) => {
                                  let val = e.target.value.padStart(2, '0');
                                  if (!val || val === '000') val = '08';
                                  if (parseInt(val) > 23) val = '23';
                                  const mins = (customTimeInput || '08:00').split(':')[1] || '00';
                                  setCustomTimeInput(`${val}:${mins}`);
                                }}
                                className="w-20 h-20 bg-[#0E1326] border border-white/10 rounded-2xl text-4xl text-center font-extrabold text-white focus:border-playbox-accent focus:bg-playbox-accent/10 focus:outline-none transition-all shadow-inner" 
                              />
                              <span className="text-4xl font-extrabold text-white/30 pb-1">:</span>
                              <input 
                                type="text" 
                                maxLength={2} 
                                value={(customTimeInput || '08:00').split(':')[1] || '00'} 
                                onChange={(e) => {
                                  let val = e.target.value.replace(/\D/g, '');
                                  if (parseInt(val) > 59) val = '59';
                                  const hrs = (customTimeInput || '08:00').split(':')[0] || '08';
                                  setCustomTimeInput(`${hrs}:${val}`);
                                }}
                                onBlur={(e) => {
                                  let val = e.target.value.padStart(2, '0');
                                  if (!val || val === '000') val = '00';
                                  if (parseInt(val) > 59) val = '59';
                                  const hrs = (customTimeInput || '08:00').split(':')[0] || '08';
                                  setCustomTimeInput(`${hrs}:${val}`);
                                }}
                                className="w-20 h-20 bg-[#0E1326] border border-white/10 rounded-2xl text-4xl text-center font-extrabold text-white focus:border-playbox-accent focus:bg-playbox-accent/10 focus:outline-none transition-all shadow-inner" 
                              />
                            </div>

                            {/* Section: PILIH CEPAT */}
                            <div>
                              <p className="text-[10px] text-white/40 text-center mb-3 uppercase font-bold tracking-[0.2em]">Pilih Cepat</p>
                              <div className="grid grid-cols-4 gap-2">
                                {['08:00', '10:00', '13:00', '15:00', '17:00', '19:00', '21:00', '23:00'].map(t => {
                                  const isSelected = (customTimeInput || '08:00') === t;
                                  return (
                                    <button 
                                      key={t}
                                      type="button"
                                      onClick={() => setCustomTimeInput(t)}
                                      className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                                        isSelected 
                                          ? 'bg-playbox-accent text-white shadow-[0_4px_15px_rgba(37,99,235,0.4)] scale-105' 
                                          : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
                                      }`}
                                    >
                                      {t}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Tombol Simpan Jam */}
                            <button 
                              type="button"
                              onClick={() => {
                                const parts = (customTimeInput || '08:00').split(':');
                                const h = (parts[0] || '08').padStart(2, '0');
                                const m = (parts[1] || '00').padStart(2, '0');
                                const finalTime = `${h}:${m}`;
                                setStartTime(finalTime);
                                setCustomTimeInput(finalTime);
                                setIsTimePickerOpen(false);
                              }}
                              className="w-full py-4 bg-gradient-to-r from-[#2563eb] via-pink-600 to-purple-600 hover:opacity-95 text-white font-bold rounded-2xl text-sm shadow-[0_4px_20px_rgba(37,99,235,0.35)] active:scale-95 transition-all"
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
                    <label className="block text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1">Nama Lengkap</label>
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
                    <label className="block text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1">No. WhatsApp</label>
                    <input 
                      type="tel" 
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white text-xs focus:outline-none focus:border-playbox-accent"
                      placeholder="Contoh: 081234567890"
                      required
                    />
                  </div>

                  {/* No Darurat */}
                  <div>
                    <label className="block text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1">No. HP Darurat (Wajib)</label>
                    <input 
                      type="tel" 
                      value={emergencyPhone}
                      onChange={e => setEmergencyPhone(e.target.value)}
                      className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white text-xs focus:outline-none focus:border-playbox-accent"
                      placeholder="Keluarga / Kerabat dekat..."
                      required
                    />
                  </div>

                  {/* Instagram */}
                  <div>
                    <label className="block text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1">Username Instagram (Opsional)</label>
                    <input 
                      type="text" 
                      value={customerInstagram}
                      onChange={e => setCustomerInstagram(e.target.value)}
                      className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white text-xs focus:outline-none focus:border-playbox-accent"
                      placeholder="@username"
                    />
                  </div>
                  
                  {/* Upload KTP */}
                  <div>
                    <label className="block text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1">Upload KTP (Jaminan Wajib)</label>
                    <div className="relative">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        required
                      />
                      <div className={`w-full p-3 rounded-xl border flex items-center justify-between transition-colors ${ktpFileName ? 'bg-[#25D366]/10 border-[#25D366]/30 text-[#25D366]' : 'bg-black/30 border-white/10 text-white/50'}`}>
                        <span className="text-xs truncate mr-2 font-medium">{ktpFileName || 'Pilih Foto KTP / Kartu Identitas...'}</span>
                        <span className="text-sm">{ktpFileName ? '✅' : '📷'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Metode Pengiriman (JELAS & PROMINENT) */}
                  <div>
                    <label className="block text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1.5">Metode Pengambilan Unit</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRequireDelivery(false)}
                        className={`p-3 rounded-2xl border flex flex-col items-center justify-center text-center transition-all ${
                          !requireDelivery 
                            ? 'bg-playbox-accent/20 border-playbox-accent text-white shadow-md' 
                            : 'bg-black/30 border-white/10 text-white/50 hover:bg-white/5'
                        }`}
                      >
                        <span className="text-lg mb-1">🏪</span>
                        <span className="text-xs font-bold">Ambil di Toko</span>
                        <span className="text-[9px] text-white/50 mt-0.5">Gratis / Ambil Sendiri</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRequireDelivery(true)}
                        className={`p-3 rounded-2xl border flex flex-col items-center justify-center text-center transition-all ${
                          requireDelivery 
                            ? 'bg-playbox-accent/20 border-playbox-accent text-white shadow-md' 
                            : 'bg-black/30 border-white/10 text-white/50 hover:bg-white/5'
                        }`}
                      >
                        <span className="text-lg mb-1">🛵</span>
                        <span className="text-xs font-bold">Antar - Jemput</span>
                        <span className="text-[9px] text-playbox-accent font-semibold mt-0.5">+ Ongkir (Dihitung Admin)</span>
                      </button>
                    </div>
                  </div>

                  {/* Alamat Lengkap */}
                  <div>
                    <label className="block text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1">
                      {requireDelivery ? 'Alamat Lengkap Pengiriman' : 'Alamat Domisili'}
                    </label>
                    <textarea 
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white text-xs focus:outline-none focus:border-playbox-accent resize-none min-h-[60px]"
                      placeholder={requireDelivery ? "Sebutkan jalan, nomor rumah, patokan..." : "Alamat sesuai domisili tempat tinggal..."}
                      required
                    />
                  </div>

                  {/* Pembayaran Toko jika Ambil di Toko */}
                  {!requireDelivery && paymentMethods.length > 0 && (
                    <div className="pt-3 border-t border-white/10 space-y-3">
                      <label className="block text-[10px] font-bold text-white/70 uppercase tracking-wider">Transfer Pembayaran / QRIS Toko:</label>
                      <div className="space-y-2.5">
                        {paymentMethods.map(p => (
                          <div key={p.id} className="p-3 bg-black/40 border border-white/10 rounded-2xl flex justify-between items-center text-xs gap-3">
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              {p.type === 'QRIS' && p.qrisImage ? (
                                <div 
                                  onClick={() => setZoomedQris(p.qrisImage)}
                                  className="w-12 h-12 bg-white rounded-xl p-1 flex-shrink-0 cursor-pointer shadow hover:scale-105 transition-transform"
                                >
                                  <img src={p.qrisImage} alt="QRIS" className="w-full h-full object-contain" />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-base flex-shrink-0">
                                  {p.type === 'E-Wallet' ? '📱' : '🏦'}
                                </div>
                              )}
                              <div className="truncate">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold text-white truncate">{p.name}</p>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${p.type === 'QRIS' ? 'bg-[#25D366]/20 text-[#25D366]' : 'bg-white/10 text-white/60'}`}>{p.type}</span>
                                </div>
                                <p className="text-[10px] text-white/50 truncate">a.n {p.owner}</p>
                              </div>
                            </div>

                            {p.type === 'QRIS' && p.qrisImage ? (
                              <button 
                                type="button"
                                onClick={() => setZoomedQris(p.qrisImage)}
                                className="px-3 py-1.5 bg-[#25D366]/20 border border-[#25D366]/40 text-[#25D366] rounded-xl font-bold text-[10px] flex items-center gap-1 hover:bg-[#25D366]/30 transition-all flex-shrink-0"
                              >
                                🔍 Scan QRIS
                              </button>
                            ) : (
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="font-mono font-bold text-playbox-accent bg-playbox-accent/10 px-2 py-1 rounded border border-playbox-accent/20 text-xs select-all">{p.account}</span>
                                <button 
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(p.account);
                                    alert(`Nomor rekening ${p.name} (${p.account}) berhasil disalin!`);
                                  }}
                                  title="Salin Nomor"
                                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-[10px] transition-colors"
                                >
                                  📋
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Upload Bukti Transfer */}
                      <div>
                        <label className="block text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1">Upload Bukti Transfer (Opsional)</label>
                        <div className="relative">
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handlePaymentProofUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <div className={`w-full p-3 rounded-xl border flex items-center justify-between transition-colors ${paymentProofFileName ? 'bg-[#25D366]/10 border-[#25D366]/30 text-[#25D366]' : 'bg-black/30 border-white/10 text-white/50'}`}>
                            <span className="text-xs truncate mr-2 font-medium">{paymentProofFileName || 'Pilih Foto Bukti Transfer...'}</span>
                            <span className="text-sm">{paymentProofFileName ? '✅' : '📄'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rincian Biaya Transparan */}
                  <div className="p-3.5 bg-black/40 border border-white/10 rounded-2xl flex justify-between items-center shadow-inner">
                    <div>
                      <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider block">Total Biaya Unit</span>
                      <p className="text-xs text-white/90 font-bold mt-0.5">Paket {getTierLabel(activeTier)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black text-playbox-ready">Rp {Number(activeTier.price || 0).toLocaleString('id-ID')}</p>
                      {requireDelivery && <p className="text-[9px] text-playbox-accent font-semibold">+ Ongkir dihitung admin</p>}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-1">
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-4 bg-playbox-accent text-white font-bold rounded-2xl shadow-[0_4px_20px_rgba(37,99,235,0.4)] hover:bg-opacity-90 transition-all active:scale-95 text-xs flex items-center justify-center gap-1.5"
                    >
                      {isSubmitting ? 'Memproses Booking...' : `Konfirmasi Booking (${getTierLabel(activeTier)} - Rp ${Number(activeTier.price || 0).toLocaleString('id-ID')}) →`}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QRIS Zoom Modal for Customer */}
      {zoomedQris && (
        <div 
          onClick={() => setZoomedQris(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-200"
        >
          <div className="bg-white p-5 rounded-3xl max-w-sm w-full shadow-2xl text-center space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="text-black font-extrabold text-base">Barcode QRIS Pembayaran</h3>
              <p className="text-xs text-black/60 mt-0.5">Scan langsung melalui BCA, GoPay, DANA, OVO, ShopeePay</p>
            </div>
            <div className="w-full aspect-square bg-white rounded-2xl overflow-hidden flex items-center justify-center p-2 border border-black/10 shadow-inner">
              <img src={zoomedQris} alt="QRIS" className="w-full h-full object-contain" />
            </div>
            <button 
              onClick={() => setZoomedQris(null)}
              className="w-full py-3 bg-black text-white font-bold rounded-xl text-xs hover:bg-zinc-800 transition-all shadow-md"
            >
              Tutup QRIS
            </button>
          </div>
        </div>
      )}

      {/* Komponen Invoice Rahasia (Untuk Download) */}
      {showSuccess && submittedBooking && (
        <div className="absolute top-[-9999px] left-[-9999px]">
          <div ref={invoiceRef} className="w-[480px] bg-white text-black p-8 font-sans">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-black">{displayShopName || 'Playbox Rental'}</h1>
              <p className="text-sm text-gray-500">INVOICE PENYEWAAN</p>
            </div>
            
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <div>
                <p className="text-xs text-gray-500">Kode Invoice</p>
                <p className="font-bold">{submittedBooking.code}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Tanggal Booking</p>
                <p className="font-bold">{format(new Date(submittedBooking.createdAt), 'dd MMM yyyy')}</p>
              </div>
            </div>

            <div className="mb-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Penyewa:</span>
                <span className="font-bold">{submittedBooking.customer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">No. HP:</span>
                <span className="font-bold">{submittedBooking.customerPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Unit:</span>
                <span className="font-bold text-blue-600">{submittedBooking.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Durasi:</span>
                <span className="font-bold">{submittedBooking.durationLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Mulai:</span>
                <span className="font-bold">{format(new Date(submittedBooking.isoStart), 'dd MMM yyyy, HH:mm')}</span>
              </div>
            </div>

            <div className="border-t border-gray-200 py-4 mb-4">
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
                <span className="font-bold">Total Tagihan</span>
                <span className="text-xl font-black text-green-600">Rp {Number(submittedBooking.totalPrice).toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* QRIS Section */}
            {paymentMethods.filter(p => p.type === 'QRIS' && p.qrisImage).length > 0 && (
              <div className="text-center mt-6 p-4 border rounded-xl bg-gray-50">
                <p className="font-bold text-sm mb-3">Scan QRIS untuk Pembayaran</p>
                <div className="w-48 h-48 mx-auto bg-white p-2 border rounded-xl shadow-sm flex items-center justify-center overflow-hidden">
                  <img src={paymentMethods.find(p => p.type === 'QRIS' && p.qrisImage)?.qrisImage} alt="QRIS" className="w-full h-full object-contain" crossOrigin="anonymous" />
                </div>
                <p className="text-xs text-gray-500 mt-3">Silakan bayar menggunakan Gopay, OVO, Dana, ShopeePay, atau BCA Mobile.</p>
              </div>
            )}
            
            {!paymentMethods.some(p => p.type === 'QRIS' && p.qrisImage) && paymentMethods.length > 0 && (
              <div className="mt-4 p-4 border rounded-xl bg-gray-50">
                <p className="font-bold text-sm mb-2 text-center">Rekening Pembayaran</p>
                {paymentMethods.map(p => (
                  <div key={p.id} className="text-sm flex justify-between border-b last:border-0 py-2">
                    <span className="text-gray-600">{p.name}</span>
                    <span className="font-bold">{p.account} (a.n {p.owner})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
