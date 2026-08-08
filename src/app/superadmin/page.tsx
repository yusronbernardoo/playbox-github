'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';

// Clean SVG Icons for Professional Dashboard
const Icons = {
  HQ: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  ),
  WhatsApp: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#25D366" stroke="none"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
  ),
  Calendar: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
  ),
  Login: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>
  )
};

export default function SuperAdminPage() {
  const router = useRouter();
  const [isAuth, setIsAuth] = useState(false);
  const [stores, setStores] = useState<any[]>([]);

  useEffect(() => {
    const authData = localStorage.getItem('playbox_auth');
    if (!authData) {
      router.push('/login');
      return;
    }
    const parsed = JSON.parse(authData);
    if (parsed.role !== 'superadmin') {
      router.push('/login');
      return;
    }
    setIsAuth(true);

    const unsubscribe = onSnapshot(collection(db, 'stores'), (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      // Sort by creation date descending
      data.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setStores(data);
    });

    return () => unsubscribe();
  }, [router]);

  const handleBypassLogin = (storeId: string) => {
    const fullUsername = `${storeId}_bos`;
    localStorage.setItem('playbox_auth', JSON.stringify({ 
      username: fullUsername, 
      role: 'owner', 
      storeId: storeId 
    }));
    router.push('/dashboard');
  };

  const handleExtend = async (storeId: string, currentValidUntil: string) => {
    if (!confirm(`Yakin ingin menambah 30 hari masa aktif untuk toko ${storeId}?`)) return;

    const now = new Date();
    const baseDate = (currentValidUntil && new Date(currentValidUntil) > now) 
      ? new Date(currentValidUntil) 
      : now;
    
    // Add 30 days
    const newValidUntil = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    try {
      await updateDoc(doc(db, 'stores', storeId), {
        validUntil: newValidUntil.toISOString(),
        status: 'active'
      });
    } catch (err) {
      console.error(err);
      alert('Gagal memperpanjang langganan.');
    }
  };

  const handleSuspend = async (storeId: string) => {
    if (!confirm(`Yakin ingin membekukan akses toko ${storeId}?`)) return;
    try {
      await updateDoc(doc(db, 'stores', storeId), {
        status: 'suspended'
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnsuspend = async (storeId: string) => {
    if (!confirm(`Yakin ingin membuka blokir toko ${storeId}?`)) return;
    try {
      await updateDoc(doc(db, 'stores', storeId), {
        status: 'active'
      });
    } catch (err) {
      console.error(err);
    }
  };
  
  const handleDelete = async (storeId: string) => {
    if (!confirm(`BAHAYA: Yakin ingin menghapus toko ${storeId} beserta seluruh datanya? Ini tidak bisa di-undo.`)) return;
    try {
      await deleteDoc(doc(db, 'stores', storeId));
    } catch (err) {
      console.error(err);
    }
  };

  if (!isAuth) return null;

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] p-4 sm:p-8 font-sans selection:bg-blue-500/30">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header - Clean & Professional */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#18181b] p-6 rounded-2xl border border-white/10">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-white/80">
              <Icons.HQ />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                RENTERVA HQ
              </h1>
              <p className="text-sm text-white/40 mt-0.5">Super Admin Dashboard</p>
            </div>
          </div>
          <button 
            onClick={() => {
              localStorage.removeItem('playbox_auth');
              router.push('/login');
            }}
            className="w-full sm:w-auto px-6 py-2.5 bg-transparent border border-white/10 text-white/70 text-sm font-medium rounded-lg hover:bg-white/5 hover:text-white transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-[#18181b] p-6 rounded-2xl border border-white/10">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Total Klien</p>
            <p className="text-3xl font-semibold text-white">{stores.length}</p>
          </div>
          <div className="bg-[#18181b] p-6 rounded-2xl border border-white/10">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Klien Aktif</p>
            <p className="text-3xl font-semibold text-emerald-400">
              {stores.filter(s => s.status === 'active').length}
            </p>
          </div>
          <div className="bg-[#18181b] p-6 rounded-2xl border border-white/10 col-span-2 md:col-span-1">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Klien Trial</p>
            <p className="text-3xl font-semibold text-amber-400">
              {stores.filter(s => s.status === 'trial').length}
            </p>
          </div>
        </div>

        {/* Store Cards */}
        <div className="pt-2">
          <h2 className="text-base font-semibold text-white/80 mb-6">
            Daftar Tenant (Toko)
          </h2>
          
          {/* CRITICAL FIX: grid-cols-1 forces full width on mobile so content never squishes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {stores.map((store) => {
              const isExpired = store.validUntil && new Date(store.validUntil) < new Date();
              
              return (
                <div key={store.id} className="bg-[#18181b] rounded-2xl border border-white/10 overflow-hidden flex flex-col">
                  {/* Card Header */}
                  <div className="p-5 border-b border-white/5 flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-base text-white">{store.brandName || 'Toko Tanpa Nama'}</h3>
                      <p className="font-mono text-xs text-white/40 mt-1">ID: {store.id}</p>
                    </div>
                    <div>
                      {store.status === 'suspended' ? (
                        <span className="px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">Suspended</span>
                      ) : isExpired ? (
                        <span className="px-2.5 py-1 rounded-md bg-orange-500/10 text-orange-400 text-xs font-medium border border-orange-500/20">Expired</span>
                      ) : store.status === 'trial' ? (
                        <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 text-xs font-medium border border-amber-500/20">Trial</span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">Active</span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex-1 flex flex-col justify-center space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                        <Icons.WhatsApp />
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40 uppercase tracking-wider">WhatsApp</p>
                        <p className="text-sm font-medium text-white/80">{store.phone || '-'}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 text-white/50">
                        <Icons.Calendar />
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40 uppercase tracking-wider">Valid Until</p>
                        {store.validUntil ? (
                          <p className={`text-sm font-medium ${isExpired ? 'text-red-400' : 'text-white/80'}`}>
                            {new Date(store.validUntil).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        ) : (
                          <p className="text-sm font-medium text-white/30">-</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="p-4 border-t border-white/5 bg-[#121214] grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => handleExtend(store.id, store.validUntil)}
                      className="py-2 bg-emerald-500 text-[#09090b] font-semibold rounded-lg hover:bg-emerald-400 transition-colors text-xs"
                    >
                      +30 Hari
                    </button>
                    
                    <button 
                      onClick={() => handleBypassLogin(store.id)}
                      className="py-2 bg-white text-[#09090b] font-semibold rounded-lg hover:bg-white/90 transition-colors text-xs flex items-center justify-center space-x-1"
                    >
                      <Icons.Login />
                      <span>Bypass</span>
                    </button>
                    
                    {store.status === 'suspended' ? (
                      <button 
                        onClick={() => handleUnsuspend(store.id)}
                        className="py-2 border border-emerald-500/30 text-emerald-400 font-medium rounded-lg hover:bg-emerald-500/10 transition-colors text-xs"
                      >
                        Unsuspend
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleSuspend(store.id)}
                        className="py-2 border border-white/10 text-white/60 font-medium rounded-lg hover:bg-white/5 transition-colors text-xs"
                      >
                        Suspend
                      </button>
                    )}
                    
                    <button 
                      onClick={() => handleDelete(store.id)}
                      className="py-2 border border-red-500/20 text-red-400 font-medium rounded-lg hover:bg-red-500/10 transition-colors text-xs"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}

            {stores.length === 0 && (
              <div className="col-span-full bg-[#18181b] p-12 rounded-2xl text-center border border-white/10">
                <p className="text-white/40 text-sm">Belum ada tenant yang mendaftar.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
