'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Keuangan() {
  const router = useRouter();
  const [period, setPeriod] = useState('Hari Ini');
  const [showModal, setShowModal] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const [isExpenseCategoryOpen, setIsExpenseCategoryOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({ category: 'Bensin', amount: '', desc: '' });

  const handleAmountChange = (val: string) => {
    const numeric = val.replace(/\D/g, '');
    setNewExpense({...newExpense, amount: numeric});
  };

  const categories = ['Bensin', 'Servis', 'Update Game', 'Lainnya'];

  const [data, setData] = useState<{
    pendapatan: number;
    pendapatanTren: number;
    rental: number;
    delivery: number;
    denda: number;
    pengeluaranItems: any[];
  }>({
    pendapatan: 0,
    pendapatanTren: 0,
    rental: 0,
    delivery: 0,
    denda: 0,
    pengeluaranItems: []
  });
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    // Check Auth Role
    const authData = localStorage.getItem('playbox_auth');
    if (!authData) {
      router.push('/login');
      return;
    }
    const parsed = JSON.parse(authData);
    if (parsed.role !== 'owner') {
      router.push('/dashboard');
      return;
    }
    setIsAuth(true);

    const savedBookings = localStorage.getItem('playbox_mock_bookings');
    if (savedBookings) {
      const bookings = JSON.parse(savedBookings);
      let totalPendapatan = 0;
      let totalRental = 0;
      let totalDelivery = 0;
      let totalDenda = 0;
      
      const filterBooking = (b: any) => {
        if (!b.isoStart) return true; // fallback
        const bDate = new Date(b.isoStart);
        const now = new Date();
        
        if (period === 'Hari Ini') {
          return bDate.getDate() === now.getDate() && bDate.getMonth() === now.getMonth() && bDate.getFullYear() === now.getFullYear();
        }
        if (period === 'Minggu Ini') {
          // Hitung dari hari Senin sampai Minggu di minggu yang sama
          const day = now.getDay();
          const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
          const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diffToMonday);
          startOfWeek.setHours(0, 0, 0, 0);
          
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);

          return bDate.getTime() >= startOfWeek.getTime() && bDate.getTime() <= endOfWeek.getTime();
        }
        if (period === 'Bulan Ini') {
          return bDate.getMonth() === now.getMonth() && bDate.getFullYear() === now.getFullYear();
        }
        if (selectedDate) {
          return bDate.getDate() === selectedDate.getDate() && bDate.getMonth() === selectedDate.getMonth() && bDate.getFullYear() === selectedDate.getFullYear();
        }
        return true;
      };

      bookings.forEach((b: any) => {
        if ((b.status === 'Selesai' || b.paymentStatus === 'Lunas') && filterBooking(b)) {
          // Calculate fines properly from the Return page structure
          const tDenda = b.fines ? (
            Number(b.fines.totalLateFine || 0) + 
            Number(b.fines.totalDamageFine || 0) + 
            Number(b.fines.totalInternalFine || 0)
          ) : 0;

          const tPrice = Number(b.totalPrice) || 0;
          const tDelivery = b.requireDelivery ? Number(b.deliveryFee) || 0 : 0;
          
          totalPendapatan += tPrice; 
          totalDelivery += tDelivery;
          
          // Rental is total minus delivery and minus denda
          totalRental += (tPrice - tDelivery - tDenda);
          totalDenda += tDenda;
        }
      });

      setData(prev => ({
        ...prev,
        pendapatan: totalPendapatan,
        rental: totalRental,
        delivery: totalDelivery,
        denda: totalDenda,
        pendapatanTren: totalPendapatan > 0 ? 12.5 : 0
      }));
    }
  }, [router, period, selectedDate]);

  if (!isAuth) return <div className="min-h-screen bg-playbox-bg"></div>;

  const pengeluaranTotal = data.pengeluaranItems.reduce((acc, curr) => acc + curr.amount, 0);
  const profit = data.pendapatan - pengeluaranTotal;

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const item = {
      id: Date.now(),
      category: newExpense.category,
      amount: parseInt(newExpense.amount),
      desc: newExpense.desc
    };
    setData({
      ...data,
      pengeluaranItems: [...data.pengeluaranItems, item]
    });
    setNewExpense({ category: 'Bensin', amount: '', desc: '' });
    setShowModal(false);
  };

  // Calendar Helpers
  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  
  const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  
  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  // Adjust starting day to Monday=0 instead of Sunday=0 for Indonesian standard (optional, but let's stick to Sunday=0 for simplicity)
  // Let's use standard Sunday=0: Min, Sen, Sel, Rab, Kam, Jum, Sab
  const weekDays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="p-4 space-y-8 pb-24 relative">
      {/* Header */}
      <div className="flex justify-between items-center mt-2 relative z-20">
        <h1 className="text-2xl font-bold tracking-tight">Keuangan</h1>
        <div className="relative">
          <div 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-2 bg-white/5 border border-white/10 text-white text-sm rounded-xl px-4 py-2 cursor-pointer font-medium hover:bg-white/10 transition-colors shadow-sm backdrop-blur-md"
          >
            <span>{period}</span>
            <span className={`text-[10px] transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
          </div>

          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-[#10152B]/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2">
              {['Hari Ini', 'Minggu Ini', 'Bulan Ini', 'Pilih Tanggal...'].map((opt) => (
                <div 
                  key={opt}
                  onClick={() => {
                    setPeriod(opt);
                    setIsDropdownOpen(false);
                    if (opt === 'Pilih Tanggal...') setShowDatePicker(true);
                  }}
                  className={`px-4 py-3 text-sm cursor-pointer transition-colors flex items-center justify-between ${
                    period === opt ? 'bg-playbox-accent/10 text-playbox-accent font-bold' : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  {opt}
                  {period === opt && <span className="text-playbox-accent">✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Kartu Pendapatan */}
      <div className="glass-surface p-6 rounded-3xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-48 h-48 bg-playbox-ready/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-playbox-ready/20 transition-all duration-700"></div>
        <h2 className="text-xs font-semibold text-playbox-text-secondary mb-2 uppercase tracking-wider">Total Pendapatan</h2>
        <div className="flex flex-col">
          <p className="text-4xl font-bold text-white tracking-tighter">Rp {data.pendapatan.toLocaleString('id-ID')}</p>
          <div className="flex items-center mt-3 space-x-2">
            <span className="bg-playbox-ready/10 text-playbox-ready text-xs px-2 py-1 rounded font-medium tracking-wide">
              ▲ {data.pendapatanTren}%
            </span>
            <span className="text-xs text-playbox-text-secondary">vs periode lalu</span>
          </div>
        </div>
        
        <div className="mt-8 pt-5 border-t border-white/5">
          {/* Progress Bar Proporsi */}
          {data.pendapatan > 0 && (
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex mb-5 shadow-inner">
              <div style={{ width: `${(data.rental / data.pendapatan) * 100}%` }} className="bg-blue-500 h-full"></div>
              <div style={{ width: `${(data.delivery / data.pendapatan) * 100}%` }} className="bg-purple-500 h-full"></div>
              <div style={{ width: `${(data.denda / data.pendapatan) * 100}%` }} className="bg-red-500 h-full"></div>
            </div>
          )}

          <div className="space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-playbox-text-secondary flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2"></span> Sewa Unit</span>
            <span className="font-medium text-white">Rp {data.rental.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-playbox-text-secondary flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-purple-500 mr-2"></span> Biaya Delivery</span>
            <span className="font-medium text-white">Rp {data.delivery.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-playbox-text-secondary flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2"></span> Denda (Fines)</span>
            <span className="font-medium text-white">Rp {data.denda.toLocaleString('id-ID')}</span>
          </div>
          </div>
        </div>
      </div>

      {/* Net Profit */}
      <div className="glass-surface-elevated p-5 rounded-2xl border-l-4 border-l-playbox-ready flex justify-between items-center shadow-[0_8px_30px_rgba(35,197,82,0.15)]">
        <div>
          <h2 className="text-sm font-semibold text-white/80 tracking-wide">Net Profit</h2>
          <p className="text-[9px] text-white/40 font-medium mt-0.5">(Pendapatan - Pengeluaran)</p>
        </div>
        <span className="text-2xl font-bold text-playbox-ready tracking-tight">Rp {profit.toLocaleString('id-ID')}</span>
      </div>

      {/* Pengeluaran */}
      <div className="glass-surface p-6 rounded-3xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-sm font-semibold text-white/80 tracking-wide">Pengeluaran</h2>
          <button onClick={() => setShowModal(true)} className="text-xs font-bold text-white bg-playbox-accent hover:bg-playbox-accent/80 px-4 py-2 rounded-xl transition-all duration-300 active:scale-95 shadow-[0_4px_15px_rgba(226,23,142,0.4)]">
            + Tambah
          </button>
        </div>
        
        <div className="space-y-1">
          {data.pengeluaranItems.length === 0 ? (
            <div className="py-8 text-center text-white/40">
              <span className="text-3xl block mb-2 opacity-30">💸</span>
              <p className="text-xs font-medium">Belum ada catatan pengeluaran <br/>untuk periode ini.</p>
            </div>
          ) : (
            data.pengeluaranItems.map((item, idx) => (
            <div key={item.id} className="flex justify-between items-center py-3 group hover:bg-white/5 rounded-xl px-2 transition-colors -mx-2">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 text-xs font-bold">
                  {idx + 1}
                </div>
                <div>
                  <p className="font-semibold text-sm text-white/90">{item.category}</p>
                  <p className="text-xs text-playbox-text-secondary mt-0.5">{item.desc}</p>
                </div>
              </div>
              <span className="font-bold text-red-400 text-sm tracking-tight">-Rp {item.amount.toLocaleString('id-ID')}</span>
            </div>
            ))
          )}
          
          <div className="pt-5 mt-2 border-t border-white/5 flex justify-between items-center px-2">
            <span className="font-medium text-sm text-playbox-text-secondary">Total Pengeluaran</span>
            <span className="font-bold text-red-400 text-base tracking-tight">-Rp {pengeluaranTotal.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>

      {/* Modal Tambah Pengeluaran */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 max-w-md mx-auto max-w-md mx-auto backdrop-blur-sm z-50 flex items-center justify-center p-4 opacity-100 transition-opacity">
          <div className="glass-surface-elevated w-full max-w-sm rounded-3xl p-6 shadow-2xl scale-100 transition-transform">
            <h2 className="font-bold text-xl mb-6 tracking-tight">Catat Pengeluaran</h2>
            <form onSubmit={handleAddExpense} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Kategori</label>
                <div className="relative">
                  <div 
                    onClick={() => setIsExpenseCategoryOpen(!isExpenseCategoryOpen)}
                    className={`w-full p-3.5 rounded-xl bg-black/20 border text-white text-sm flex justify-between items-center cursor-pointer transition-all ${isExpenseCategoryOpen ? 'border-playbox-accent shadow-[0_0_10px_rgba(226,23,142,0.2)]' : 'border-white/10 hover:border-white/30'}`}
                  >
                    <span>{newExpense.category}</span>
                    <span className={`text-xs opacity-50 transition-transform duration-200 ${isExpenseCategoryOpen ? 'rotate-180' : ''}`}>▼</span>
                  </div>
                  
                  {isExpenseCategoryOpen && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-[#1A2240] border border-[#2A3455] rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                      {categories.map(cat => (
                        <div 
                          key={cat} 
                          onClick={() => {
                            setNewExpense({...newExpense, category: cat});
                            setIsExpenseCategoryOpen(false);
                          }}
                          className={`p-3.5 text-sm cursor-pointer transition-colors flex items-center justify-between ${newExpense.category === cat ? 'bg-playbox-accent/20 text-playbox-accent font-semibold border-l-2 border-playbox-accent' : 'text-white/80 hover:bg-white/5 border-l-2 border-transparent'}`}
                        >
                          {cat}
                          {newExpense.category === cat && <span>✓</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Deskripsi Singkat</label>
                <input 
                  type="text" 
                  value={newExpense.desc} 
                  onChange={e => setNewExpense({...newExpense, desc: e.target.value})}
                  placeholder="Mis: Beli lakban & kardus" 
                  className="w-full p-3.5 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent focus:ring-1 focus:ring-playbox-accent transition-all placeholder:text-white/20" 
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Nominal (Rp)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-playbox-text-secondary text-sm">Rp</span>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={newExpense.amount ? Number(newExpense.amount).toLocaleString('id-ID') : ''} 
                    onChange={e => handleAmountChange(e.target.value)}
                    placeholder="Mis: 150.000" 
                    className="w-full p-3.5 pl-12 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent focus:ring-1 focus:ring-playbox-accent transition-all placeholder:text-white/20" 
                    required 
                  />
                </div>
              </div>
              <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl font-medium text-sm transition-all active:scale-95">Batal</button>
                <button type="submit" className="flex-1 py-3.5 saas-button rounded-xl font-medium text-sm">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Date Picker (Custom Modern Calendar) */}
      {showDatePicker && (
        <div className="fixed inset-0 bg-black/60 max-w-md mx-auto backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 opacity-100 transition-opacity">
          <div className="glass-surface-elevated w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-bold text-lg tracking-tight">Pilih Tanggal</h2>
              <button onClick={() => setShowDatePicker(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors">✕</button>
            </div>
            
            <div className="space-y-4">
              
              {/* Calendar Header */}
              <div className="flex justify-between items-center mb-4 px-2">
                <button onClick={handlePrevMonth} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">←</button>
                <h3 className="font-bold text-sm">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h3>
                <button onClick={handleNextMonth} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">→</button>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {/* Weekday Labels */}
                {weekDays.map((wd, i) => (
                  <div key={i} className="text-[10px] font-bold text-playbox-text-secondary uppercase tracking-wide py-2">
                    {wd}
                  </div>
                ))}
                
                {/* Blank days */}
                {blanks.map(b => (
                  <div key={`blank-${b}`} className="aspect-square"></div>
                ))}
                
                {/* Days */}
                {days.map(d => {
                  const isSelected = selectedDate && selectedDate.getDate() === d && selectedDate.getMonth() === currentMonth.getMonth() && selectedDate.getFullYear() === currentMonth.getFullYear();
                  return (
                    <button 
                      key={d}
                      onClick={() => setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d))}
                      className={`aspect-square flex items-center justify-center text-sm rounded-full transition-all duration-200 ${
                        isSelected 
                        ? 'bg-playbox-accent text-white font-bold shadow-[0_0_10px_rgba(226,23,142,0.6)] scale-110' 
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2">
                <button 
                  disabled={!selectedDate}
                  onClick={() => {
                    if (selectedDate) {
                      setPeriod(`${selectedDate.getDate()} ${monthNames[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`);
                      setShowDatePicker(false);
                    }
                  }}
                  className={`w-full py-3 rounded-xl font-semibold text-sm mt-4 transition-all ${
                    selectedDate 
                    ? 'saas-button shadow-[0_4px_15px_rgba(226,23,142,0.4)]' 
                    : 'bg-white/5 text-white/30 cursor-not-allowed'
                  }`}
                >
                  Terapkan Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
