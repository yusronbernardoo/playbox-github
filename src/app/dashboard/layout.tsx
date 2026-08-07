'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FirebaseProvider, useFirebase } from '@/context/FirebaseContext';
import NotificationToast from '@/components/NotificationToast';

function DashboardContent({ children, tabs, pathname }: { children: React.ReactNode, tabs: any[], pathname: string }) {
  const { isLoading } = useFirebase();

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

  return (
    <div className="flex flex-col min-h-screen bg-playbox-bg text-playbox-text-primary relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      {/* Premium Ambient Background */}
      <div className="ambient-glow"></div>

      {/* Main Content Area */}
      <main className="flex-1 pb-24 overflow-y-auto relative z-10">
        {children}
      </main>

      <NotificationToast />

      {/* Premium Bottom Navigation */}
      <nav className="fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2 bg-[#0E1221]/80 backdrop-blur-2xl border-t border-white/5 px-4 py-3 flex justify-between items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
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
                <div className="absolute -top-3 w-8 h-1 bg-playbox-accent rounded-b-full shadow-[0_4px_12px_rgba(37,99,235,0.8)]"></div>
              )}
              
              <span className={`text-xl mb-1 transition-transform duration-300 ${isActive ? '-translate-y-1 drop-shadow-[0_0_8px_rgba(37,99,235,0.5)]' : 'group-hover:-translate-y-0.5 opacity-70 group-hover:opacity-100'}`}>
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

