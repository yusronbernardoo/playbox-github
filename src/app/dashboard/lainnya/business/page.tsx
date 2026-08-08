'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BusinessSettings() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/dashboard/lainnya/toko');
  }, [router]);

  return (
    <div className="p-8 text-center text-white/60 text-sm">
      Mengarahkan ke Pengaturan Profil & Outlet Bisnis...
    </div>
  );
}
