'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

export default function DashboardHome() {
  const [greeting, setGreeting] = useState("Halo");
  const [businessName, setBusinessName] = useState("PlayBox Malang");
  const tier = "PRO";

  const [stats, setStats] = useState({
    totalUnit: 0,
    unitReady: 0,
    unitDisewa: 0,
    unitMaintenance: 0,
    bookingBaru: 0
  });

  const [tasks, setTasks] = useState<any[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [chartData, setChartData] = useState<{data: number[], labels: string[], max: number}>({data: [], labels: [], max: 1});
  const [topUnits, setTopUnits] = useState<any[]>([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);

  useEffect(() => {
    // Dynamic greeting based on time
    const hour = new Date().getHours();
    if (hour < 11) setGreeting("Selamat Pagi");
    else if (hour < 15) setGreeting("Selamat Siang");
    else if (hour < 18) setGreeting("Selamat Sore");
    else setGreeting("Selamat Malam");

    loadDashboardData();

    // Real-time Firestore sync
    const unsubscribe = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      if (!snapshot.empty) {
        const cloudBookings: any[] = [];
        snapshot.forEach((docSnap) => {
          cloudBookings.push({ ...docSnap.data(), id: docSnap.id });
        });
        cloudBookings.sort((a, b) => (b.createdAt || b.id).localeCompare(a.createdAt || a.id));
        localStorage.setItem('playbox_mock_bookings', JSON.stringify(cloudBookings));
        loadDashboardData(cloudBookings);
      }
    });

    const handleStorage = (e: StorageEvent) => {
      if (['playbox_mock_bookings', 'playbox_mock_units', 'playbox_shop_settings'].includes(e.key || '')) {
        loadDashboardData();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const loadDashboardData = (customBookings?: any[]) => {
    // Dynamic SaaS Loading
    const shopSettings = localStorage.getItem('playbox_shop_settings');
    if (shopSettings) {
      setBusinessName(JSON.parse(shopSettings).brandName);
    }

    const savedUnits = localStorage.getItem('playbox_mock_units');
    let totalU = 0, readyU = 0, disewaU = 0, maintenanceU = 0;
    if (savedUnits) {
      const units = JSON.parse(savedUnits);
      totalU = units.length;
      readyU = units.filter((u: any) => u.status === 'Ready').length;
      disewaU = units.filter((u: any) => u.status === 'Disewa').length;
      maintenanceU = units.filter((u: any) => u.status === 'Maintenance').length;
    }

    const savedBookings = localStorage.getItem('playbox_mock_bookings');
    let baruB = 0;
    let pendingTasks: any[] = [];
    let totalRevenue = 0;

    const bookings = customBookings || (savedBookings ? JSON.parse(savedBookings) : []);
    if (bookings && bookings.length > 0) {
      baruB = bookings.filter((b: any) => b.status === 'Perlu Verifikasi').length;
      
      let initialPendingTasks = bookings.filter((b: any) => 
        ['Perlu Verifikasi', 'Persiapan', 'Diantar', 'Menunggu Pembayaran'].includes(b.status) || b.needAction === true
      );

      const now = new Date();
      bookings.forEach((b: any) => {
        if (b.status === 'Selesai' || b.paymentStatus === 'Lunas') {
          totalRevenue += (Number(b.totalPrice) || 0);
        }
        if (b.status === 'Sedang Dipakai') {
          try {
            const parts = b.time.split(', ');
            if (parts.length === 2) {
              const dateStr = parts[0]; 
              const timeParts = parts[1].split(' ');
              const timeStr = timeParts[0]; 
              const durationStr = timeParts[1]; 
              
              const duration = parseInt(durationStr.replace(/\D/g, '')) || 24;
              const startDate = new Date(`${dateStr}T${timeStr}:00`);
              const endDate = new Date(startDate.getTime() + duration * 60 * 60 * 1000);
              
              const diffMs = endDate.getTime() - now.getTime();
              const diffMins = diffMs / (1000 * 60);
              
              if (diffMins <= 30) {
                initialPendingTasks.unshift({
                  ...b,
                  isWarning: true,
                  warningMsg: diffMins <= 0 ? 'Waktu Sewa Habis!' : 'Waktu Hampir Habis!'
                });
              }
            }
          } catch (e) {
            console.error(e);
          }
        }
      });
      
      pendingTasks = initialPendingTasks.slice(0, 4);

      // Generate Chart Data
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      const cLabels = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        cLabels.push(dayNames[d.getDay()]);
      }
      
      let cData = [0, 0, 0, 0, 0, 0, 0];
      bookings.forEach((b: any) => {
        if (b.status === 'Selesai' || b.paymentStatus === 'Lunas') {
          let bDate = new Date();
          if (b.isoStart) {
            bDate = new Date(b.isoStart);
          }
          bDate.setHours(0, 0, 0, 0);
          const diffDays = Math.floor((today.getTime() - bDate.getTime()) / (1000 * 3600 * 24));
          if (diffDays >= 0 && diffDays < 7) {
             cData[6 - diffDays] += (Number(b.totalPrice) || 0);
          }
        }
      });

      // Dummy fallback removed
      
      setChartData({
        data: cData,
        labels: cLabels,
        max: Math.max(...cData) || 1
      });

      // Calculate Top Units
      const unitStats: Record<string, { count: number, revenue: number, name: string }> = {};
      bookings.forEach((b: any) => {
        if (b.status === 'Selesai' || b.paymentStatus === 'Lunas') {
          const key = b.unitId || b.unit;
          if (!unitStats[key]) {
            unitStats[key] = { count: 0, revenue: 0, name: b.unit };
          }
          unitStats[key].count += 1;
          unitStats[key].revenue += (Number(b.totalPrice) || 0);
        }
      });

      let sortedUnits = Object.values(unitStats).sort((a, b) => b.revenue - a.revenue).slice(0, 3);
      setTopUnits(sortedUnits);
    }

    setStats({
      totalUnit: totalU,
      unitReady: readyU,
      unitDisewa: disewaU,
      unitMaintenance: maintenanceU,
      bookingBaru: baruB
    });
    setTasks(pendingTasks);
    setRevenue(totalRevenue);
    
    if (savedBookings) {
      const bookings = JSON.parse(savedBookings);
      setRecentBookings([...bookings].reverse().slice(0, 3));
    }
  };

  const summary = [
    { title: "Unit Disewa", count: stats.unitDisewa, color: "text-playbox-disewa", icon: "💼", href: "/dashboard/unit?filter=Disewa" },
    { title: "Unit Ready", count: stats.unitReady, color: "text-playbox-ready", icon: "🎮", href: "/dashboard/unit?filter=Ready" },
    { title: "Maintenance", count: stats.unitMaintenance, color: "text-red-500", icon: "🔧", href: "/dashboard/unit?filter=Maintenance" },
    { title: "Verifikasi", count: stats.bookingBaru, color: "text-yellow-500", icon: "⏳", href: "/dashboard/booking?filter=Perlu Verifikasi" }
  ];

  return (
    <div className="p-4 space-y-8 pb-24 relative">
      <div className="ambient-glow"></div>
      
      {/* Header */}
      <header className="flex justify-between items-center mt-2 relative z-10">
        <div>
          <p className="text-sm text-playbox-text-secondary">{greeting},</p>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight">{businessName}</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gradient-to-r from-playbox-gradient-start to-playbox-gradient-end text-white">
              {tier}
            </span>
          </div>
        </div>
        <Link href="/dashboard/booking" className="p-2 glass-surface rounded-full relative transition-transform hover:scale-105 active:scale-95 block">
          <span className="text-xl">🔔</span>
          {stats.bookingBaru > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-playbox-accent rounded-full border border-playbox-surface shadow-[0_0_8px_rgba(226,23,142,0.8)]"></span>
          )}
        </Link>
      </header>

      {/* Ringkasan Hari Ini */}
      <section className="relative z-10">
        <h2 className="text-sm font-semibold text-white/80 mb-4 tracking-wide">Ringkasan Hari Ini</h2>
        <div className="grid grid-cols-2 gap-3">
          {summary.map((item, idx) => (
            <Link href={item.href} key={idx} className="glass-surface p-4 rounded-2xl flex flex-col items-center justify-center hover:bg-white/5 transition-all duration-200 active:scale-95 relative overflow-hidden">
              <span className="absolute -bottom-2 -right-1 text-5xl opacity-10 mix-blend-overlay">{item.icon}</span>
              <span className={`text-3xl font-bold tracking-tighter z-10 relative ${item.color}`}>{item.count}</span>
              <span className="text-[10px] text-playbox-text-secondary mt-1 text-center font-medium z-10 relative">{item.title}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Pendapatan Hari Ini */}
      <section className="relative z-10">
        <div className="glass-surface-elevated p-6 rounded-3xl relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-playbox-ready/20 rounded-full blur-3xl"></div>
          <h2 className="text-sm font-semibold text-playbox-text-secondary mb-2 uppercase tracking-wider">Pendapatan Hari Ini</h2>
          <div className="flex justify-between items-end">
            <div>
              <p className="text-4xl font-bold tracking-tighter text-white">Rp {revenue.toLocaleString('id-ID')}</p>
              <p className="text-sm text-playbox-ready font-medium flex items-center mt-2">
                <span className="bg-playbox-ready/10 text-playbox-ready px-1.5 py-0.5 rounded mr-2">
                  {revenue > 0 ? '▲ Naik' : '- Stabil'}
                </span> 
                <span className="text-playbox-text-secondary">dari kemarin</span>
              </p>
            </div>
            <Link href="/dashboard/keuangan" className="bg-white/10 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
              →
            </Link>
          </div>
          
          {/* Bar Chart */}
          <div className="mt-6 pt-4 border-t border-white/5">
            <div className="flex items-end justify-between h-24 gap-2">
              {chartData.data.map((val, idx) => {
                const heightPercent = val === 0 ? 0 : Math.max(5, Math.round((val / chartData.max) * 100));
                const isToday = idx === 6;
                return (
                  <div key={idx} className="flex flex-col justify-end items-center flex-1 group relative h-full">
                    {/* Tooltip on Hover */}
                    <div className="absolute -top-8 bg-white text-black text-[9px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-20">
                      Rp {(val / 1000).toFixed(0)}k
                    </div>
                    {/* Bar */}
                    <div className="w-full bg-white/5 rounded-t-sm flex items-end justify-center rounded-b-sm overflow-hidden flex-1 mb-2">
                      <div 
                        className={`w-full rounded-t-sm rounded-b-sm transition-all duration-700 ease-out ${isToday ? 'bg-gradient-to-t from-playbox-gradient-start to-playbox-accent shadow-[0_0_10px_rgba(226,23,142,0.5)]' : 'bg-white/30 group-hover:bg-white/50'}`} 
                        style={{ height: `${heightPercent}%` }}
                      ></div>
                    </div>
                    {/* Label */}
                    <span className={`text-[9px] font-medium ${isToday ? 'text-white' : 'text-white/40'}`}>{chartData.labels[idx]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Performa Unit */}
      <section className="relative z-10">
        <h2 className="text-sm font-semibold text-white/80 mb-4 tracking-wide">Performa Unit Terlaris</h2>
        <div className="glass-surface p-5 rounded-3xl space-y-5">
          {topUnits.length > 0 ? topUnits.map((u, idx) => {
            const maxRev = Math.max(...topUnits.map(x => x.revenue)) || 1;
            const percentage = Math.round((u.revenue / maxRev) * 100);
            
            return (
              <div key={idx} className="relative group">
                <div className="flex justify-between items-end mb-2 relative z-10">
                  <div>
                    <p className="text-xs font-bold text-white mb-0.5 flex items-center">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} <span className="ml-1.5">{u.name}</span>
                    </p>
                    <p className="text-[10px] text-playbox-text-secondary">{u.count}x Disewa</p>
                  </div>
                  <p className="text-xs font-black text-playbox-accent">Rp {u.revenue.toLocaleString('id-ID')}</p>
                </div>
                {/* Horizontal Progress Bar */}
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-playbox-gradient-start to-playbox-accent rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(226,23,142,0.4)] relative"
                    style={{ width: `${percentage}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 w-1/3 skew-x-12 animate-[shimmer_2s_infinite]"></div>
                  </div>
                </div>
              </div>
            );
          }) : (
            <p className="text-xs text-white/40 text-center py-4">Belum ada data penyewaan unit.</p>
          )}
        </div>
      </section>

      {/* Aksi Cepat */}
      <section className="relative z-10">
        <h2 className="text-sm font-semibold text-white/80 mb-4 tracking-wide">Aksi Cepat</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/dashboard/booking/new" className="glass-surface p-4 rounded-xl flex items-center space-x-3 hover:bg-white/5 transition-all duration-200 group active:scale-[0.98]">
            <div className="w-10 h-10 rounded-lg bg-playbox-accent/10 flex items-center justify-center text-playbox-accent group-hover:bg-playbox-accent group-hover:text-white transition-colors">
              ➕
            </div>
            <span className="font-medium text-sm">Catat Booking<br/>Manual (WA)</span>
          </Link>
          <Link href="/dashboard/unit/new" className="glass-surface p-4 rounded-xl flex items-center space-x-3 hover:bg-white/5 transition-all duration-200 group active:scale-[0.98]">
            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-white group-hover:bg-white/10 transition-colors">
              🎮
            </div>
            <span className="font-medium text-sm">Tambah<br/>Unit</span>
          </Link>
        </div>
      </section>

      {/* Perlu Dikerjakan */}
      <section className="relative z-10">
        <h2 className="text-sm font-semibold text-white/80 mb-4 tracking-wide">Perlu Dikerjakan</h2>
        <div className="space-y-3">
          {tasks.length > 0 ? tasks.map((task, idx) => (
            <div key={task.id || idx} className={`glass-surface-elevated p-4 rounded-xl flex justify-between items-center border-l-2 group hover:bg-white/5 transition-colors ${task.isWarning ? 'border-l-red-500 bg-red-500/10' : task.status === 'Perlu Verifikasi' ? 'border-l-yellow-400' : 'border-l-playbox-accent'}`}>
              <div>
                <p className="text-sm font-bold truncate max-w-[200px] flex items-center">
                  {task.isWarning && <span className="mr-2 text-red-500 animate-pulse">⚠️</span>}
                  {task.isWarning ? task.warningMsg : task.status === 'Perlu Verifikasi' ? `Verifikasi Pembayaran` : `${task.status} - ${task.unit}`}
                </p>
                <p className="text-xs text-playbox-text-secondary mt-0.5 truncate max-w-[200px]">
                  {task.customer} • {task.isWarning ? 'Unit harus ditarik' : task.time}
                </p>
              </div>
              <Link href={task.status === 'Perlu Verifikasi' ? '/dashboard/booking' : `/dashboard/booking/${task.id}/timeline`} className={`${task.isWarning ? 'bg-red-500 text-white shadow-[0_4px_15px_rgba(239,68,68,0.4)]' : task.status === 'Perlu Verifikasi' ? 'saas-button-secondary' : 'saas-button'} text-xs px-4 py-2 rounded-lg whitespace-nowrap ml-2`}>
                {task.isWarning ? 'Tarik Unit' : task.status === 'Perlu Verifikasi' ? 'Cek' : 'Update'}
              </Link>
            </div>
          )) : (
            <div className="glass-surface p-6 rounded-3xl text-center border border-white/5">
              <span className="text-3xl block mb-2 opacity-50">✨</span>
              <p className="text-sm font-bold text-white/90">Semua Tugas Beres!</p>
              <p className="text-xs text-playbox-text-secondary mt-1">Belum ada tugas mendesak hari ini.</p>
            </div>
          )}
        </div>
      </section>

      {/* Aktivitas Terakhir */}
      <section className="relative z-10 pb-4">
        <h2 className="text-sm font-semibold text-white/80 mb-4 tracking-wide">Aktivitas Terakhir</h2>
        <div className="space-y-2">
          {recentBookings.length > 0 ? recentBookings.map((b, idx) => (
            <div key={idx} className="glass-surface p-3.5 rounded-2xl flex justify-between items-center hover:bg-white/5 transition-colors border border-white/5">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs">
                  {b.status === 'Selesai' ? '✅' : b.status === 'Sedang Dipakai' ? '🎮' : '⏳'}
                </div>
                <div>
                  <p className="text-xs font-bold text-white/90 truncate max-w-[150px]">{b.customer}</p>
                  <p className="text-[10px] text-playbox-text-secondary mt-0.5">{b.unit} • {b.status}</p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-playbox-ready">
                {b.totalPrice ? `Rp ${(b.totalPrice/1000).toFixed(0)}k` : '-'}
              </span>
            </div>
          )) : (
             <p className="text-xs text-white/40 text-center py-6 glass-surface rounded-2xl border border-white/5">Belum ada aktivitas transaksi.</p>
          )}
        </div>
      </section>

    </div>
  );
}
