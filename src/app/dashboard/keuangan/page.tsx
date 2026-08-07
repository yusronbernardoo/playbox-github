'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs } from 'firebase/firestore';

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

  // 2-Step Delete Verification State
  const [expenseToDelete, setExpenseToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAmountChange = (val: string) => {
    const numeric = val.replace(/\D/g, '');
    setNewExpense({...newExpense, amount: numeric});
  };

  const categories = ['Bensin', 'Servis', 'Update Game', 'Konsumsi & Snack', 'Gaji Karyawan', 'Lainnya'];

  const [data, setData] = useState<{
    pendapatan: number;
    pendapatanTren: number;
    trenLabel: string;
    rental: number;
    delivery: number;
    denda: number;
    pengeluaranItems: any[];
  }>({
    pendapatan: 0,
    pendapatanTren: 0,
    trenLabel: 'dari kemarin',
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

    loadFinancialData();

    // Setup Real-Time Listeners for Bookings and Expenses
    const unsubscribeBookings = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      if (!snapshot.empty) {
        const cloudBookings: any[] = [];
        snapshot.forEach((d) => {
          cloudBookings.push({ id: d.id, ...d.data() });
        });
        localStorage.setItem('playbox_mock_bookings', JSON.stringify(cloudBookings));
        loadFinancialData();
      }
    }, (err) => console.warn('Bookings listener fallback:', err));

    const unsubscribeExpenses = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      if (!snapshot.empty) {
        const cloudExpenses: any[] = [];
        snapshot.forEach((d) => {
          cloudExpenses.push({ id: d.id, ...d.data() });
        });
        cloudExpenses.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        localStorage.setItem('playbox_expenses', JSON.stringify(cloudExpenses));
        loadFinancialData();
      }
    }, (err) => console.warn('Expenses listener fallback:', err));

    return () => {
      unsubscribeBookings();
      unsubscribeExpenses();
    };
  }, [router, period, selectedDate]);

  const loadFinancialData = async () => {
    const savedBookings = localStorage.getItem('playbox_mock_bookings');
    let totalPendapatan = 0;
    let prevPendapatan = 0;
    let totalRental = 0;
    let totalDelivery = 0;
    let totalDenda = 0;

    const filterBookingPeriod = (b: any, isPrevious: boolean = false) => {
      let bDate: Date | null = null;
      if (b.createdAt) {
        bDate = new Date(b.createdAt);
      } else if (b.isoStart || b.startTime) {
        bDate = new Date(b.isoStart || b.startTime);
      } else if (b.time) {
        const parts = b.time.split(', ');
        if (parts.length >= 1) bDate = new Date(parts[0]);
      }
      if (!bDate || isNaN(bDate.getTime())) bDate = new Date();
      
      const now = new Date();

      if (period === 'Hari Ini') {
        const target = isPrevious ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1) : now;
        return bDate.getDate() === target.getDate() && bDate.getMonth() === target.getMonth() && bDate.getFullYear() === target.getFullYear();
      }

      if (period === 'Minggu Ini') {
        const day = now.getDay();
        const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diffToMonday);
        startOfWeek.setHours(0, 0, 0, 0);

        if (isPrevious) {
          const startOfLastWeek = new Date(startOfWeek);
          startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
          const endOfLastWeek = new Date(startOfWeek.getTime() - 1);
          return bDate.getTime() >= startOfLastWeek.getTime() && bDate.getTime() <= endOfLastWeek.getTime();
        } else {
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);
          return bDate.getTime() >= startOfWeek.getTime() && bDate.getTime() <= endOfWeek.getTime();
        }
      }

      if (period === 'Bulan Ini') {
        const targetMonth = isPrevious ? new Date(now.getFullYear(), now.getMonth() - 1, 1) : now;
        return bDate.getMonth() === targetMonth.getMonth() && bDate.getFullYear() === targetMonth.getFullYear();
      }

      if (selectedDate) {
        const target = isPrevious ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 1) : selectedDate;
        return bDate.getDate() === target.getDate() && bDate.getMonth() === target.getMonth() && bDate.getFullYear() === target.getFullYear();
      }

      return true;
    };

    if (savedBookings) {
      const bookings = JSON.parse(savedBookings);
      bookings.forEach((b: any) => {
        if (b.status === 'Selesai' || b.paymentStatus === 'Lunas') {
          if (filterBookingPeriod(b, false)) {
            const tDenda = b.fines ? (
              Number(b.fines.totalLateFine || 0) + 
              Number(b.fines.totalDamageFine || 0) + 
              Number(b.fines.totalInternalFine || 0)
            ) : 0;

            const tPrice = Number(b.totalPrice) || 0;
            const tDelivery = b.requireDelivery ? Number(b.deliveryFee) || 0 : 0;
            
            totalPendapatan += tPrice; 
            totalDelivery += tDelivery;
            totalRental += (tPrice - tDelivery - tDenda);
            totalDenda += tDenda;
          }
          if (filterBookingPeriod(b, true)) {
            prevPendapatan += Number(b.totalPrice) || 0;
          }
        }
      });
    }

    let tren = 0;
    if (prevPendapatan > 0) {
      tren = Math.round(((totalPendapatan - prevPendapatan) / prevPendapatan) * 100);
    } else if (totalPendapatan > 0) {
      tren = 100;
    }

    let trenLabel = 'dari kemarin';
    if (period === 'Minggu Ini') trenLabel = 'dari minggu lalu';
    else if (period === 'Bulan Ini') trenLabel = 'dari bulan lalu';
    else if (selectedDate) trenLabel = 'dari H-1';

    // Load Expenses
    let savedExpenses: any[] = [];
    const localExp = localStorage.getItem('playbox_expenses');
    if (localExp) {
      savedExpenses = JSON.parse(localExp);
    } else {
      try {
        const expSnap = await getDocs(collection(db, 'expenses'));
        if (!expSnap.empty) {
          expSnap.forEach(d => savedExpenses.push({ id: d.id, ...d.data() }));
          localStorage.setItem('playbox_expenses', JSON.stringify(savedExpenses));
        }
      } catch (e) {
        console.warn('Load expenses fallback:', e);
      }
    }

    // Filter expenses by period
    const filteredExpenses = savedExpenses.filter((exp: any) => filterBookingPeriod(exp, false));

    setData({
      pendapatan: totalPendapatan,
      rental: totalRental,
      delivery: totalDelivery,
      denda: totalDenda,
      pendapatanTren: tren,
      trenLabel: trenLabel,
      pengeluaranItems: filteredExpenses
    });
  };

  if (!isAuth) return <div className="min-h-screen bg-playbox-bg"></div>;

  const pengeluaranTotal = data.pengeluaranItems.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const profit = data.pendapatan - pengeluaranTotal;

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `EXP-${Date.now()}`;
    const item = {
      id: newId,
      category: newExpense.category,
      amount: parseInt(newExpense.amount),
      desc: newExpense.desc,
      createdAt: new Date().toISOString()
    };

    // 1. Sync to Firestore
    try {
      await setDoc(doc(db, 'expenses', newId), item);
    } catch (err) {
      console.error('Failed adding expense to Firestore:', err);
    }

    // Local State is automatically handled by the onSnapshot real-time listener
    setNewExpense({ category: 'Bensin', amount: '', desc: '' });
    setShowModal(false);
  };

  const handleExportExcel = () => {
    const csvRows = [];
    csvRows.push(['LAPORAN KEUANGAN']);
    csvRows.push(['Periode:', period === 'Pilih Tanggal...' && selectedDate ? selectedDate.toLocaleDateString('id-ID') : period]);
    csvRows.push([]);
    csvRows.push(['RINGKASAN PENDAPATAN']);
    csvRows.push(['Sewa Unit', data.rental]);
    csvRows.push(['Biaya Delivery', data.delivery]);
    csvRows.push(['Denda', data.denda]);
    csvRows.push(['Total Pendapatan', data.pendapatan]);
    csvRows.push([]);
    csvRows.push(['RINCIAN PENGELUARAN']);
    
    let totalPengeluaran = 0;
    if (data.pengeluaranItems.length > 0) {
      csvRows.push(['Tanggal', 'Kategori', 'Nominal', 'Deskripsi']);
      data.pengeluaranItems.forEach(exp => {
        const dateStr = new Date(exp.createdAt).toLocaleString('id-ID').replace(',', '');
        csvRows.push([dateStr, exp.category, exp.amount, `"${(exp.desc || '-').replace(/"/g, '""')}"`]);
        totalPengeluaran += (Number(exp.amount) || 0);
      });
    } else {
      csvRows.push(['Belum ada pengeluaran di periode ini']);
    }
    csvRows.push(['Total Pengeluaran', totalPengeluaran]);
    csvRows.push([]);
    csvRows.push(['PROFIT BERSIH (Laba)', data.pendapatan - totalPengeluaran]);

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateSuffix = period === 'Pilih Tanggal...' && selectedDate ? selectedDate.toLocaleDateString('id-ID').replace(/\//g, '-') : period.replace(/ /g, '_');
    link.setAttribute("download", `Laporan_Keuangan_${dateSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2-Step Delete Execution
  const handleConfirmDelete = async () => {
    if (!expenseToDelete) return;
    setIsDeleting(true);

    try {
      // 1. Delete from Firestore
      try {
        await deleteDoc(doc(db, 'expenses', expenseToDelete.id));
      } catch (err) {
        console.error('Failed deleting expense from Firestore:', err);
      }

      // Local State is automatically handled by the onSnapshot real-time listener
      setIsDeleting(false);
      setExpenseToDelete(null);
    } catch (error) {
      console.error('Delete expense error:', error);
      setIsDeleting(false);
      setExpenseToDelete(null);
    }
  };

  // Calendar Helpers
  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  
  const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  
  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const weekDays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="p-4 space-y-7 pb-24 relative min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-end mt-2 z-20">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Keuangan</h1>
          <p className="text-playbox-text-secondary text-sm mt-0.5 tracking-wide">Ringkasan transaksi Anda</p>
        </div>
        
        <div className="flex items-center gap-2 relative">
          <button 
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 bg-[#107C41]/20 border border-[#107C41]/40 text-[#107C41] text-xs rounded-xl px-3.5 py-2 cursor-pointer font-bold hover:bg-[#107C41]/30 transition-colors shadow-sm backdrop-blur-md"
          >
            <span>📊</span>
            <span>Export Excel</span>
          </button>
          
          <div className="relative">
            <div 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-2 bg-white/5 border border-white/10 text-white text-xs rounded-xl px-3.5 py-2 cursor-pointer font-medium hover:bg-white/10 transition-colors shadow-sm backdrop-blur-md"
            >
              <span>{period}</span>
              <span className={`text-[10px] transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
            </div>

          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-44 bg-[#10152B]/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2 z-30">
              {['Hari Ini', 'Minggu Ini', 'Bulan Ini', 'Pilih Tanggal...'].map((opt) => (
                <div 
                  key={opt}
                  onClick={() => {
                    setPeriod(opt);
                    setIsDropdownOpen(false);
                    if (opt === 'Pilih Tanggal...') setShowDatePicker(true);
                  }}
                  className={`px-3.5 py-2.5 text-xs cursor-pointer transition-colors flex items-center justify-between ${
                    period === opt ? 'bg-playbox-accent/10 text-playbox-accent font-bold' : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  {opt}
                  {period === opt && <span className="text-playbox-accent font-bold">✓</span>}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Kartu Pendapatan */}
      <div className="glass-surface p-6 rounded-3xl relative overflow-hidden group border border-white/5">
        <div className="absolute top-0 right-0 w-48 h-48 bg-playbox-ready/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-playbox-ready/20 transition-all duration-700"></div>
        <h2 className="text-xs font-bold text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Total Pendapatan</h2>
        
        <div className="flex flex-col">
          <p className="text-3xl font-black text-white tracking-tight">Rp {data.pendapatan.toLocaleString('id-ID')}</p>
          <div className="flex items-center mt-2 space-x-2">
            <span className={`text-xs px-2 py-0.5 rounded font-bold tracking-wide border ${
              data.pendapatanTren > 0 ? 'bg-[#25D366]/20 text-[#25D366] border-[#25D366]/30' :
              data.pendapatanTren < 0 ? 'bg-red-500/20 text-red-400 border-red-500/30' :
              'bg-white/10 text-white/60 border-white/10'
            }`}>
              {data.pendapatanTren > 0 ? `▲ +${data.pendapatanTren}%` : data.pendapatanTren < 0 ? `▼ ${data.pendapatanTren}%` : `0%`}
            </span>
            <span className="text-[11px] text-playbox-text-secondary">{data.trenLabel}</span>
          </div>
        </div>
        
        <div className="mt-6 pt-5 border-t border-white/5">
          {/* Progress Bar Proporsi */}
          {data.pendapatan > 0 && (
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex mb-4 shadow-inner">
              <div style={{ width: `${(data.rental / data.pendapatan) * 100}%` }} className="bg-blue-500 h-full"></div>
              <div style={{ width: `${(data.delivery / data.pendapatan) * 100}%` }} className="bg-purple-500 h-full"></div>
              <div style={{ width: `${(data.denda / data.pendapatan) * 100}%` }} className="bg-red-500 h-full"></div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-playbox-text-secondary flex items-center"><span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span> Sewa Unit</span>
              <span className="font-bold text-white">Rp {data.rental.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-playbox-text-secondary flex items-center"><span className="w-2 h-2 rounded-full bg-purple-500 mr-2"></span> Biaya Delivery</span>
              <span className="font-bold text-white">Rp {data.delivery.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-playbox-text-secondary flex items-center"><span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span> Denda</span>
              <span className="font-bold text-white">Rp {data.denda.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Net Profit */}
      <div className="glass-surface-elevated p-5 rounded-3xl border-l-4 border-l-[#25D366] flex justify-between items-center gap-3 relative overflow-hidden border border-white/5 shadow-[0_4px_20px_rgba(37,211,102,0.1)]">
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-bold text-white/90 tracking-wider uppercase truncate">Net Profit (Laba Bersih)</h2>
          <p className="text-[10px] text-white/40 font-medium mt-0.5">(Pendapatan - Pengeluaran)</p>
        </div>
        <div className="shrink-0 text-right">
          <span className={`text-xl sm:text-2xl font-black tracking-tight ${profit >= 0 ? 'text-[#25D366]' : 'text-red-400'}`}>
            {profit < 0 ? `-Rp ${Math.abs(profit).toLocaleString('id-ID')}` : `Rp ${profit.toLocaleString('id-ID')}`}
          </span>
        </div>
      </div>

      {/* Pengeluaran Section with Trash Icon and 2-Step Verification */}
      <div className="glass-surface p-6 rounded-3xl border border-white/5">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="text-xs font-bold text-white/80 tracking-wider uppercase">Pengeluaran Operasional</h2>
            <p className="text-[10px] text-white/40 mt-0.5">{data.pengeluaranItems.length} Catatan</p>
          </div>
          <button 
            onClick={() => setShowModal(true)} 
            className="text-xs font-bold text-white bg-playbox-accent hover:bg-playbox-accent/80 px-3.5 py-2 rounded-xl transition-all duration-200 active:scale-95 shadow-[0_4px_15px_rgba(37,99,235,0.35)]"
          >
            + Tambah
          </button>
        </div>
        
        <div className="space-y-2">
          {data.pengeluaranItems.length === 0 ? (
            <div className="py-8 text-center text-white/40">
              <span className="text-3xl block mb-2 opacity-30">💸</span>
              <p className="text-xs font-medium">Belum ada catatan pengeluaran <br/>untuk periode ini.</p>
            </div>
          ) : (
            data.pengeluaranItems.map((item, idx) => (
              <div 
                key={item.id || idx} 
                className="flex justify-between items-center p-3 group hover:bg-white/5 rounded-2xl transition-all bg-black/20 border border-white/5"
              >
                <div className="flex items-center space-x-3 min-w-0 pr-2">
                  <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/60 text-xs font-bold shrink-0">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-white truncate">{item.category}</p>
                    <p className="text-[10px] text-playbox-text-secondary truncate mt-0.5">{item.desc}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <span className="font-black text-red-400 text-xs tracking-tight">
                    -Rp {(Number(item.amount) || 0).toLocaleString('id-ID')}
                  </span>

                  {/* 🗑️ Trash Delete Icon (Opens 2-Step Verification) */}
                  <button 
                    type="button"
                    onClick={() => setExpenseToDelete(item)}
                    title="Hapus Pengeluaran"
                    className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/20 flex items-center justify-center text-xs transition-colors active:scale-95"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
          
          <div className="pt-4 mt-3 border-t border-white/5 flex justify-between items-center px-1">
            <span className="font-bold text-xs text-playbox-text-secondary">Total Pengeluaran</span>
            <span className="font-black text-red-400 text-sm tracking-tight">-Rp {pengeluaranTotal.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>

      {/* 2-Step Verification Modal for Delete Expense */}
      {expenseToDelete && (
        <div className="fixed inset-0 bg-black/80 max-w-md mx-auto backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="glass-surface-elevated w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-red-500/30 text-center space-y-4">
            <div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center mx-auto border border-red-500/30 text-2xl animate-pulse">
              🗑️
            </div>

            <div>
              <h3 className="font-bold text-base text-white">Hapus Catatan Pengeluaran?</h3>
              <p className="text-xs text-white/60 mt-1">Tindakan ini tidak dapat dibatalkan.</p>
            </div>

            {/* Expense Detail Summary */}
            <div className="p-3.5 bg-black/40 border border-white/10 rounded-2xl text-left text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-white/50">Kategori:</span>
                <span className="font-bold text-white">{expenseToDelete.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Keterangan:</span>
                <span className="font-medium text-white truncate max-w-[160px]">{expenseToDelete.desc}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-white/5">
                <span className="text-white/50">Nominal:</span>
                <span className="font-black text-red-400">Rp {Number(expenseToDelete.amount).toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* 2-Step Confirmation Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => setExpenseToDelete(null)}
                disabled={isDeleting}
                className="py-3 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
              >
                Batal
              </button>
              <button 
                type="button" 
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="py-3 bg-red-500 hover:bg-red-600 shadow-[0_4px_15px_rgba(239,68,68,0.4)] rounded-xl text-xs font-bold text-white transition-all active:scale-95 flex items-center justify-center"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Pengeluaran */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 max-w-md mx-auto backdrop-blur-sm z-50 flex items-center justify-center p-4 opacity-100 transition-opacity">
          <div className="glass-surface-elevated w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-white/10">
            <h2 className="font-bold text-lg mb-5 tracking-tight text-white">Catat Pengeluaran Baru</h2>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-white/60 mb-1.5 uppercase tracking-wider">Kategori</label>
                <div className="relative">
                  <div 
                    onClick={() => setIsExpenseCategoryOpen(!isExpenseCategoryOpen)}
                    className={`w-full p-3 rounded-xl bg-black/30 border text-white text-xs flex justify-between items-center cursor-pointer transition-all ${isExpenseCategoryOpen ? 'border-playbox-accent shadow-[0_0_10px_rgba(37,99,235,0.2)]' : 'border-white/10 hover:border-white/20'}`}
                  >
                    <span>{newExpense.category}</span>
                    <span className={`text-[10px] opacity-50 transition-transform duration-200 ${isExpenseCategoryOpen ? 'rotate-180' : ''}`}>▼</span>
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
                          className={`p-3 text-xs cursor-pointer transition-colors flex items-center justify-between ${newExpense.category === cat ? 'bg-playbox-accent/20 text-playbox-accent font-bold border-l-2 border-playbox-accent' : 'text-white/80 hover:bg-white/5 border-l-2 border-transparent'}`}
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
                <label className="block text-[10px] font-bold text-white/60 mb-1.5 uppercase tracking-wider">Deskripsi Singkat</label>
                <input 
                  type="text" 
                  value={newExpense.desc} 
                  onChange={e => setNewExpense({...newExpense, desc: e.target.value})}
                  placeholder="Mis: Beli lakban & kabel HDMI" 
                  className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white text-xs focus:outline-none focus:border-playbox-accent transition-all placeholder:text-white/20" 
                  required 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-white/60 mb-1.5 uppercase tracking-wider">Nominal (Rp)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-xs">Rp</span>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={newExpense.amount ? Number(newExpense.amount).toLocaleString('id-ID') : ''} 
                    onChange={e => handleAmountChange(e.target.value)}
                    placeholder="Mis: 150.000" 
                    className="w-full p-3 pl-10 rounded-xl bg-black/30 border border-white/10 text-white text-xs focus:outline-none focus:border-playbox-accent transition-all placeholder:text-white/20" 
                    required 
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl font-bold text-xs transition-all active:scale-95">Batal</button>
                <button type="submit" className="flex-1 py-3 bg-playbox-accent hover:bg-opacity-90 rounded-xl font-bold text-xs text-white shadow-lg active:scale-95 transition-all">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Date Picker */}
      {showDatePicker && (
        <div className="fixed inset-0 bg-black/70 max-w-md mx-auto backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 opacity-100 transition-opacity">
          <div className="glass-surface-elevated w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 pb-32 sm:pb-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-white/10">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-bold text-base tracking-tight text-white">Pilih Tanggal</h2>
              <button onClick={() => setShowDatePicker(false)} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors text-xs">✕</button>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-3 px-2">
                <button onClick={handlePrevMonth} className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors text-xs">←</button>
                <h3 className="font-bold text-xs text-white">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h3>
                <button onClick={handleNextMonth} className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors text-xs">→</button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {weekDays.map((wd, i) => (
                  <div key={i} className="text-[9px] font-bold text-playbox-text-secondary uppercase tracking-wide py-1">
                    {wd}
                  </div>
                ))}
                
                {blanks.map(b => (
                  <div key={`blank-${b}`} className="aspect-square"></div>
                ))}
                
                {days.map(d => {
                  const isSelected = selectedDate && selectedDate.getDate() === d && selectedDate.getMonth() === currentMonth.getMonth() && selectedDate.getFullYear() === currentMonth.getFullYear();
                  return (
                    <button 
                      key={d}
                      onClick={() => setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d))}
                      className={`aspect-square flex items-center justify-center text-xs rounded-full transition-all ${
                        isSelected 
                        ? 'bg-playbox-accent text-white font-bold shadow-[0_0_10px_rgba(37,99,235,0.6)] scale-105' 
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
                  className={`w-full py-3 rounded-xl font-bold text-xs mt-2 transition-all ${
                    selectedDate 
                    ? 'bg-playbox-accent text-white shadow-[0_4px_15px_rgba(37,99,235,0.4)] active:scale-95' 
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
