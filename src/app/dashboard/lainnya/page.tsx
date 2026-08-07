'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export default function LainnyaPage() {
  const router = useRouter();
  const [role, setRole] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [shopName, setShopName] = useState<string>('PlayBox Malang');
  const [shopLogo, setShopLogo] = useState<string>('');

  useEffect(() => {
    const authData = localStorage.getItem('playbox_auth');
    if (authData) {
      const parsed = JSON.parse(authData);
      setRole(parsed.role);
      setUsername(parsed.username);
    }
    
    const shopSettings = localStorage.getItem('playbox_shop_settings');
    if (shopSettings) {
      try {
        const parsed = JSON.parse(shopSettings);
        if (parsed.brandName) setShopName(parsed.brandName);
        if (parsed.logo) setShopLogo(parsed.logo);
      } catch {}
    }

    const unsubscribeShop = onSnapshot(doc(db, 'settings', 'shop'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.brandName !== undefined) {
          setShopName(data.brandName);
        }
        if (data.logo !== undefined) {
          setShopLogo(data.logo);
        }
        localStorage.setItem('playbox_shop_settings', JSON.stringify(data));
      }
    });

    return () => unsubscribeShop();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('playbox_auth');
    router.push('/login');
  };

  return (
    <div className="p-4 space-y-6 pb-24 h-full">
      {/* Header */}
      <div className="flex items-center mt-2 mb-6">
        <h1 className="text-xl font-bold">Lainnya</h1>
      </div>

      {/* Profil Bisnis */}
      <div className="bg-playbox-surface p-4 rounded-2xl border border-[#2A3455] flex items-center space-x-4">
        {shopLogo ? (
          <img 
            src={shopLogo} 
            alt="Logo Toko" 
            className="w-16 h-16 rounded-full object-cover border-2 border-playbox-accent shadow-[0_4px_20px_rgba(37,99,235,0.3)] bg-black/40 flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-playbox-gradient-start to-playbox-gradient-end flex items-center justify-center text-white text-2xl font-bold uppercase shadow-[0_4px_20px_rgba(37,99,235,0.3)] flex-shrink-0">
            {shopName.charAt(0) || 'P'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-lg truncate text-white">{role === 'owner' ? shopName : `Kasir: ${username}`}</h2>
          <p className="text-sm text-playbox-text-secondary">{role === 'owner' ? 'Renterva Play' : 'Akses Terbatas'}</p>
        </div>
      </div>

      {/* Menu List */}
      <div className="space-y-6">
        {role === 'owner' ? (
          <>
            {/* Group 1 */}
            <div>
              <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3 ml-1">Toko & Keuangan</h3>
              <div className="bg-playbox-surface rounded-xl border border-white/10 overflow-hidden shadow-sm">
                <div className="divide-y divide-white/5">
                  <Link href="/dashboard/lainnya/toko" className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group relative overflow-hidden bg-gradient-to-r from-playbox-accent/10 to-transparent">
                    <div className="absolute left-0 top-0 w-1 h-full bg-playbox-accent shadow-[0_0_10px_rgba(37,99,235,0.5)]"></div>
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-full bg-playbox-accent/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-playbox-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                      </div>
                      <span className="font-bold text-white">Profil & Outlet Bisnis</span>
                    </div>
                    <span className="text-playbox-accent text-sm font-bold">Set →</span>
                  </Link>
                  <Link href="/dashboard/lainnya/payments" className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-playbox-accent/20 transition-colors">
                        <svg className="w-4 h-4 text-white/70 group-hover:text-playbox-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                      </div>
                      <span className="font-medium text-white/80 group-hover:text-white transition-colors">Metode Pembayaran</span>
                    </div>
                    <span className="text-white/20 group-hover:text-playbox-accent transition-colors">→</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Group 2 */}
            <div>
              <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3 ml-1">Operasional Sewa</h3>
              <div className="bg-playbox-surface rounded-xl border border-white/10 overflow-hidden shadow-sm">
                <div className="divide-y divide-white/5">
                  <Link href="/dashboard/lainnya/terms" className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-playbox-accent/20 transition-colors">
                        <svg className="w-4 h-4 text-white/70 group-hover:text-playbox-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <span className="font-medium text-white/80 group-hover:text-white transition-colors">Syarat & Ketentuan Sewa</span>
                    </div>
                    <span className="text-white/20 group-hover:text-playbox-accent transition-colors">→</span>
                  </Link>
                  <Link href="/dashboard/lainnya/ongkir" className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-playbox-accent/20 transition-colors">
                        <svg className="w-4 h-4 text-white/70 group-hover:text-playbox-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </div>
                      <span className="font-medium text-white/80 group-hover:text-white transition-colors">Pengaturan Ongkir (Jarak)</span>
                    </div>
                    <span className="text-white/20 group-hover:text-playbox-accent transition-colors">→</span>
                  </Link>
                  <Link href="/dashboard/lainnya/denda" className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-playbox-accent/20 transition-colors">
                        <svg className="w-4 h-4 text-white/70 group-hover:text-playbox-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <span className="font-medium text-white/80 group-hover:text-white transition-colors">Pengaturan Denda (Waktu)</span>
                    </div>
                    <span className="text-white/20 group-hover:text-playbox-accent transition-colors">→</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Group 3 */}
            <div>
              <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3 ml-1">Tim</h3>
              <div className="bg-playbox-surface rounded-xl border border-white/10 overflow-hidden shadow-sm">
                <Link href="/dashboard/lainnya/admins" className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-playbox-accent/20 transition-colors">
                      <svg className="w-4 h-4 text-white/70 group-hover:text-playbox-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    </div>
                    <span className="font-medium text-white/80 group-hover:text-white transition-colors">Manajemen Admin</span>
                  </div>
                  <span className="text-white/20 group-hover:text-playbox-accent transition-colors">→</span>
                </Link>
              </div>
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-white/50 text-sm glass-surface rounded-xl">
            Tidak ada menu pengaturan yang tersedia untuk Kasir.
          </div>
        )}
      </div>

      {/* Logout */}
      <div className="pt-4">
        <button 
          onClick={handleLogout}
          className="w-full py-3.5 rounded-xl font-bold bg-white/5 border border-white/10 text-red-500 hover:bg-red-500/10 hover:border-red-500 transition-colors"
        >
          Keluar (Logout)
        </button>
        <p className="text-center text-[10px] text-white/30 font-medium mt-4 tracking-widest">RENTERVA PLAY v1.0.0</p>
      </div>
    </div>
  );
}
