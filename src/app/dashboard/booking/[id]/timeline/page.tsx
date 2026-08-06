'use client';
import { useState, useEffect, useRef } from 'react';
import { toPng } from 'html-to-image';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';

export default function TimelineBooking() {
  const { id } = useParams();
  const router = useRouter();

  const [bookingData, setBookingData] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const [stages, setStages] = useState<string[]>([]);
  const [currentStage, setCurrentStage] = useState(1);
  const [completedTimes, setCompletedTimes] = useState<Record<number, string>>({});
  const [photoKondisi, setPhotoKondisi] = useState<string | null>(null);
  
  // Dynamic Shop Branding & Payment Methods
  const [businessName, setBusinessName] = useState("PLAYBOX");
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  useEffect(() => {
    // Load Shop Settings & Payment Methods
    const loadShopAndPayments = async () => {
      try {
        // Shop Profile
        const shopSnap = await getDoc(doc(db, 'settings', 'shop'));
        if (shopSnap.exists()) {
          const s = shopSnap.data();
          if (s.brandName) setBusinessName(s.brandName);
          if (s.logo) setBusinessLogo(s.logo);
        } else {
          const shopSettings = localStorage.getItem('playbox_shop_settings');
          if (shopSettings) {
            const parsed = JSON.parse(shopSettings);
            if (parsed.brandName) setBusinessName(parsed.brandName);
            if (parsed.logo) setBusinessLogo(parsed.logo);
          }
        }

        // Payments
        const savedPayments = localStorage.getItem('playbox_payments');
        if (savedPayments) {
          const parsed = JSON.parse(savedPayments);
          setPaymentMethods(parsed.filter((p: any) => p.active && p.type !== 'QRIS'));
        }
      } catch (err) {
        console.warn('Error loading store config:', err);
      }
    };

    loadShopAndPayments();

    if (!id || typeof id !== 'string') return;

    // 1. Real-time Firestore document listener
    const unsubscribe = onSnapshot(doc(db, 'bookings', id), (docSnap) => {
      let b: any = null;
      if (docSnap.exists()) {
        b = { ...docSnap.data(), id: docSnap.id };
      } else {
        const saved = localStorage.getItem('playbox_mock_bookings');
        if (saved) {
          const bookings = JSON.parse(saved);
          b = bookings.find((item: any) => item.id === id);
        }
      }

      if (b) {
        setBookingData(b);
        
        // Generate dynamic stages based on delivery requirement
        let dynamicStages = [
          'Sedang Dipakai',
          b.requireDelivery ? 'Dijemput' : 'Dikembalikan (Toko)',
          'Pengecekan Barang',
          'Selesai'
        ];
        setStages(dynamicStages);

        // Find current stage index
        let idx = dynamicStages.findIndex(s => s.toLowerCase().includes(b.status?.toLowerCase() || ''));
        
        // Fallbacks for known mismatches
        if (idx === -1) {
          if (b.status === 'Persiapan') idx = dynamicStages.findIndex(s => s.includes('Persiapan'));
          if (b.status === 'Booking Dibuat') idx = 0;
          if (b.status === 'Dikembalikan') idx = dynamicStages.findIndex(s => s.includes('Dikembalikan'));
          if (b.status === 'Selesai') idx = dynamicStages.length - 1;
        }

        const currentIdx = idx !== -1 ? idx + 1 : 1;
        setCurrentStage(currentIdx);

        // Generate logical mock times for past stages
        const times: Record<number, string> = {};
        if (b.time) {
          try {
            const [datePart, timePart] = b.time.split(', ');
            const [hStr, mStr] = timePart.split(':');
            let baseDate = new Date();
            baseDate.setHours(parseInt(hStr), parseInt(mStr), 0);

            for (let i = 1; i < currentIdx; i++) {
              times[i] = baseDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              baseDate.setMinutes(baseDate.getMinutes() + Math.floor(Math.random() * 20) + 5);
            }
          } catch (e) {
            // fallback
          }
        }
        setCompletedTimes(times);
      }
    });

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const endStr = bookingData?.endTime || bookingData?.isoEnd;
    if (endStr) {
      const calculateTimeLeft = () => {
        const end = new Date(endStr).getTime();
        const now = new Date().getTime();
        const diff = end - now;

        if (diff <= 0) {
          setTimeLeft('Waktu Habis');
          return;
        }

        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`${h} Jam ${m} Menit`);
      };

      calculateTimeLeft();
      interval = setInterval(calculateTimeLeft, 60000);
    }
    return () => clearInterval(interval);
  }, [bookingData?.endTime, bookingData?.isoEnd]);

  const handleUpdateStatus = async () => {
    if (!bookingData) return;

    const currentStatusName = stages[currentStage - 1];

    if (currentStatusName === 'Foto Kondisi Awal' && !photoKondisi) {
      alert("Harap unggah foto kondisi awal terlebih dahulu!");
      return;
    }

    if (currentStatusName.includes('Dijemput') || currentStatusName.includes('Dikembalikan')) {
      router.push(`/dashboard/booking/${id}/return`);
      return;
    } 
    
    if (currentStage < stages.length) {
      const nextStatusName = stages[currentStage];
      
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setCompletedTimes(prev => ({ ...prev, [currentStage]: timeStr }));
      setCurrentStage(prev => prev + 1);

      let color = 'bg-white/10 text-white';
      if (nextStatusName === 'Sedang Dipakai') color = 'bg-playbox-disewa/10 text-playbox-accent border border-playbox-disewa/20';
      else if (nextStatusName.includes('Dijemput') || nextStatusName.includes('Dikembalikan')) color = 'bg-purple-500/15 text-purple-400';
      else if (nextStatusName === 'Selesai') color = 'bg-playbox-ready/15 text-playbox-ready border border-playbox-ready/20';
      
      let cleanStatus = nextStatusName.replace(' (Ambil di Toko)', '').replace(' (Toko)', '');

      // 1. Update Firestore
      try {
        if (id && typeof id === 'string') {
          await updateDoc(doc(db, 'bookings', id), {
            status: cleanStatus,
            statusColor: color,
            needAction: false,
            updatedAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error('Failed to update stage in Firestore:', err);
      }

      // 2. Save to localStorage
      const savedBookings = localStorage.getItem('playbox_mock_bookings');
      if (savedBookings) {
        const parsedBookings = JSON.parse(savedBookings);
        const updatedBookings = parsedBookings.map((b: any) => {
          if (b.id === id) {
            return {
              ...b,
              status: cleanStatus,
              statusColor: color,
              needAction: false
            };
          }
          return b;
        });
        localStorage.setItem('playbox_mock_bookings', JSON.stringify(updatedBookings));
      }
    }
  };

  const handleSendInvoice = async () => {
    if (!bookingData || !invoiceRef.current) return;
    
    setIsGeneratingInvoice(true);
    try {
      await new Promise(r => setTimeout(r, 100));
      
      const dataUrl = await toPng(invoiceRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#0a0a0a'
      });
      
      const link = document.createElement('a');
      link.download = `Invoice_${bookingData.code}.png`;
      link.href = dataUrl;
      link.click();

      const phone = bookingData.customerPhone.startsWith('0') ? '62' + bookingData.customerPhone.slice(1) : bookingData.customerPhone;
      
      // Calculate Fine amounts
      const lateFine = Number(bookingData.fines?.totalLateFine || 0);
      const damageFine = Number(bookingData.fines?.totalDamageFine || 0);
      const internalFine = Number(bookingData.fines?.totalInternalFine || 0);
      const totalFine = lateFine + damageFine + internalFine;

      let text = '';
      if (totalFine > 0) {
        // Message WITH Fines (No emoji, dynamic store name, fine details, and bank account list)
        let fineDetails = [];
        if (lateFine > 0) fineDetails.push(`- Denda Keterlambatan (${bookingData.fines.lateHours} Jam): Rp ${lateFine.toLocaleString('id-ID')}`);
        if (damageFine > 0) fineDetails.push(`- Denda Kerusakan/Kehilangan: Rp ${damageFine.toLocaleString('id-ID')}`);
        if (internalFine > 0) fineDetails.push(`- Denda Khusus: Rp ${internalFine.toLocaleString('id-ID')}`);

        let bankInfo = paymentMethods.length > 0
          ? paymentMethods.map(p => `* ${p.name}: ${p.account} (a.n ${p.owner})`).join('\n')
          : '* Transfer Bank / Kasir';

        text = `Halo Kak ${bookingData.customer}!\n\nIni lampiran invoice/nota untuk pesanan Anda (*${bookingData.code}*) yang telah selesai.\n\nInformasi Denda:\n${fineDetails.join('\n')}\n*Total Denda: Rp ${totalFine.toLocaleString('id-ID')}*\n\nSilakan transfer pembayaran denda ke rekening berikut:\n${bankInfo}\n\nTerima kasih telah menyewa di ${businessName}!`;
      } else {
        // Standard Invoice Message (No emoji, dynamic store name)
        text = `Halo Kak ${bookingData.customer}!\n\nIni lampiran invoice/nota untuk pesanan Anda (*${bookingData.code}*) yang telah selesai.\n\nTerima kasih telah menyewa di ${businessName}!`;
      }
      
      setTimeout(() => {
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      }, 500);
      
    } catch (err) {
      console.error(err);
      alert('Gagal membuat invoice gambar.');
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPhotoKondisi(URL.createObjectURL(e.target.files[0]));
    }
  };

  if (!bookingData) return <div className="p-4 text-center mt-20 text-white/50">Memuat data...</div>;

  const currentStatusName = stages[currentStage - 1] || '';
  const nextStatusName = stages[currentStage] || '';

  return (
    <div className="p-4 space-y-6 pb-32 relative h-full">
      <div className="ambient-glow"></div>
      
      {/* Header */}
      <div className="flex items-center mt-2 mb-6 relative z-10">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl mr-4 hover:bg-white/10 transition-colors">
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Timeline</h1>
          <p className="text-xs text-playbox-text-secondary mt-0.5">Booking {id}</p>
        </div>
      </div>

      {/* Detail Pesanan */}
      <div className="glass-surface p-6 rounded-3xl space-y-4 animate-in fade-in slide-in-from-top-4 relative z-10">
        <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest border-b border-white/10 pb-3">Informasi Pesanan</h2>
        
        <div className="grid grid-cols-1 gap-4">
          {(bookingData.startTime || bookingData.isoStart) && (bookingData.endTime || bookingData.isoEnd) && (
            <div className="flex flex-col space-y-2 mb-2">
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-playbox-accent/20 to-playbox-accent/5 border border-playbox-accent/30 rounded-2xl">
                <div>
                  <p className="text-[10px] text-playbox-accent font-bold uppercase tracking-wider mb-1">Mulai Sewa</p>
                  <p className="text-sm font-bold text-white">{new Date(bookingData.startTime || bookingData.isoStart).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-playbox-accent font-bold uppercase tracking-wider mb-1">Akhir Sewa</p>
                  <p className="text-sm font-bold text-white">{new Date(bookingData.endTime || bookingData.isoEnd).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
              </div>
              {bookingData.status === 'Selesai' ? (
                <div className="flex justify-between items-center px-4 py-3 bg-playbox-ready/10 border border-playbox-ready/20 rounded-2xl">
                  <span className="text-xs font-bold text-playbox-ready uppercase tracking-wider">Status Waktu</span>
                  <span className="text-sm font-black text-playbox-ready">SELESAI ✔️</span>
                </div>
              ) : (
                <div className="flex justify-between items-center px-4 py-3 bg-white/5 border border-white/10 rounded-2xl">
                  <span className="text-xs font-medium text-playbox-text-secondary uppercase tracking-wider">Sisa Waktu</span>
                  <span className="text-sm font-black text-white animate-pulse">{timeLeft || 'Menghitung...'}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-start gap-3">
            <div className="space-y-1.5 min-w-0 flex-1">
              <p className="text-[10px] text-playbox-text-secondary uppercase tracking-wider mb-1">Data Klien</p>
              <p className="text-sm font-bold text-white mb-2 truncate" title={bookingData.customer}>{bookingData.customer}</p>
              <p className="text-xs text-white/70 flex items-center min-w-0"><span className="w-4 h-4 mr-1 opacity-50 flex items-center justify-center shrink-0">📱</span> <span className="truncate flex-1">{bookingData.customerPhone}</span></p>
              {bookingData.emergencyPhone && <p className="text-xs text-white/70 flex items-center min-w-0"><span className="w-4 h-4 mr-1 opacity-50 flex items-center justify-center text-red-400 shrink-0">🚨</span> <span className="truncate flex-1">{bookingData.emergencyPhone}</span></p>}
              {bookingData.instagram && <p className="text-xs text-white/70 flex items-center min-w-0"><span className="w-4 h-4 mr-1 opacity-50 flex items-center justify-center text-blue-400 shrink-0">📸</span> <span className="truncate flex-1">{bookingData.instagram}</span></p>}
            </div>
            <div className="text-right shrink-0">
              <span className="bg-playbox-accent/10 text-playbox-accent border border-playbox-accent/20 px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wider whitespace-nowrap inline-block shadow-sm">{bookingData.unit}</span>
            </div>
          </div>
          
          {(bookingData.deliveryAddress || bookingData.address) && (
            <div className="mt-1">
              <p className="text-[10px] text-playbox-text-secondary uppercase tracking-wider mb-1">Alamat Domisili / Pengiriman</p>
              <p className="text-xs text-white/80 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5 break-words">{bookingData.deliveryAddress || bookingData.address}</p>
            </div>
          )}
          
          <div className="mt-1">
            <p className="text-[10px] text-playbox-text-secondary uppercase tracking-wider mb-1">Pengiriman (Ongkir)</p>
            <p className="text-sm font-medium text-white/90">
              {bookingData.requireDelivery 
                ? `🚗 Antar Jemput (Rp ${(bookingData.deliveryFee || 0).toLocaleString('id-ID')})`
                : '🏬 Ambil di Toko (Tidak ada antar-jemput)'}
            </p>
          </div>
        </div>
        
        <div className="pt-3 border-t border-white/10">
          <h3 className="text-[10px] font-medium text-playbox-text-secondary uppercase mb-3">Dokumen & Foto</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {bookingData.documents && bookingData.documents.map((doc: any, idx: number) => (
              <div key={idx} className="w-24 flex-shrink-0 cursor-pointer group" onClick={() => setSelectedImage(doc.file)}>
                <div className="h-16 rounded-xl overflow-hidden border border-white/10 shadow-lg bg-black/50 group-hover:border-playbox-accent transition-colors relative">
                  <img src={doc.file} alt={doc.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs">🔍</span>
                  </div>
                </div>
                <p className="text-[9px] text-center mt-2 text-white/70 font-medium truncate px-1" title={doc.title}>{doc.title}</p>
              </div>
            ))}

            {(!bookingData.documents || bookingData.documents.length === 0) && (bookingData.ktpPhoto || bookingData.ktpUrl) && (
              <div className="w-24 flex-shrink-0 cursor-pointer group" onClick={() => setSelectedImage(bookingData.ktpPhoto || bookingData.ktpUrl)}>
                <div className="h-16 rounded-xl overflow-hidden border border-white/10 shadow-lg bg-black/50 group-hover:border-playbox-accent transition-colors relative">
                  <img src={bookingData.ktpPhoto || bookingData.ktpUrl} alt="KTP" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs">🔍</span>
                  </div>
                </div>
                <p className="text-[9px] text-center mt-2 text-white/70 font-medium">Foto KTP</p>
              </div>
            )}

            {bookingData.paymentProof && (
              <div className="w-24 flex-shrink-0 cursor-pointer group" onClick={() => setSelectedImage(bookingData.paymentProof)}>
                <div className="h-16 rounded-xl overflow-hidden border border-white/10 shadow-lg bg-black/50 group-hover:border-playbox-accent transition-colors relative">
                  <img src={bookingData.paymentProof} alt="Bukti Transfer" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs">🔍</span>
                  </div>
                </div>
                <p className="text-[9px] text-center mt-2 text-white/70 font-medium">Bukti Bayar</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-surface p-6 rounded-3xl relative z-10">
        <div className="relative pl-6 border-l-2 border-white/10 space-y-8 py-2">
          
          {stages.map((stage, idx) => {
            const stepNumber = idx + 1;
            const isCompleted = stepNumber < currentStage;
            const isActive = stepNumber === currentStage;
            const isFuture = stepNumber > currentStage;

            let dotColor = 'bg-white/20 border-white/5';
            let textColor = 'text-white/40';
            
            if (isCompleted) {
              dotColor = 'bg-white/40 border-white/10';
              textColor = 'text-white/80';
            }
            if (isActive) {
              dotColor = 'bg-playbox-accent border-playbox-accent shadow-[0_0_15px_rgba(226,23,142,0.8)]';
              textColor = 'text-playbox-accent font-bold';
            }

            return (
              <div key={idx} className="relative group">
                <div className={`absolute -left-[33px] w-4 h-4 rounded-full transition-all duration-300 flex items-center justify-center ${dotColor} border-4`}>
                  {isActive && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>}
                </div>

                <div className={`transition-all duration-300 ${isActive ? 'translate-x-1' : ''}`}>
                  <h3 className={`text-base font-bold ${textColor}`}>
                    {stage}
                  </h3>
                  
                  {isCompleted && completedTimes[stepNumber] && (
                    <p className="text-xs text-white/50 mt-1 flex items-center">
                      <span className="mr-1.5">🕒</span> {completedTimes[stepNumber]}
                    </p>
                  )}

                  {isActive && (
                    <div className="mt-3 bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10 border-l-4 border-l-playbox-accent animate-in slide-in-from-top-2 fade-in duration-300">
                      
                      {stage === 'Foto Kondisi Awal' && (
                        <div className="mb-3 space-y-3">
                          <p className="text-xs text-white/70">Wajib: Foto kondisi fisik unit dan perlengkapan sebelum diserahkan ke pelanggan.</p>
                          {photoKondisi ? (
                            <div className="relative w-full h-32 rounded-xl overflow-hidden border border-white/10 shadow-md">
                              <img src={photoKondisi} alt="Kondisi" className="w-full h-full object-cover" />
                              <button onClick={() => setPhotoKondisi(null)} className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-xs hover:bg-red-500/80 transition-colors">✕</button>
                            </div>
                          ) : (
                            <div className="relative h-20 w-full">
                              <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                              <div className="w-full h-full border-2 border-dashed border-white/20 rounded-xl flex items-center justify-center text-white/50 bg-white/5 hover:border-playbox-accent hover:text-playbox-accent transition-colors shadow-inner">
                                <span className="text-xs font-medium">📷 Ambil Foto Kondisi (Kamera)</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="flex space-x-3 text-xs text-white/80 leading-relaxed">
                        <p>
                          <span className="font-bold text-playbox-accent mr-1">Tugas Anda:</span> Silakan proses pesanan ke tahap <strong className="text-white">{stage}</strong> jika semuanya sudah dipastikan sesuai prosedur.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Bar */}
      <div className="mt-8 pt-4 border-t border-white/5">
        {currentStage < stages.length ? (
          <div className="flex gap-3">
            <button 
              onClick={handleUpdateStatus}
              className="flex-1 py-4 bg-playbox-accent text-white rounded-2xl font-bold shadow-[0_4px_20px_rgba(226,23,142,0.25)] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center"
            >
              Update Status ke "{nextStatusName}" <span className="ml-2">→</span>
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button 
              onClick={handleSendInvoice}
              disabled={isGeneratingInvoice}
              className={`flex-1 py-4 text-black rounded-2xl font-bold shadow-[0_4px_20px_rgba(37,211,102,0.4)] transition-all flex justify-center items-center ${isGeneratingInvoice ? 'bg-[#20bd5a] opacity-70 scale-[0.98]' : 'bg-[#25D366] hover:bg-[#20bd5a] hover:scale-[1.02] active:scale-[0.98]'}`}
            >
              {isGeneratingInvoice ? (
                <span className="flex items-center"><span className="animate-spin mr-2">⏳</span> Sedang Membuat Invoice...</span>
              ) : (
                <><span className="mr-2 text-lg">💬</span> Kirim Invoice Selesai (WA)</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Image Lightbox Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-md w-full" onClick={e => e.stopPropagation()}>
            <button 
              className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              ✕
            </button>
            <img 
              src={selectedImage} 
              alt="Preview" 
              className="w-full rounded-2xl shadow-2xl" 
            />
          </div>
        </div>
      )}

      {/* Hidden Invoice Template for Capture with Dynamic Store Logo and Name */}
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
              <p className="text-3xl font-bold tracking-tight text-white/90">INVOICE</p>
              <p className="text-playbox-accent font-bold mt-1 text-xl">{bookingData?.code}</p>
            </div>
          </div>

          <div className="flex justify-between mb-10 relative z-10">
            <div>
              <p className="text-[#9BA1B0] text-sm font-semibold uppercase tracking-wider mb-2">Customer</p>
              <p className="text-2xl font-bold text-white">{bookingData?.customer}</p>
              <p className="text-white/60 text-lg mt-1">{bookingData?.customerPhone}</p>
            </div>
            <div className="text-right">
              <p className="text-[#9BA1B0] text-sm font-semibold uppercase tracking-wider mb-2">Periode Sewa</p>
              <p className="text-lg font-bold text-white">
                {bookingData?.startTime ? new Date(bookingData.startTime).toLocaleDateString('id-ID') : bookingData?.startDate}
              </p>
              <p className="text-white/60 text-lg mt-1">{bookingData?.durationHours || 24} Jam</p>
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
                <tr>
                  <td className="py-6 font-medium text-white/90">Sewa {bookingData?.unit}</td>
                  <td className="py-6 text-right font-bold text-white">Rp {((bookingData?.totalPrice || 0) - (bookingData?.deliveryFee || 0) - (bookingData?.fines?.totalLateFine || 0) - (bookingData?.fines?.totalDamageFine || 0) - (bookingData?.fines?.totalInternalFine || 0)).toLocaleString('id-ID')}</td>
                </tr>
                {bookingData?.deliveryFee > 0 && (
                  <tr>
                    <td className="py-6 font-medium text-white/90 border-t border-white/5">Biaya Ongkir / Antar Jemput</td>
                    <td className="py-6 text-right font-bold text-white border-t border-white/5">Rp {bookingData?.deliveryFee.toLocaleString('id-ID')}</td>
                  </tr>
                )}
                {bookingData?.fines?.totalLateFine > 0 && (
                  <tr>
                    <td className="py-6 font-medium text-red-400 border-t border-white/5">Denda Telat ({bookingData.fines.lateHours} Jam)</td>
                    <td className="py-6 text-right font-bold text-red-400 border-t border-white/5">Rp {bookingData.fines.totalLateFine.toLocaleString('id-ID')}</td>
                  </tr>
                )}
                {bookingData?.fines?.totalDamageFine > 0 && (
                  <tr>
                    <td className="py-6 font-medium text-red-400 border-t border-white/5">Denda Kerusakan/Kehilangan</td>
                    <td className="py-6 text-right font-bold text-red-400 border-t border-white/5">Rp {bookingData.fines.totalDamageFine.toLocaleString('id-ID')}</td>
                  </tr>
                )}
                {bookingData?.fines?.totalInternalFine > 0 && (
                  <tr>
                    <td className="py-6 font-medium text-red-400 border-t border-white/5">Denda Khusus/Internal</td>
                    <td className="py-6 text-right font-bold text-red-400 border-t border-white/5">Rp {bookingData.fines.totalInternalFine.toLocaleString('id-ID')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end relative z-10">
            <div className="w-1/2 bg-playbox-accent/10 rounded-2xl p-6 border border-playbox-accent/20">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[#9BA1B0] font-semibold text-lg">Total</span>
                <span className="text-4xl font-black text-white tracking-tight">Rp {bookingData?.totalPrice?.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-playbox-accent/20 mt-4">
                <span className="text-[#9BA1B0] font-medium">Status Pembayaran</span>
                <span className="bg-[#23C552]/20 text-[#23C552] px-4 py-1 rounded-full font-bold uppercase tracking-widest text-sm border border-[#23C552]/30">
                  LUNAS
                </span>
              </div>
            </div>
          </div>

          <div className="mt-16 text-center text-white/40 font-medium text-sm relative z-10">
            <p>Terima kasih telah menggunakan layanan {businessName}.</p>
            <p className="mt-1">Invoice ini dicetak secara otomatis dan sah sebagai bukti transaksi.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
