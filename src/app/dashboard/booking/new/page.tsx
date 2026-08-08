'use client';
import { getStoreId, getTenantStorageKey } from '@/lib/tenant';
import { useState, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, updateDoc, collection, onSnapshot } from 'firebase/firestore';

export default function NewBooking() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Form State
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedTierIndex, setSelectedTierIndex] = useState<number>(0);
  
  const [schedule, setSchedule] = useState({ date: '', time: '', duration: 24, durationType: 'Jam' as 'Jam' | 'Hari' | 'Minggu' | 'Bulan' });
  
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '', requireDelivery: false, instagram: '', emergencyPhone: '', guaranteeType: 'KTP' });
  const [blacklistedCustomer, setBlacklistedCustomer] = useState<any>(null);

  useEffect(() => {
    const checkBlacklist = async () => {
      const cleanPhone = customer.phone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        try {
          const docRef = doc(db, 'stores', getStoreId(), 'customers', cleanPhone);
          const snap = await getDoc(docRef);
          if (snap.exists() && snap.data().isBlacklisted) {
            setBlacklistedCustomer(snap.data());
          } else {
            setBlacklistedCustomer(null);
          }
        } catch (e) {
          console.error("Error checking blacklist:", e);
        }
      } else {
        setBlacklistedCustomer(null);
      }
    };
    const timer = setTimeout(checkBlacklist, 500);
    return () => clearTimeout(timer);
  }, [customer.phone]);
  const [deliveryFee, setDeliveryFee] = useState('');
  const [deliveryDistance, setDeliveryDistance] = useState('');
  const [deliveryRules, setDeliveryRules] = useState<{minKm: number, maxKm: number, fee: number}[]>([]);
  const [matchedRuleText, setMatchedRuleText] = useState('');
  
  const [documents, setDocuments] = useState<{title: string, file: string | null}[]>([
    { title: 'KTP Asli', file: null }
  ]);
  
  const [payment, setPayment] = useState({ method: 'Transfer Bank', deposit: '', cashReceived: '' });
  
  // Custom Dropdown States
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [availableUnits, setAvailableUnits] = useState<any[]>([]);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<any[]>([]);

  useEffect(() => {
    // 1. Fallback local units
    const saved = localStorage.getItem(getTenantStorageKey('playbox_mock_units'));
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setAvailableUnits(parsed.filter((u: any) => u.status === 'Ready'));
      } catch {}
    }

    // 2. Real-time Firestore units listener
    const unsubUnits = onSnapshot(collection(db, 'stores', getStoreId(), 'units'), (snap) => {
      if (!snap.empty) {
        const cloudUnits: any[] = [];
        snap.forEach(d => {
          cloudUnits.push({ ...d.data(), id: d.id });
        });
        localStorage.setItem(getTenantStorageKey('playbox_mock_units'), JSON.stringify(cloudUnits));
        setAvailableUnits(cloudUnits.filter(u => u.status === 'Ready'));
      }
    });

    const savedRules = localStorage.getItem('playbox_delivery_rules');
    if (savedRules) {
      setDeliveryRules(JSON.parse(savedRules));
    } else {
      const defaultRules = [
        { minKm: 0, maxKm: 5, fee: 0 },
        { minKm: 6, maxKm: 10, fee: 10000 },
        { minKm: 11, maxKm: 15, fee: 20000 },
        { minKm: 16, maxKm: 999, fee: 50000 }
      ];
      setDeliveryRules(defaultRules);
      localStorage.setItem('playbox_delivery_rules', JSON.stringify(defaultRules));
    }

    const savedPayments = localStorage.getItem(getTenantStorageKey('playbox_payments'));
    if (savedPayments) {
      setSavedPaymentMethods(JSON.parse(savedPayments).filter((p: any) => p.active));
    }

    return () => unsubUnits();
  }, []);

  useEffect(() => {
    if (!deliveryDistance) {
      if (matchedRuleText !== 'Promo: Free Ongkir') {
        setDeliveryFee('');
        setMatchedRuleText('');
      }
      return;
    }
    const km = parseFloat(deliveryDistance);
    if (isNaN(km)) return;

    let matchedFee = -1;
    let ruleFound = false;

    for (const rule of deliveryRules) {
      if (km >= rule.minKm && km <= rule.maxKm) {
        matchedFee = rule.fee;
        setMatchedRuleText(`Sesuai Ketentuan: ${rule.maxKm === 999 ? '> ' + (rule.minKm - 1) : rule.minKm + ' - ' + rule.maxKm} km = Rp ${rule.fee.toLocaleString('id-ID')}`);
        ruleFound = true;
        break;
      }
    }

    if (!ruleFound && deliveryRules.length > 0) {
      const maxRule = deliveryRules[deliveryRules.length - 1];
      matchedFee = maxRule.fee;
      setMatchedRuleText(`Maksimum tarif diterapkan: Rp ${maxRule.fee.toLocaleString('id-ID')}`);
    }
    
    if (matchedFee !== -1) {
      setDeliveryFee(matchedFee.toString());
    }
  }, [deliveryDistance, deliveryRules]);

  const selectedUnit = availableUnits.find(u => u.id === selectedUnitId);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const getTierHours = (val: number | string, unit: string) => {
    const num = Number(val) || 0;
    if (unit === 'Bulan') return num * 720;
    if (unit === 'Minggu') return num * 168;
    if (unit === 'Hari') return num * 24;
    return num; // Jam
  };

  const handleNext = () => {
    if (step === 1) {
      if (!selectedUnitId) return alert('Silakan pilih unit terlebih dahulu!');
    } else if (step === 2) {
      if (!schedule.date || !schedule.time || !schedule.duration) return alert('Silakan lengkapi jadwal dan durasi sewa!');
    } else if (step === 3) {
      if (!customer.name.trim() || !customer.phone.trim() || !customer.emergencyPhone.trim() || !customer.address.trim()) return alert('Nama, Nomor HP, No HP Darurat, dan Alamat wajib diisi!');
      
      const missingDocs = documents.some(d => d.title.trim() !== '' && !d.file);
      if (missingDocs) return alert('Semua dokumen jaminan yang dinamai wajib diunggah fotonya!');
    } else if (step === 4) {
      if (customer.requireDelivery && !customer.address.trim()) return alert('Alamat pengiriman wajib diisi!');
      if (customer.requireDelivery && deliveryFee === '') return alert('Biaya atau jarak pengiriman wajib diisi!');
    }
    setStep(s => Math.min(5, s + 1));
  };
  const handlePrev = () => setStep(s => Math.max(1, s - 1));

  const handlePriceChange = (val: string, field: 'deposit' | 'deliveryFee' | 'cashReceived') => {
    const numeric = val.replace(/\D/g, '');
    if (field === 'deliveryFee') setDeliveryFee(numeric);
    else setPayment({...payment, [field]: numeric});
  };

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    if (e.target.files && e.target.files.length > 0) {
      const url = URL.createObjectURL(e.target.files[0]);
      const newDocs = [...documents];
      newDocs[idx].file = url;
      setDocuments(newDocs);
    }
  };

  const handleTitleChange = (idx: number, title: string) => {
    const newDocs = [...documents];
    newDocs[idx].title = title;
    setDocuments(newDocs);
  };

  const addDocument = () => setDocuments([...documents, { title: '', file: null }]);
  const removeDocument = (idx: number) => setDocuments(documents.filter((_, i) => i !== idx));

  const calculateBasePrice = () => {
    if (!selectedUnit) return 0;
    
    if (selectedUnit.priceTiers && selectedUnit.priceTiers.length > 0) {
      if (selectedTierIndex !== null && selectedUnit.priceTiers[selectedTierIndex]) {
        return Number(selectedUnit.priceTiers[selectedTierIndex].price) || 0;
      }
      const match = selectedUnit.priceTiers.find((t: any) => 
        Number(t.durationVal) === Number(schedule.duration) && 
        (t.durationUnit || 'Jam') === schedule.durationType
      );
      if (match && match.price) return Number(match.price);
      return Number(selectedUnit.priceTiers[0].price) || 0;
    }
    
    return Number(selectedUnit.price) || 0;
  };

  const calculateTotal = () => {
    const base = calculateBasePrice();
    const delivery = customer.requireDelivery ? (Number(deliveryFee) || 0) : 0;
    return base + delivery;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 5) {
      handleNext();
    } else {
      if (!selectedUnit) return;

      const total = calculateTotal();
      
      // Calculate Expiry hour logic for timeline rendering
      const totalHours = getTierHours(schedule.duration, schedule.durationType);

      let startDateFormatted = schedule.date;
      let endDateFormatted = '';
      let isoStart = '';
      let isoEnd = '';
      
      if (schedule.date && schedule.time) {
        const [hours, minutes] = schedule.time.split(':').map(Number);
        const start = new Date(schedule.date);
        start.setHours(hours, minutes, 0, 0);
        isoStart = start.toISOString();
        startDateFormatted = `${format(start, 'dd-MM-yyyy', { locale: idLocale })}, jam ${schedule.time}`;
        
        const end = new Date(start.getTime() + totalHours * 60 * 60 * 1000);
        isoEnd = end.toISOString();
        endDateFormatted = `${format(end, 'dd-MM-yyyy', { locale: idLocale })}, jam ${format(end, 'HH:mm')}`;
      }

      const newBooking = {
        id: 'B' + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
        code: 'PBX-' + Math.floor(10000 + Math.random() * 90000), // e.g. PBX-12345
        customer: customer.name,
        customerPhone: customer.phone,
        unit: selectedUnit.name,
        unitId: selectedUnit.id,
        time: `${schedule.date}, ${schedule.time} (${schedule.duration} ${schedule.durationType})`,
        startDate: startDateFormatted,
        endDate: endDateFormatted,
        isoStart,
        isoEnd,
        durationHours: totalHours,
        status: 'Sedang Dipakai', 
        statusColor: 'bg-playbox-disewa/10 text-playbox-accent border border-playbox-disewa/20',
        needAction: false,
        totalPrice: total,
        paymentStatus: 'Lunas',
        paymentMethod: payment.method,
        deposit: Number(payment.deposit) || 0,
        requireDelivery: customer.requireDelivery,
        deliveryAddress: customer.address,
        deliveryFee: Number(deliveryFee) || 0,
        instagram: customer.instagram,
        emergencyPhone: customer.emergencyPhone,
        documents: documents.filter(d => d.title.trim() && d.file)
      };

      // 1. Sync ke Cloud Firestore (Real-Time)
      try {
        await setDoc(doc(db, 'stores', getStoreId(), 'bookings', newBooking.id), {
          ...newBooking,
          createdAt: new Date().toISOString()
        });

        // 1.5 Update Customer CRM Table
        const custRef = doc(db, 'stores', getStoreId(), 'customers', customer.phone);
        const custSnap = await getDoc(custRef);
        if (custSnap.exists()) {
           await updateDoc(custRef, {
             totalBookings: (custSnap.data().totalBookings || 0) + 1,
             totalSpent: (custSnap.data().totalSpent || 0) + total,
             name: customer.name
           });
        } else {
           await setDoc(custRef, {
             name: customer.name,
             phone: customer.phone,
             totalBookings: 1,
             totalSpent: total,
             isBlacklisted: false,
             blacklistReason: ''
           });
        }
      } catch (err) {
        console.error('Failed to save booking to Firestore:', err);
      }

      // 2. Sync ke localStorage
      const savedBookings = localStorage.getItem(getTenantStorageKey('playbox_mock_bookings'));
      let bookings = [];
      if (savedBookings) {
        bookings = JSON.parse(savedBookings);
      }
      bookings.push(newBooking);
      localStorage.setItem(getTenantStorageKey('playbox_mock_bookings'), JSON.stringify(bookings));

      const savedUnits = localStorage.getItem(getTenantStorageKey('playbox_mock_units'));
      if (savedUnits) {
        const units = JSON.parse(savedUnits);
        const updatedUnits = units.map((u: any) => 
          u.id === selectedUnit.id ? { ...u, status: 'Disewa', statusColor: 'bg-playbox-disewa/15 text-playbox-accent shadow-[0_0_10px_rgba(37,99,235,0.3)]' } : u
        );
        localStorage.setItem(getTenantStorageKey('playbox_mock_units'), JSON.stringify(updatedUnits));
      }

      alert("Booking berhasil dibuat!");
      router.push('/dashboard/booking');
    }
  };

  return (
    <div className="p-4 pb-28 min-h-screen flex flex-col relative">
      <div className="ambient-glow"></div>

      {/* Header */}
      <div className="flex items-center mt-2 mb-6 relative z-10">
        <button onClick={() => step > 1 ? handlePrev() : router.back()} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl mr-4 hover:bg-white/10 transition-colors">
          ←
        </button>
        <h1 className="text-xl font-bold tracking-tight">Booking Baru</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between mb-8 px-2 relative z-10">
        {[1, 2, 3, 4, 5].map(s => (
          <div key={s} className="flex flex-col items-center flex-1 relative">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 z-10 ${
              step >= s ? 'bg-playbox-accent text-white shadow-[0_0_15px_rgba(37,99,235,0.6)] scale-110' : 'bg-white/5 text-white/40'
            }`}>
              {s}
            </div>
            {s < 5 && (
              <div className="absolute top-1/2 left-1/2 w-full h-1 bg-white/5 -z-0 -translate-y-1/2 ml-4 rounded-full overflow-hidden">
                <div className={`h-full bg-playbox-accent transition-all duration-500 ${step > s ? 'w-full' : 'w-0'}`}></div>
              </div>
            )}
            <span className={`text-[9px] mt-2 font-medium uppercase tracking-wider transition-colors truncate w-full text-center ${step >= s ? 'text-white/80' : 'text-white/30'}`}>
              {s === 1 ? 'Unit' : s === 2 ? 'Jadwal' : s === 3 ? 'Identitas' : s === 4 ? 'Ongkir' : 'Bayar'}
            </span>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col relative z-10">
        
        {/* Step 1: Unit */}
        {step === 1 && (
          <div className="flex-1 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest mb-4">1. Pilih Unit</h2>
            
            {availableUnits.length === 0 ? (
              <div className="glass-surface p-8 rounded-3xl text-center">
                <p className="text-white/50 text-sm">Tidak ada unit yang berstatus "Ready".</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 pb-4">
                {availableUnits.map(u => {
                  const isSelected = selectedUnitId === u.id;
                  const tiers = u.priceTiers && u.priceTiers.length > 0 ? u.priceTiers : [{ durationVal: 24, durationUnit: 'Jam', price: u.price || 0 }];
                  return (
                    <div 
                      key={u.id}
                      onClick={() => {
                        setSelectedUnitId(u.id);
                        setSelectedTierIndex(0);
                        if (tiers[0]) {
                          setSchedule(prev => ({
                            ...prev,
                            duration: tiers[0].durationVal,
                            durationType: tiers[0].durationUnit || 'Jam'
                          }));
                        }
                      }}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-playbox-accent bg-playbox-accent/10 shadow-[0_4px_20px_rgba(37,99,235,0.2)] scale-[1.01]' 
                          : 'border-white/5 bg-black/20 hover:bg-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1 pr-2">
                          <h3 className="font-bold text-sm text-white truncate">{u.name}</h3>
                          <p className="text-[11px] text-playbox-text-secondary mt-0.5 mb-2">{u.type}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {tiers.map((t: any, i: number) => (
                              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] text-white/80 font-medium">
                                {t.durationVal} {t.durationUnit || 'Jam'}: <strong className="text-playbox-accent ml-1">Rp {(Number(t.price) || 0).toLocaleString('id-ID')}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 mt-1 ${isSelected ? 'border-playbox-accent' : 'border-white/20'}`}>
                          {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-playbox-accent"></div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Jadwal & Paket Durasi */}
        {step === 2 && (
          <div className="flex-1 space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest">2. Jadwal & Paket Durasi Sewa</h2>
              {selectedUnit && <span className="text-[11px] text-playbox-accent font-semibold">{selectedUnit.name}</span>}
            </div>
            
            {/* Pilihan Paket Durasi Sewa dari Unit */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider">
                Pilih Paket Durasi Sewa
              </label>
              
              {(() => {
                const tiers = selectedUnit?.priceTiers && selectedUnit.priceTiers.length > 0
                  ? selectedUnit.priceTiers
                  : [{ durationVal: 24, durationUnit: 'Jam', price: selectedUnit?.price || 0 }];
                
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {tiers.map((tier: any, idx: number) => {
                      const isSelected = selectedTierIndex === idx;
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setSelectedTierIndex(idx);
                            setSchedule(prev => ({
                              ...prev,
                              duration: tier.durationVal,
                              durationType: tier.durationUnit || 'Jam'
                            }));
                          }}
                          className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                            isSelected 
                              ? 'border-playbox-accent bg-playbox-accent/15 shadow-[0_4px_20px_rgba(37,99,235,0.25)] ring-1 ring-playbox-accent' 
                              : 'border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                              isSelected ? 'bg-playbox-accent text-white shadow-[0_0_12px_rgba(37,99,235,0.5)]' : 'bg-white/5 text-white/60'
                            }`}>
                              {tier.durationUnit === 'Bulan' ? '🌙' : tier.durationUnit === 'Minggu' ? '📆' : tier.durationUnit === 'Hari' ? '📅' : '⏱️'}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-white">
                                {tier.durationVal} {tier.durationUnit || 'Jam'}
                              </div>
                              <div className="text-xs font-bold text-playbox-accent mt-0.5">
                                Rp {(Number(tier.price) || 0).toLocaleString('id-ID')}
                              </div>
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-playbox-accent' : 'border-white/20'}`}>
                            {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-playbox-accent"></div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Jadwal Mulai */}
            <div className="glass-surface p-5 rounded-3xl space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Tanggal Mulai</label>
                <div className="relative">
                  <div 
                    onClick={() => { setIsDatePickerOpen(!isDatePickerOpen); }}
                    className={`w-full p-4 rounded-xl bg-black/20 border text-sm flex justify-between items-center cursor-pointer transition-all ${isDatePickerOpen ? 'border-playbox-accent text-white' : 'border-white/10 text-white/80'}`}
                  >
                    {schedule.date ? format(new Date(schedule.date), 'dd MMMM yyyy', { locale: idLocale }) : <span className="text-white/20">Pilih Tanggal</span>}
                    <span className="opacity-70">📅</span>
                  </div>
                  
                  {isDatePickerOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                      <div className="bg-playbox-surface p-5 border border-white/10 rounded-3xl shadow-2xl relative max-w-[320px] w-full">
                        <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
                          <h3 className="text-white font-bold text-sm">Pilih Tanggal</h3>
                          <button type="button" onClick={() => setIsDatePickerOpen(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors">✕</button>
                        </div>
                        <div className="flex justify-center">
                          <style>{`
                            .rdp { --rdp-cell-size: 36px; --rdp-accent-color: #2563eb; margin: 0; font-size: 14px; }
                            .rdp-day_selected { background-color: var(--rdp-accent-color); color: white; font-weight: bold; }
                            .rdp-head_cell { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.5); text-transform: uppercase; }
                            .rdp-caption_label { font-size: 16px; font-weight: bold; text-transform: capitalize; color: white; }
                            .rdp-nav_button { width: 32px; height: 32px; border-radius: 8px; background: rgba(255,255,255,0.05); }
                            .rdp-nav_button:hover { background: rgba(255,255,255,0.1); }
                          `}</style>
                          <DayPicker
                            mode="single"
                            locale={idLocale}
                            selected={schedule.date ? new Date(schedule.date) : undefined}
                            onSelect={(d) => {
                              if (d) {
                                setSchedule({...schedule, date: format(d, 'yyyy-MM-dd')});
                                setIsDatePickerOpen(false);
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="pt-1">
                <div className="flex justify-between items-center mb-2.5">
                  <label className="text-[11px] font-bold text-playbox-text-secondary uppercase tracking-wider">Jam Mulai Sewa</label>
                  <button 
                    type="button" 
                    onClick={() => {
                      const now = new Date();
                      const t = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                      setSchedule({...schedule, time: t});
                    }}
                    className="text-[10px] font-bold text-playbox-accent hover:text-white transition-colors bg-playbox-accent/10 px-2 py-1 rounded-md"
                  >
                    Waktu Saat Ini
                  </button>
                </div>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex items-center space-x-2 bg-black/30 p-2 rounded-2xl border border-white/10 shrink-0 w-full sm:w-auto justify-center">
                    <input 
                      type="text" 
                      inputMode="numeric"
                      maxLength={2} 
                      value={(schedule.time || '00:00').split(':')[0]} 
                      onChange={(e) => {
                         let h = e.target.value.replace(/\D/g, '');
                         if (parseInt(h) > 23) h = '23';
                         setSchedule({...schedule, time: `${h}:${(schedule.time || '00:00').split(':')[1] || '00'}`});
                      }}
                      onBlur={(e) => {
                         let h = e.target.value;
                         if (h.length === 1) h = '0' + h;
                         if (h.length === 0) h = '00';
                         setSchedule({...schedule, time: `${h}:${(schedule.time || '00:00').split(':')[1] || '00'}`});
                      }}
                      className="w-14 h-12 bg-black/50 border border-white/5 rounded-xl text-2xl text-center font-black text-white focus:border-playbox-accent focus:bg-playbox-accent/10 focus:outline-none transition-all" 
                    />
                    <span className="text-xl font-black text-white/30">:</span>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      maxLength={2} 
                      value={(schedule.time || '00:00').split(':')[1] || '00'} 
                      onChange={(e) => {
                         let m = e.target.value.replace(/\D/g, '');
                         if (parseInt(m) > 59) m = '59';
                         setSchedule({...schedule, time: `${(schedule.time || '00:00').split(':')[0] || '00'}:${m}`});
                      }}
                      onBlur={(e) => {
                         let m = e.target.value;
                         if (m.length === 1) m = '0' + m;
                         if (m.length === 0) m = '00';
                         setSchedule({...schedule, time: `${(schedule.time || '00:00').split(':')[0] || '00'}:${m}`});
                      }}
                      className="w-14 h-12 bg-black/50 border border-white/5 rounded-xl text-2xl text-center font-black text-white focus:border-playbox-accent focus:bg-playbox-accent/10 focus:outline-none transition-all" 
                    />
                  </div>
                  
                  <div className="flex-1 w-full grid grid-cols-4 sm:flex sm:flex-wrap gap-1.5">
                    {['08:00', '10:00', '13:00', '15:00', '17:00', '19:00', '21:00', '23:00'].map(t => (
                      <button 
                        key={t}
                        type="button"
                        onClick={() => setSchedule({...schedule, time: t})}
                        className={`px-2 py-2.5 sm:py-2 rounded-xl text-xs font-bold transition-all border ${
                          schedule.time === t 
                            ? 'bg-playbox-accent border-playbox-accent text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]' 
                            : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Identitas */}
        {step === 3 && (
          <div className="flex-1 space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest mb-2">3. Data & Identitas Klien</h2>
            
            <div className="glass-surface p-6 rounded-3xl space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={customer.name} 
                  onChange={e => setCustomer({...customer, name: e.target.value})} 
                  className="w-full p-4 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent" 
                  required 
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Nomor WhatsApp Utama</label>
                <input 
                  type="tel" 
                  value={customer.phone} 
                  onChange={e => setCustomer({...customer, phone: e.target.value.replace(/\D/g, '')})} 
                  className={`w-full p-4 rounded-xl bg-black/20 border text-white text-sm focus:outline-none transition-colors ${blacklistedCustomer ? 'border-red-500 focus:border-red-500 bg-red-500/5' : 'border-white/10 focus:border-playbox-accent'}`} 
                  required 
                />
                {blacklistedCustomer && (
                  <div className="mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start space-x-3">
                    <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <div>
                      <p className="text-red-500 font-bold text-sm">TOLAK PESANAN! Pelanggan Blacklist</p>
                      <p className="text-red-400 text-xs mt-1">Alasan: {blacklistedCustomer.blacklistReason || 'Tidak diketahui'}</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">No HP Darurat (Wajib)</label>
                <input 
                  type="tel" 
                  value={customer.emergencyPhone} 
                  onChange={e => setCustomer({...customer, emergencyPhone: e.target.value.replace(/\D/g, '')})} 
                  className="w-full p-4 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent" 
                  placeholder="Keluarga / Teman Dekat"
                  required 
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Username Instagram (Opsional)</label>
                <input 
                  type="text" 
                  value={customer.instagram} 
                  onChange={e => setCustomer({...customer, instagram: e.target.value})} 
                  className="w-full p-4 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent" 
                  placeholder="@username"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Alamat Domisili Klien</label>
                <textarea 
                  value={customer.address} 
                  onChange={e => setCustomer({...customer, address: e.target.value})} 
                  className="w-full p-4 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent min-h-[100px] resize-none" 
                  placeholder="Masukkan alamat domisili lengkap..."
                  required
                />
              </div>
            </div>

            <div className="glass-surface p-6 rounded-3xl space-y-4">
              <h3 className="text-xs font-bold text-white/80 uppercase tracking-widest mb-2">Dokumen Jaminan</h3>
              
              <div className="space-y-4">
                {documents.map((doc, idx) => (
                  <div key={idx} className="flex space-x-3 items-end">
                    <div className="flex-1">
                      <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Nama Dokumen</label>
                      <input 
                        type="text" 
                        value={doc.title} 
                        onChange={e => handleTitleChange(idx, e.target.value)} 
                        className="w-full p-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent transition-all" 
                        placeholder="Mis: KTP / Ijazah / BPKB"
                      />
                    </div>
                    <div className="w-24">
                      {doc.file ? (
                        <div className="relative rounded-xl overflow-hidden border border-white/10 h-[46px] bg-black/50">
                          <img src={doc.file} alt={doc.title} className="w-full h-full object-cover opacity-80" />
                          <button type="button" onClick={() => { const newDocs = [...documents]; newDocs[idx].file = null; setDocuments(newDocs); }} className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs opacity-0 hover:opacity-100 transition-opacity">Hapus</button>
                        </div>
                      ) : (
                        <div className="relative h-[46px]">
                          <input type="file" accept="image/*" onChange={e => handleDocUpload(e, idx)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                          <div className="w-full border-2 border-dashed border-white/20 rounded-xl h-full flex items-center justify-center text-white/50 hover:border-playbox-accent hover:text-playbox-accent transition-colors bg-white/5">
                            <span className="text-xs font-medium">Unggah</span>
                          </div>
                        </div>
                      )}
                    </div>
                    {documents.length > 1 && (
                      <button type="button" onClick={() => removeDocument(idx)} className="h-[46px] px-3 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-xl transition-colors">
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                
                <button type="button" onClick={addDocument} className="w-full py-3 border border-dashed border-white/20 rounded-xl text-white/70 text-sm font-medium hover:border-playbox-accent hover:text-playbox-accent transition-colors flex items-center justify-center mt-2">
                  <span className="mr-2">+</span> Tambah Dokumen Jaminan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Pengiriman */}
        {step === 4 && (
          <div className="flex-1 space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest mb-2">4. Antar-Jemput (Ongkir)</h2>
            
            <div className="glass-surface p-6 rounded-3xl space-y-5">
              <label className="flex items-center space-x-3 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    checked={customer.requireDelivery} 
                    onChange={e => setCustomer({...customer, requireDelivery: e.target.checked})} 
                    className="peer appearance-none w-5 h-5 border-2 border-white/20 rounded cursor-pointer checked:bg-playbox-accent checked:border-playbox-accent transition-all" 
                  />
                  <span className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none text-xs">✓</span>
                </div>
                <span className="text-sm font-semibold text-white/90">Klien Butuh Antar-Jemput</span>
              </label>

              {customer.requireDelivery && (
                <div className="space-y-4 pt-4 border-t border-white/5 animate-in slide-in-from-top-2 fade-in duration-200">
                  <div>
                    <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Alamat Pengiriman</label>
                    <textarea 
                      value={customer.address} 
                      onChange={e => setCustomer({...customer, address: e.target.value})} 
                      rows={3} 
                      className="w-full p-4 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent" 
                      placeholder="Detail alamat lengkap..." 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Jarak Pengiriman (km)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={deliveryDistance}
                        onChange={e => setDeliveryDistance(e.target.value)}
                        className="w-full p-4 pr-32 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent" 
                        placeholder="Mis: 7"
                        step="0.1"
                        min="0"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex space-x-2">
                        <button 
                          type="button" 
                          onClick={() => { setDeliveryDistance(''); setDeliveryFee('0'); setMatchedRuleText('Promo: Free Ongkir'); }}
                          className="bg-playbox-ready/20 text-playbox-ready px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-playbox-ready/30 transition-colors"
                        >
                          Free Ongkir
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-medium text-playbox-text-secondary uppercase tracking-wider">Total Biaya Ongkir (Rp)</label>
                        {matchedRuleText && (
                          <span className="text-[10px] text-playbox-accent font-semibold">{matchedRuleText}</span>
                        )}
                      </div>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-playbox-text-secondary text-sm font-semibold">Rp</span>
                        <input 
                          type="text" 
                          inputMode="numeric"
                          value={deliveryFee !== '' ? Number(deliveryFee).toLocaleString('id-ID') : ''} 
                          onChange={e => handlePriceChange(e.target.value, 'deliveryFee')} 
                          className="w-full p-3.5 pl-12 rounded-xl bg-black/20 border border-white/10 text-white text-sm font-bold focus:outline-none focus:border-playbox-accent transition-all placeholder:text-white/20" 
                          placeholder="0" 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Pembayaran */}
        {step === 5 && selectedUnit && (
          <div className="flex-1 space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest mb-2">5. Ringkasan & Pembayaran</h2>
            
            <div className="glass-surface p-6 rounded-3xl space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-playbox-text-secondary">Sewa Unit ({schedule.duration} {schedule.durationType})</span>
                <span className="font-medium text-white">Rp {calculateBasePrice().toLocaleString('id-ID')}</span>
              </div>
              {customer.requireDelivery && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-playbox-text-secondary">Biaya Delivery</span>
                  <span className="font-medium text-white">
                    {deliveryFee === '0' || !deliveryFee ? 'GRATIS' : `Rp ${Number(deliveryFee).toLocaleString('id-ID')}`}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center font-bold pt-4 mt-2 border-t border-white/5">
                <span className="text-sm">Total Tagihan</span>
                <span className="text-xl tracking-tight text-playbox-accent">
                  Rp {calculateTotal().toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="glass-surface p-6 rounded-3xl space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Metode Pembayaran (Lunas)</label>
                <div className="flex space-x-2">
                  {['Transfer Bank', 'Cash', 'QRIS'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayment({...payment, method: m})}
                      className={`flex-1 py-3.5 rounded-xl text-sm font-medium transition-all ${payment.method === m ? 'bg-playbox-accent text-white shadow-[0_4px_15px_rgba(37,99,235,0.4)] border border-playbox-accent' : 'bg-black/20 text-white/60 hover:bg-white/10 border border-white/10'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              
              {payment.method === 'Cash' && (
                <div className="p-4 bg-playbox-accent/5 border border-playbox-accent/20 rounded-2xl space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                  <div>
                    <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Uang Diterima dari Pelanggan (Rp)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-playbox-text-secondary text-sm">Rp</span>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        value={payment.cashReceived ? Number(payment.cashReceived).toLocaleString('id-ID') : ''} 
                        onChange={e => handlePriceChange(e.target.value, 'cashReceived')} 
                        className="w-full p-4 pl-12 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent transition-all placeholder:text-white/20 font-medium" 
                        placeholder="Mis: 200.000" 
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center px-2">
                    <span className="text-sm font-medium text-playbox-text-secondary">Kembalian</span>
                    <span className={`text-lg font-bold ${Number(payment.cashReceived) - calculateTotal() >= 0 ? 'text-playbox-ready' : 'text-red-400'}`}>
                      Rp {payment.cashReceived ? Math.max(0, Number(payment.cashReceived) - calculateTotal()).toLocaleString('id-ID') : '0'}
                    </span>
                  </div>
                </div>
              )}

              {payment.method === 'QRIS' && savedPaymentMethods.filter(p => p.type === 'QRIS').length > 0 && (
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-4 animate-in slide-in-from-top-2 fade-in duration-200 text-center">
                  <p className="text-xs text-white/60 mb-2">Silakan scan QRIS berikut:</p>
                  <div className="flex flex-wrap justify-center gap-4">
                    {savedPaymentMethods.filter(p => p.type === 'QRIS').map(pm => (
                      <div key={pm.id} className="bg-white p-2 rounded-xl">
                        <p className="text-black font-bold text-[10px] mb-1">{pm.name}</p>
                        <img src={pm.qrisImage} alt="QRIS" className="w-40 h-40 object-contain mx-auto" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {payment.method === 'Transfer Bank' && savedPaymentMethods.filter(p => p.type !== 'QRIS').length > 0 && (
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                  <p className="text-xs text-white/60 mb-2">Pilihan Rekening / E-Wallet:</p>
                  <div className="space-y-3">
                    {savedPaymentMethods.filter(p => p.type !== 'QRIS').map(pm => (
                      <div key={pm.id} className="bg-black/40 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                        <div>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/70 uppercase tracking-widest">{pm.type}</span>
                          <p className="font-bold text-sm mt-1">{pm.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-white tracking-widest">{pm.account}</p>
                          <p className="text-[10px] text-white/50">a.n. {pm.owner}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Deposit Jaminan (Dikembalikan)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-playbox-text-secondary text-sm">Rp</span>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={payment.deposit ? Number(payment.deposit).toLocaleString('id-ID') : ''} 
                    onChange={e => handlePriceChange(e.target.value, 'deposit')} 
                    className="w-full p-4 pl-12 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent transition-all placeholder:text-white/20" 
                    placeholder="0" 
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-8 pt-4 border-t border-white/5 mb-12 relative z-10">
          <button 
            type="submit" 
            disabled={
              (step === 1 && !selectedUnitId) || 
              (step === 3 && blacklistedCustomer !== null)
            }
            className={`w-full py-4 rounded-2xl font-semibold shadow-[0_4px_20px_rgba(37,99,235,0.4)] text-sm tracking-wide transition-all ${
              (step === 1 && !selectedUnitId) || (step === 3 && blacklistedCustomer !== null)
                ? 'bg-white/5 text-white/30 cursor-not-allowed shadow-none border border-white/5' 
                : 'saas-button'
            }`}
          >
            {step === 5 ? 'Konfirmasi & Selesai' : 'Lanjutkan ke Tahap ' + (step + 1)}
          </button>
        </div>
      </form>
    </div>
  );
}
