'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';

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
      alert(`Berhasil memperpanjang langganan ${storeId} selama 30 hari!`);
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
    <div className="min-h-screen bg-playbox-bg text-playbox-text-primary p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Ambient Glows */}
      <div className="ambient-glow"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-playbox-accent/10 rounded-full blur-[120px] -z-10"></div>
      
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 glass-surface-elevated p-6 rounded-3xl border border-white/10 shadow-2xl">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-black/50 rounded-2xl border border-white/5 flex items-center justify-center shadow-inner">
              <span className="text-2xl drop-shadow-[0_0_10px_rgba(37,99,235,0.8)]">👑</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-md">
                RENTERVA HQ
              </h1>
              <p className="text-playbox-accent text-sm font-bold tracking-widest mt-1 uppercase">Super Admin Dashboard</p>
            </div>
          </div>
          <button 
            onClick={() => {
              localStorage.removeItem('playbox_auth');
              router.push('/login');
            }}
            className="w-full sm:w-auto px-6 py-3 bg-red-500/10 text-red-400 font-bold rounded-2xl border border-red-500/20 hover:bg-red-500/20 active:scale-95 transition-all shadow-[0_0_15px_rgba(239,68,68,0.15)]"
          >
            LOGOUT
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="glass-surface p-5 sm:p-6 rounded-3xl border border-white/5 shadow-xl relative overflow-hidden group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity blur-md -z-10"></div>
            <p className="text-[10px] sm:text-xs text-white/50 font-bold uppercase tracking-widest mb-1 sm:mb-2">Total Klien</p>
            <p className="text-3xl sm:text-4xl font-black text-white">{stores.length}</p>
          </div>
          <div className="glass-surface p-5 sm:p-6 rounded-3xl border border-white/5 shadow-xl relative overflow-hidden group">
            <div className="absolute -inset-1 bg-gradient-to-r from-green-500/0 via-green-500/10 to-green-500/0 opacity-0 group-hover:opacity-100 transition-opacity blur-md -z-10"></div>
            <p className="text-[10px] sm:text-xs text-white/50 font-bold uppercase tracking-widest mb-1 sm:mb-2">Klien Aktif</p>
            <p className="text-3xl sm:text-4xl font-black text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.3)]">
              {stores.filter(s => s.status === 'active').length}
            </p>
          </div>
          <div className="glass-surface p-5 sm:p-6 rounded-3xl border border-white/5 shadow-xl relative overflow-hidden group col-span-2 md:col-span-1">
            <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500/0 via-yellow-500/10 to-yellow-500/0 opacity-0 group-hover:opacity-100 transition-opacity blur-md -z-10"></div>
            <p className="text-[10px] sm:text-xs text-white/50 font-bold uppercase tracking-widest mb-1 sm:mb-2">Klien Trial</p>
            <p className="text-3xl sm:text-4xl font-black text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.3)]">
              {stores.filter(s => s.status === 'trial').length}
            </p>
          </div>
        </div>

        {/* Store Cards */}
        <div className="pt-4">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center">
            <span className="w-2 h-6 bg-playbox-accent rounded-full mr-3 shadow-[0_0_10px_rgba(37,99,235,0.8)]"></span>
            Daftar Toko (Tenants)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => {
              const isExpired = store.validUntil && new Date(store.validUntil) < new Date();
              
              return (
                <div key={store.id} className="glass-surface-elevated rounded-3xl border border-white/5 shadow-xl hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-all overflow-hidden flex flex-col group">
                  {/* Card Header */}
                  <div className="p-5 border-b border-white/5 bg-black/20 flex justify-between items-start relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-playbox-accent/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div>
                      <h3 className="font-black text-lg text-white mb-1 group-hover:text-playbox-accent transition-colors">{store.brandName || 'Toko Tanpa Nama'}</h3>
                      <p className="font-mono text-[10px] text-white/40 bg-black/40 px-2 py-0.5 rounded uppercase tracking-widest inline-block">ID: {store.id}</p>
                    </div>
                    <div>
                      {store.status === 'suspended' ? (
                        <span className="px-3 py-1 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-black tracking-widest border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]">SUSPEND</span>
                      ) : isExpired ? (
                        <span className="px-3 py-1 rounded-xl bg-orange-500/10 text-orange-400 text-[10px] font-black tracking-widest border border-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.2)]">EXPIRED</span>
                      ) : store.status === 'trial' ? (
                        <span className="px-3 py-1 rounded-xl bg-yellow-500/10 text-yellow-400 text-[10px] font-black tracking-widest border border-yellow-500/20 shadow-[0_0_10px_rgba(250,204,21,0.2)]">TRIAL</span>
                      ) : (
                        <span className="px-3 py-1 rounded-xl bg-green-500/10 text-green-400 text-[10px] font-black tracking-widest border border-green-500/20 shadow-[0_0_10px_rgba(74,222,128,0.2)]">ACTIVE</span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex-1 flex flex-col justify-center space-y-4">
                    <div className="flex items-center space-x-3 bg-black/20 p-3 rounded-2xl border border-white/5">
                      <div className="w-8 h-8 rounded-full bg-playbox-accent/10 flex items-center justify-center text-playbox-accent">
                        📱
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mb-0.5">WhatsApp</p>
                        <p className="text-sm font-medium text-white">{store.phone || '-'}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 bg-black/20 p-3 rounded-2xl border border-white/5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isExpired ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                        ⏳
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mb-0.5">Valid Until</p>
                        {store.validUntil ? (
                          <p className={`text-sm font-bold ${isExpired ? 'text-red-400' : 'text-green-400'}`}>
                            {new Date(store.validUntil).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        ) : (
                          <p className="text-sm font-medium text-white/30">-</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="p-4 border-t border-white/5 bg-black/40 flex flex-wrap gap-2">
                    <button 
                      onClick={() => handleBypassLogin(store.id)}
                      className="flex-1 min-w-[45%] py-2.5 bg-playbox-accent text-white font-bold rounded-xl hover:bg-blue-600 transition-colors text-[11px] uppercase tracking-wider shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                    >
                      Bypass 🔑
                    </button>
                    <button 
                      onClick={() => handleExtend(store.id, store.validUntil)}
                      className="flex-1 min-w-[45%] py-2.5 bg-green-500/10 text-green-400 font-bold rounded-xl border border-green-500/20 hover:bg-green-500 hover:text-white transition-colors text-[11px] uppercase tracking-wider"
                    >
                      +30 Hari
                    </button>
                    
                    {store.status !== 'suspended' && (
                      <button 
                        onClick={() => handleSuspend(store.id)}
                        className="flex-1 min-w-[45%] py-2 bg-orange-500/10 text-orange-400 font-bold rounded-xl border border-orange-500/20 hover:bg-orange-500 hover:text-white transition-colors text-[10px] uppercase tracking-wider mt-1"
                      >
                        Suspend
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(store.id)}
                      className="flex-1 min-w-[45%] py-2 bg-red-500/10 text-red-400 font-bold rounded-xl border border-red-500/20 hover:bg-red-500 hover:text-white transition-colors text-[10px] uppercase tracking-wider mt-1"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}

            {stores.length === 0 && (
              <div className="col-span-full glass-surface-elevated p-12 rounded-3xl text-center border border-white/5">
                <div className="text-4xl mb-4 opacity-50">📭</div>
                <h3 className="text-xl font-bold text-white mb-2">Belum ada Klien</h3>
                <p className="text-white/50 text-sm">Toko yang mendaftar akan muncul di sini.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
