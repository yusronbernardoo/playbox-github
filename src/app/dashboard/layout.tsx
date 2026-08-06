'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string>('');
  const [isAuth, setIsAuth] = useState(false);
  const [newBookingToast, setNewBookingToast] = useState<any>(null);

  const [tabs, setTabs] = useState([
    { name: 'Beranda', path: '/dashboard', icon: '🏠' },
    { name: 'Unit', path: '/dashboard/unit', icon: '🎮' },
    { name: 'Booking', path: '/dashboard/booking', icon: '📅' },
    { name: 'Keuangan', path: '/dashboard/keuangan', icon: '💰' },
    { name: 'Lainnya', path: '/dashboard/lainnya', icon: '☰' },
  ]);

  useEffect(() => {
    const authData = localStorage.getItem('playbox_auth');
    if (!authData) {
      router.push('/login');
      return;
    }
    const parsed = JSON.parse(authData);
    setRole(parsed.role);
    setIsAuth(true);

    if (parsed.role === 'kasir') {
      setTabs([
        { name: 'Unit', path: '/dashboard/unit', icon: '🎮' },
        { name: 'Booking', path: '/dashboard/booking', icon: '📅' },
        { name: 'Lainnya', path: '/dashboard/lainnya', icon: '☰' },
      ]);
      
      // Jika kasir masuk ke Beranda (/dashboard), lempar langsung ke Booking
      if (pathname === '/dashboard') {
        router.push('/dashboard/booking');
      }
    }
  }, [router, pathname]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'playbox_mock_bookings' && e.newValue) {
        const oldBookings = e.oldValue ? JSON.parse(e.oldValue) : [];
        const newBookings = JSON.parse(e.newValue);
        
        if (newBookings.length > oldBookings.length) {
          const latestBooking = newBookings[newBookings.length - 1];
          if (latestBooking.status === 'Perlu Verifikasi') {
            // Tampilkan notifikasi
            setNewBookingToast(latestBooking);
            
            // Sembunyikan otomatis setelah 5 detik
            setTimeout(() => {
              setNewBookingToast(null);
            }, 5000);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  if (!isAuth) return <div className="min-h-screen bg-playbox-bg"></div>;

  return (
    <div className="flex flex-col min-h-screen bg-playbox-bg text-playbox-text-primary relative overflow-hidden">
      {/* Premium Ambient Background */}
      <div className="ambient-glow"></div>

      {/* Main Content Area */}
      <main className="flex-1 pb-24 overflow-y-auto relative z-10">
        {children}
      </main>

      {/* Real-time Notification Toast */}
      {newBookingToast && (
        <div className="fixed top-4 left-4 right-4 z-[100] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-[#0E1221]/90 backdrop-blur-xl border border-playbox-accent/40 rounded-2xl p-4 shadow-[0_10px_40px_rgba(226,23,142,0.4)] flex items-start space-x-3 cursor-pointer hover:bg-[#0E1221]" onClick={() => {
            router.push(`/dashboard/booking`);
            setNewBookingToast(null);
          }}>
            <div className="w-10 h-10 rounded-full bg-playbox-accent/20 flex items-center justify-center text-xl shrink-0 border border-playbox-accent/30 animate-pulse">
              🔔
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white text-sm">Pesanan Baru Masuk!</h3>
              <p className="text-xs text-white/70 mt-1"><span className="font-semibold text-playbox-accent">{newBookingToast.customer}</span> mem-booking {newBookingToast.unit}</p>
              <p className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">{newBookingToast.code}</p>
            </div>
            <button 
              className="text-white/50 hover:text-white p-1"
              onClick={(e) => {
                e.stopPropagation();
                setNewBookingToast(null);
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Premium Bottom Navigation */}
      <nav className="fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2 max-w-md left-1/2 -translate-x-1/2 bg-[#0E1221]/80 backdrop-blur-2xl border-t border-white/5 px-4 py-3 flex justify-between items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path || (tab.path !== '/dashboard' && pathname.startsWith(tab.path));
          
          return (
            <Link 
              key={tab.name} 
              href={tab.path}
              className="relative flex flex-col items-center flex-1 transition-all duration-300 ease-out active:scale-95 group"
            >
              {/* Active Indicator Glow */}
              {isActive && (
                <div className="absolute -top-3 w-8 h-1 bg-playbox-accent rounded-b-full shadow-[0_4px_12px_rgba(226,23,142,0.8)]"></div>
              )}
              
              <span className={`text-xl mb-1 transition-transform duration-300 ${isActive ? '-translate-y-1 drop-shadow-[0_0_8px_rgba(226,23,142,0.5)]' : 'group-hover:-translate-y-0.5 opacity-70 group-hover:opacity-100'}`}>
                {tab.icon}
              </span>
              <span className={`text-[10px] font-medium transition-all duration-300 ${isActive ? 'text-white' : 'text-playbox-text-secondary opacity-70 group-hover:opacity-100'}`}>
                {tab.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
