'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { useFirebase } from '@/context/FirebaseContext';

const generateSmoothPath = (data: number[], max: number) => {
  if (!data || data.length === 0) return '';
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - (Math.max((val / (max || 1)) * 100, 5));
    return { x, y };
  });

  let path = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cp1x = p0.x + (p1.x - p0.x) / 2.5;
    const cp1y = p0.y;
    const cp2x = p1.x - (p1.x - p0.x) / 2.5;
    const cp2y = p1.y;
    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
  }
  return path;
};

export default function DashboardHome({ customUnits }: { customUnits?: any[] }) {
  const { bookings, shopInfo, units } = useFirebase();
  const [greeting, setGreeting] = useState("Halo");
  const [businessName, setBusinessName] = useState("PlayBox Malang");
  const [shopLogo, setShopLogo] = useState<string>("");
  const tier = "PRO";

  useEffect(() => {
    if (shopInfo) {
      if (shopInfo.brandName) setBusinessName(shopInfo.brandName);
      if (shopInfo.logo !== undefined) setShopLogo(shopInfo.logo);
    }
  }, [shopInfo]);

  const [stats, setStats] = useState({
    totalUnit: 0,
    unitReady: 0,
    unitDisewa: 0,
    unitMaintenance: 0,
    bookingBaru: 0
  });

  const [tasks, setTasks] = useState<any[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [chartData, setChartData] = useState({ data: [0,0,0,0,0,0,0], labels: ['','','','','','',''], max: 1 });
  const [topUnits, setTopUnits] = useState<any[]>([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    setIsMounted(true);
    // Dynamic greeting based on time
    const hour = new Date().getHours();
    if (hour < 11) setGreeting("Selamat Pagi");
    else if (hour < 15) setGreeting("Selamat Siang");
    else if (hour < 18) setGreeting("Selamat Sore");
    else setGreeting("Selamat Malam");

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [bookings, units, currentTime]);

  const loadDashboardData = () => {
    // 2. Load Bookings
    const localBookings = bookings && bookings.length > 0 ? bookings : [];

    // Calculate active busy keys based on REAL TIME overlaps
    const activeBookings = localBookings.filter((b: any) => b.status && b.status !== 'Selesai' && b.status !== 'Dibatalkan');
    const nowMs = currentTime.getTime();
    
    const activeBusyKeys = new Set<string>();
    activeBookings.forEach((b: any) => {
      const startMs = b.isoStart ? new Date(b.isoStart).getTime() : 
                     (b.startTime ? new Date(`${b.startDate || ''} ${b.startTime}`).getTime() : 0);
      const durHours = Number(b.durationHours || b.duration || 24);
      const endMs = b.isoEnd ? new Date(b.isoEnd).getTime() : startMs + (durHours * 60 * 60 * 1000);

      if (nowMs >= startMs && nowMs <= endMs) {
        if (b.unitId) activeBusyKeys.add(b.unitId);
        if (b.unit) activeBusyKeys.add(b.unit);
      }
    });

    // 1. Calculate Unit Stats
    let totalU = 0, readyU = 0, disewaU = 0, maintenanceU = 0;
    
    // Always fallback to localStorage if units context is empty during hydration
    const savedUnits = units && units.length > 0 ? units : (localStorage.getItem('playbox_mock_units') ? JSON.parse(localStorage.getItem('playbox_mock_units')!) : []);
    
    if (savedUnits && savedUnits.length > 0) {
      totalU = savedUnits.length;
      savedUnits.forEach((u: any) => {
        if (u.status === 'Maintenance') {
          maintenanceU++;
        } else {
          // Fallback to u.status === 'Sedang Dipakai' only if it was manually set
          const isBusy = activeBusyKeys.has(u.id) || activeBusyKeys.has(u.name) || u.status === 'Sedang Dipakai';
          if (isBusy) disewaU++;
          else readyU++;
        }
      });
    }

    // 3. Calculate Booking & Financial Stats
    let baruB = 0;
    let pendingTasks: any[] = [];
    let totalRevenue = 0;

    if (localBookings && localBookings.length > 0) {
      baruB = localBookings.filter((b: any) => b.status === 'Perlu Verifikasi').length;
      
      let initialPendingTasks = localBookings.filter((b: any) => 
        ['Perlu Verifikasi', 'Persiapan', 'Diantar', 'Menunggu Pembayaran'].includes(b.status) || b.needAction === true
      );

      const now = currentTime;
      localBookings.forEach((b: any) => {
        if (b.status === 'Selesai' || b.paymentStatus === 'Lunas') {
          totalRevenue += (Number(b.totalPrice) || 0);
        }
        
        // Check for Overdue & Rent Expiry Alert
        if (b.status === 'Sedang Dipakai' || b.status === 'Diantar') {
          try {
            let startDate: Date | null = null;
            let durationHours = Number(b.durationHours || b.duration || 24);

            if (b.isoStart || b.startTime) {
              startDate = new Date(b.isoStart || b.startTime);
            } else if (b.time) {
              const parts = b.time.split(', ');
              if (parts.length === 2) {
                const dateStr = parts[0]; 
                const timeParts = parts[1].split(' ');
                const timeStr = timeParts[0]; 
                startDate = new Date(`${dateStr}T${timeStr}:00`);
              }
            }

            if (startDate && !isNaN(startDate.getTime())) {
              const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);
              const diffMs = endDate.getTime() - now.getTime();
              const diffMins = diffMs / (1000 * 60);

              if (diffMins < 0) {
                // Lewat Waktu (Overdue Denda)
                const lateMins = Math.abs(Math.floor(diffMins));
                const lateHours = Math.ceil(lateMins / 60);
                const lateFineRate = 20000;
                const totalLateEst = lateHours * lateFineRate;

                initialPendingTasks = initialPendingTasks.filter((t: any) => t.id !== b.id);
                initialPendingTasks.unshift({
                  ...b,
                  isWarning: true,
                  isOverdue: true,
                  warningMsg: `Lewat ${lateHours} Jam! (Potensi Denda Rp ${(totalLateEst/1000).toFixed(0)}k)`
                });
              } else if (diffMins <= 30) {
                // Hampir Habis (30 min warning)
                initialPendingTasks = initialPendingTasks.filter((t: any) => t.id !== b.id);
                initialPendingTasks.unshift({
                  ...b,
                  isWarning: true,
                  isOverdue: false,
                  warningMsg: `Sisa ${Math.max(1, Math.ceil(diffMins))} Menit!`
                });
              }
            }
          } catch (e) {
            console.error('Error computing overdue time:', e);
          }
        }
      });
      
      pendingTasks = initialPendingTasks.slice(0, 5);

      // Generate Chart Data (7 Days Revenue)
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
      localBookings.forEach((b: any) => {
        if (b.status === 'Selesai' || b.paymentStatus === 'Lunas') {
          let bDate: Date | null = null;
          if (b.createdAt) {
            bDate = new Date(b.createdAt);
          } else if (b.isoStart || b.startTime) {
            bDate = new Date(b.isoStart || b.startTime);
          } else if (b.time) {
            const parts = b.time.split(', ');
            if (parts.length >= 1) {
              bDate = new Date(parts[0]);
            }
          }
          if (!bDate || isNaN(bDate.getTime())) bDate = new Date();

          bDate.setHours(0, 0, 0, 0);
          const diffDays = Math.round((today.getTime() - bDate.getTime()) / (1000 * 3600 * 24));
          if (diffDays >= 0 && diffDays < 7) {
             cData[6 - diffDays] += (Number(b.totalPrice) || 0);
          }
        }
      });
      
      setChartData({
        data: cData,
        labels: cLabels,
        max: Math.max(...cData) || 1
      });

      // Calculate Top Units
      const unitStats: Record<string, { count: number, revenue: number, name: string }> = {};
      localBookings.forEach((b: any) => {
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
    setRecentBookings([...localBookings].slice(0, 3));
  };

  // Calculate percentage change compared to yesterday
  // Calculate precise Today & Yesterday Revenue
  let todayRev = 0;
  let yesterdayRev = 0;
  let allTimeRev = 0;
  
  const activeLocalBookings = bookings && bookings.length > 0 ? bookings : [];

  if (activeLocalBookings.length > 0) {
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    
    activeLocalBookings.forEach((b: any) => {
      if (b.status === 'Selesai' || b.paymentStatus === 'Lunas') {
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
        
        if (bDate.getDate() === now.getDate() && bDate.getMonth() === now.getMonth() && bDate.getFullYear() === now.getFullYear()) {
          todayRev += (Number(b.totalPrice) || 0);
        } else if (bDate.getDate() === yesterday.getDate() && bDate.getMonth() === yesterday.getMonth() && bDate.getFullYear() === yesterday.getFullYear()) {
          yesterdayRev += (Number(b.totalPrice) || 0);
        }
        allTimeRev += (Number(b.totalPrice) || 0);
      }
    });
  }
  let percentChange = 0;
  if (yesterdayRev > 0) {
    percentChange = Math.round(((todayRev - yesterdayRev) / yesterdayRev) * 100);
  } else if (todayRev > 0) {
    percentChange = 100;
  }

  const summary = [
    { title: "Unit Disewa", count: stats.unitDisewa, color: "text-purple-400", borderColor: "border-purple-500/20 hover:border-purple-500/40", icon: "💼", href: "/dashboard/unit?filter=Disewa" },
    { title: "Unit Ready", count: stats.unitReady, color: "text-playbox-ready", borderColor: "border-emerald-500/20 hover:border-emerald-500/40", icon: "🎮", href: "/dashboard/unit?filter=Ready" },
    { title: "Maintenance", count: stats.unitMaintenance, color: "text-red-500", borderColor: "border-red-500/20 hover:border-red-500/40", icon: "🔧", href: "/dashboard/unit?filter=Maintenance" },
    { title: "Verifikasi", count: stats.bookingBaru, color: "text-yellow-500", borderColor: "border-amber-500/20 hover:border-amber-500/40", icon: "⏳", href: "/dashboard/booking?filter=Perlu Verifikasi" }
  ];

  return (
    <div className="p-4 space-y-7 pb-24 relative">
      <div className="ambient-glow"></div>
      
      {/* Header with Shop Logo */}
      <header className="flex justify-between items-center mt-2 relative z-10">
        <div className="flex items-center space-x-3">
          {shopLogo ? (
            <div className="w-11 h-11 rounded-2xl bg-black/40 border border-white/10 overflow-hidden shrink-0 shadow-md">
              <img src={shopLogo} alt="Logo" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-playbox-gradient-start to-playbox-gradient-end flex items-center justify-center text-lg font-black text-white shrink-0 shadow-md uppercase">
              {businessName ? businessName.charAt(0) : 'P'}
            </div>
          )}
          <div>
            <p className="text-xs text-playbox-text-secondary">{greeting},</p>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold tracking-tight text-white">{businessName}</h1>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-playbox-gradient-start to-playbox-gradient-end text-white">
                {tier}
              </span>
            </div>
          </div>
        </div>

        <Link href="/dashboard/booking" className="p-2.5 glass-surface rounded-full relative transition-transform hover:scale-105 active:scale-95 block border border-white/10">
          <span className="text-lg">🔔</span>
          {stats.bookingBaru > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-yellow-500 rounded-full border border-playbox-surface shadow-[0_0_8px_rgba(234,179,8,0.8)] animate-ping"></span>
          )}
        </Link>
      </header>

      {/* Ringkasan Hari Ini (Permanent Clear Watermark Icons) */}
      <section className="relative z-10">
        <h2 className="text-xs font-bold text-white/70 mb-3 tracking-wider uppercase">Ringkasan Hari Ini</h2>
        <div className="grid grid-cols-2 gap-3">
          {summary.map((item, idx) => (
            <Link 
              href={item.href} 
              key={idx} 
              className={`glass-surface p-4 rounded-2xl flex flex-col items-center justify-center hover:bg-white/10 transition-all duration-200 active:scale-95 relative overflow-hidden group border ${item.borderColor}`}
            >
              {/* Permanent Clear Watermark Icon */}
              <span className="absolute -bottom-1 -right-1 text-4xl opacity-30 group-hover:opacity-45 transition-opacity select-none pointer-events-none">
                {item.icon}
              </span>
              <span className={`text-3xl font-black tracking-tighter z-10 relative ${item.color}`}>{item.count}</span>
              <span className="text-[11px] text-white/80 mt-1 text-center font-semibold z-10 relative">{item.title}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Pendapatan Hari Ini with Growth Percentage */}
      <section className="relative z-10">
        <div className="glass-surface-elevated p-5 rounded-3xl relative overflow-hidden border border-white/10">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-playbox-ready/20 rounded-full blur-3xl"></div>
          <h2 className="text-xs font-bold text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Pendapatan Hari Ini</h2>
          
          <div className="flex justify-between items-end">
            <div>
              <p className="text-3xl font-black tracking-tight text-white">Rp {todayRev.toLocaleString('id-ID')}</p>
              
              <div className="flex items-center mt-2">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded mr-2 flex items-center ${
                  percentChange > 0 ? 'bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30' :
                  percentChange < 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                  'bg-white/10 text-white/60 border border-white/10'
                }`}>
                  {percentChange > 0 ? `▲ +${percentChange}%` : percentChange < 0 ? `▼ ${percentChange}%` : `0%`}
                </span> 
                <span className="text-playbox-text-secondary text-xs">dari kemarin</span>
              </div>
            </div>
            <Link href="/dashboard/keuangan" className="bg-white/10 text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors border border-white/10 text-sm">
              →
            </Link>
          </div>
          
          {/* Minimalist Smooth SVG Area Chart */}
          <div className="mt-8 pt-4 flex w-full h-48 mb-2">
            {/* Y-Axis Labels */}
            <div className="flex flex-col justify-between items-end pr-4 pb-6 text-[9px] text-white/40 font-medium whitespace-nowrap">
              <span>Rp {chartData.max.toLocaleString('id-ID')}</span>
              <span>Rp {(chartData.max * 0.75).toLocaleString('id-ID')}</span>
              <span>Rp {(chartData.max * 0.5).toLocaleString('id-ID')}</span>
              <span>Rp {(chartData.max * 0.25).toLocaleString('id-ID')}</span>
              <span>Rp 0</span>
            </div>

            {/* Chart Area */}
            <div className="flex-1 relative h-full pb-6">
              <svg className="w-full h-full overflow-visible absolute inset-0" preserveAspectRatio="none" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Area Fill */}
                <path 
                  d={`${generateSmoothPath(chartData.data, chartData.max)} L 100,100 L 0,100 Z`} 
                  fill="url(#chartGradient)" 
                  className="animate-in fade-in duration-1000"
                />
                {/* Line Path */}
                <path 
                  d={generateSmoothPath(chartData.data, chartData.max)}
                  fill="none" 
                  stroke="#34d399" 
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-in fade-in duration-1000 drop-shadow-md"
                />
              </svg>

              {/* X-Axis Labels */}
              <div className="absolute bottom-0 translate-y-full left-0 right-0 pointer-events-none h-6 mt-2">
                {chartData.labels.map((lbl, idx) => {
                  const leftPercent = (idx / (chartData.labels.length - 1)) * 100;
                  return (
                    <span 
                      key={idx} 
                      className={`absolute text-[9px] font-medium text-center w-8 -ml-4 ${idx === 6 ? 'text-white' : 'text-white/40'}`}
                      style={{ left: `${leftPercent}%`, top: '8px' }}
                    >
                      {lbl}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Perlu Dikerjakan (Overdue Fines Alert & Urgent Tasks) */}
      <section className="relative z-10">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xs font-bold text-white/70 tracking-wider uppercase">Perlu Dikerjakan</h2>
          <span className="text-[10px] text-white/40">{tasks.length} Tindakan</span>
        </div>

        <div className="space-y-2.5">
          {tasks.length > 0 ? tasks.map((task, idx) => (
            <div 
              key={task.id || idx} 
              className={`glass-surface-elevated p-3.5 rounded-2xl flex justify-between items-center border-l-4 group hover:bg-white/5 transition-all ${
                task.isOverdue ? 'border-l-red-500 bg-red-500/10 border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]' : 
                task.isWarning ? 'border-l-amber-400 bg-amber-400/10 border border-amber-400/20' : 
                task.status === 'Perlu Verifikasi' ? 'border-l-yellow-400' : 'border-l-playbox-accent'
              }`}
            >
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-xs font-bold truncate flex items-center">
                  {task.isOverdue && <span className="mr-1.5 text-sm animate-bounce">🚨</span>}
                  {!task.isOverdue && task.isWarning && <span className="mr-1.5 text-sm animate-pulse">⚠️</span>}
                  <span className={task.isOverdue ? 'text-red-400 font-extrabold' : 'text-white'}>
                    {task.isWarning ? task.warningMsg : task.status === 'Perlu Verifikasi' ? `Verifikasi Booking Baru` : `${task.status} - ${task.unit}`}
                  </span>
                </p>
                <p className="text-[11px] text-playbox-text-secondary mt-0.5 truncate">
                  {task.customer} • {task.unit}
                </p>
              </div>

              <Link 
                href={task.status === 'Perlu Verifikasi' ? `/dashboard/booking/${task.id}/verify` : `/dashboard/booking/${task.id}/timeline`} 
                className={`${
                  task.isOverdue ? 'bg-red-500 text-white shadow-[0_4px_15px_rgba(239,68,68,0.4)] hover:bg-red-600' : 
                  task.isWarning ? 'bg-amber-500 text-white hover:bg-amber-600' : 
                  task.status === 'Perlu Verifikasi' ? 'bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold shadow-[0_4px_15px_rgba(234,179,8,0.4)]' : 'saas-button'
                } text-xs px-3.5 py-2 rounded-xl whitespace-nowrap font-bold transition-all active:scale-95`}
              >
                {task.isOverdue ? 'Tarik & Denda' : task.isWarning ? 'Cek Unit' : task.status === 'Perlu Verifikasi' ? 'Verifikasi' : 'Update'}
              </Link>
            </div>
          )) : (
            <div className="glass-surface p-6 rounded-3xl text-center border border-white/5">
              <span className="text-2xl block mb-1 opacity-50">✨</span>
              <p className="text-xs font-bold text-white/90">Semua Tugas Beres!</p>
              <p className="text-[10px] text-playbox-text-secondary mt-0.5">Belum ada tugas mendesak hari ini.</p>
            </div>
          )}
        </div>
      </section>

      {/* Performa Unit */}
      <section className="relative z-10">
        <h2 className="text-xs font-bold text-white/70 mb-3 tracking-wider uppercase">Performa Unit Terlaris</h2>
        <div className="glass-surface p-4 rounded-3xl space-y-4 border border-white/5">
          {topUnits.length > 0 ? topUnits.map((u, idx) => {
            const maxRev = Math.max(...topUnits.map(x => x.revenue)) || 1;
            const percentage = Math.round((u.revenue / maxRev) * 100);
            
            return (
              <div key={idx} className="relative group">
                <div className="flex justify-between items-end mb-1.5 relative z-10">
                  <div>
                    <p className="text-xs font-bold text-white flex items-center">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} <span className="ml-1.5">{u.name}</span>
                    </p>
                    <p className="text-[10px] text-playbox-text-secondary">{u.count}x Disewa</p>
                  </div>
                  <p className="text-xs font-black text-playbox-accent">Rp {u.revenue.toLocaleString('id-ID')}</p>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-playbox-gradient-start to-playbox-accent rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${isMounted ? percentage : 0}%` }}
                  ></div>
                </div>
              </div>
            );
          }) : (
            <p className="text-xs text-white/40 text-center py-3">Belum ada data penyewaan unit.</p>
          )}
        </div>
      </section>

      {/* Aksi Cepat */}
      <section className="relative z-10">
        <h2 className="text-xs font-bold text-white/70 mb-3 tracking-wider uppercase">Aksi Cepat</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/dashboard/booking/new" className="glass-surface p-3.5 rounded-2xl flex items-center space-x-3 hover:bg-white/5 transition-all duration-200 group active:scale-[0.98] border border-white/5">
            <div className="w-9 h-9 rounded-xl bg-playbox-accent/15 flex items-center justify-center text-playbox-accent group-hover:bg-playbox-accent group-hover:text-white transition-colors text-sm">
              ➕
            </div>
            <span className="font-semibold text-xs text-white">Catat Booking<br/>Manual (WA)</span>
          </Link>
          <Link href="/dashboard/unit/new" className="glass-surface p-3.5 rounded-2xl flex items-center space-x-3 hover:bg-white/5 transition-all duration-200 group active:scale-[0.98] border border-white/5">
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white group-hover:bg-white/10 transition-colors text-sm">
              🎮
            </div>
            <span className="font-semibold text-xs text-white">Tambah<br/>Unit Baru</span>
          </Link>
        </div>
      </section>

      {/* Aktivitas Terakhir */}
      <section className="relative z-10 pb-4">
        <h2 className="text-xs font-bold text-white/70 mb-3 tracking-wider uppercase">Aktivitas Terakhir</h2>
        <div className="space-y-2">
          {recentBookings.length > 0 ? recentBookings.map((b, idx) => (
            <div key={idx} className="glass-surface p-3 rounded-2xl flex justify-between items-center hover:bg-white/5 transition-colors border border-white/5">
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-xs">
                  {b.status === 'Selesai' ? '✅' : b.status === 'Sedang Dipakai' ? '🎮' : '⏳'}
                </div>
                <div>
                  <p className="text-xs font-bold text-white/90 truncate max-w-[150px]">{b.customer}</p>
                  <p className="text-[10px] text-playbox-text-secondary">{b.unit} • {b.status}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-playbox-ready">
                {b.totalPrice ? `Rp ${(b.totalPrice/1000).toFixed(0)}k` : '-'}
              </span>
            </div>
          )) : (
            <p className="text-xs text-white/40 text-center py-2">Belum ada aktivitas.</p>
          )}
        </div>
      </section>
    </div>
  );
}
