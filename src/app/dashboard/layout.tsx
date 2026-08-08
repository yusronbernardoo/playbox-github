'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FirebaseProvider, useFirebase } from '@/context/FirebaseContext';
import NotificationToast from '@/components/NotificationToast';

function DashboardContent({ children, tabs, pathname }: { children: React.ReactNode, tabs: any[], pathname: string }) {
  const { isLoading, shopInfo } = useFirebase();
  const isMainTab = ['/dashboard', '/dashboard/unit', '/dashboard/booking', '/dashboard/keuangan', '/dashboard/lainnya'].includes(pathname);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-playbox-bg flex items-center justify-center relative overflow-hidden">
        <div className="ambient-glow"></div>
        <div className="flex flex-col items-center z-10 animate-in fade-in duration-500">
          <div className="w-24 h-16 mb-5 relative flex justify-center items-center">
            <img src="/renterva-logo.png" alt="Renterva Play" className="w-full h-full object-contain animate-pulse drop-shadow-[0_0_15px_rgba(37,99,235,0.4)]" />
          </div>
          <p className="text-xs font-bold text-playbox-text-secondary uppercase tracking-widest mb-3 animate-pulse">Menyiapkan Workspace</p>
          <div className="flex space-x-2">
            <div className="w-1.5 h-1.5 rounded-full bg-playbox-accent animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-1.5 h-1.5 rounded-full bg-playbox-accent animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-1.5 h-1.5 rounded-full bg-playbox-accent animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  // Check SaaS expiration
  if (shopInfo) {
    const isSuspended = shopInfo.status === 'suspended';
    const isExpired = shopInfo.validUntil && new Date(shopInfo.validUntil) < new Date();
    
    if (isSuspended || isExpired) {
      return (
        <div className="min-h-screen bg-playbox-bg flex items-center justify-center relative overflow-hidden p-4">
          <div className="ambient-glow"></div>
          <div className="glass-surface-elevated p-8 rounded-3xl w-full max-w-sm relative z-10 text-center border border-red-500/20">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-white mb-2">Akses Terkunci</h2>
            <p className="text-sm text-playbox-text-secondary mb-6 leading-relaxed">
              {isSuspended 
                ? 'Akun toko Anda telah ditangguhkan oleh Admin Pusat.' 
                : 'Masa aktif langganan Anda telah habis.'}
            </p>
            <a 
              href={`https://wa.me/6282336756037?text=Halo%20Admin%20Renterva,%20saya%20dari%20toko%20${shopInfo.brandName || shopInfo.id}%20ingin%20memperpanjang%20langganan%20aplikasi.`} 
              target="_blank" 
              className="w-full block py-3.5 bg-playbox-accent text-white rounded-2xl font-bold shadow-[0_8px_30px_rgba(37,99,235,0.4)] hover:shadow-[0_8px_30px_rgba(37,99,235,0.6)] active:scale-95 transition-all text-sm"
            >
              Hubungi Admin via WA
            </a>
          </div>
        </div>
      );
    }
  }

  let warningBanner = null;
  if (shopInfo && shopInfo.validUntil) {
    const validUntil = new Date(shopInfo.validUntil);
    const daysRemaining = Math.ceil((validUntil.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining <= 3 && daysRemaining > 0) {
      warningBanner = (
        <div className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-2 text-center sticky top-0 z-50 backdrop-blur-md">
          <p className="text-[11px] sm:text-xs font-medium text-orange-400">
            ⚠️ Masa aktif langganan sisa <strong className="font-bold">{daysRemaining} hari</strong>.{' '}
            <a 
              href={`https://wa.me/6282336756037?text=Halo%20Admin%20Renterva,%20saya%20dari%20toko%20${shopInfo.brandName || shopInfo.id}%20ingin%20memperpanjang%20langganan%20aplikasi.`}
              target="_blank"
              className="font-bold underline hover:text-orange-300 transition-colors"
            >
              Klik di sini untuk WA Admin
            </a>
          </p>
        </div>
      );
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-playbox-bg text-playbox-text-primary relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      {/* Premium Ambient Background */}
      <div className="ambient-glow"></div>
      {warningBanner}

      {/* Main Content Area */}
      <main className={`flex-1 ${isMainTab ? 'pb-24' : 'pb-6'} overflow-y-auto relative z-10`}>
        {children}
      </main>

      <NotificationToast />

      {/* Premium Bottom Navigation - only displayed on main tabs */}
      {isMainTab && (
        <nav className="fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2 bg-[#0E1221]/90 backdrop-blur-2xl border-t border-white/5 px-4 py-3 flex justify-between items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          {tabs.map((tab) => {
            const isActive = pathname === tab.path;
            
            return (
              <Link 
                key={tab.name} 
                href={tab.path}
                className="relative flex flex-col items-center flex-1 transition-all duration-300 ease-out active:scale-95 group"
              >
                {/* Active Indicator Glow */}
                {isActive && (
                  <div className="absolute -top-3 w-8 h-1 bg-playbox-accent rounded-b-full shadow-[0_4px_12px_rgba(37,99,235,0.8)]"></div>
                )}
                
                <span className={`text-xl mb-1 transition-transform duration-300 ${isActive ? '-translate-y-1 drop-shadow-[0_0_8px_rgba(37,99,235,0.5)]' : 'group-hover:-translate-y-0.5 opacity-70 group-hover:opacity-100'}`}>
                  {tab.icon}
                </span>
                <span className={`text-[10px] font-medium transition-all duration-300 ${isActive ? 'text-white font-bold' : 'text-playbox-text-secondary opacity-70 group-hover:opacity-100'}`}>
                  {tab.name}
                </span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string>('');
  const [isAuth, setIsAuth] = useState(false);

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


  if (!isAuth) {
    return (
      <div className="min-h-screen bg-playbox-bg flex items-center justify-center relative overflow-hidden">
        <div className="ambient-glow"></div>
        <div className="flex flex-col items-center z-10 animate-pulse">
          <div className="w-24 h-16 mb-4 flex justify-center items-center">
             <img src="/renterva-logo.png" alt="Renterva Play" className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(37,99,235,0.4)]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <FirebaseProvider>
      <DashboardContent tabs={tabs} pathname={pathname}>
        {children}
      </DashboardContent>
    </FirebaseProvider>
  );
}

