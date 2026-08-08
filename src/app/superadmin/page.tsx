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
    <div className="min-h-screen bg-playbox-bg text-playbox-text-primary p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-playbox-surface p-6 rounded-2xl border border-white/5 shadow-lg">
          <div>
            <h1 className="text-2xl font-black text-white tracking-wide">RENTERVA HQ</h1>
            <p className="text-playbox-text-secondary text-sm mt-1">Super Admin Dashboard</p>
          </div>
          <button 
            onClick={() => {
              localStorage.removeItem('playbox_auth');
              router.push('/login');
            }}
            className="px-6 py-2 bg-red-500/10 text-red-400 font-bold rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-playbox-surface p-6 rounded-2xl border border-white/5 shadow-lg">
            <p className="text-playbox-text-secondary text-sm font-bold mb-2">Total Klien Terdaftar</p>
            <p className="text-4xl font-black text-white">{stores.length}</p>
          </div>
          <div className="bg-playbox-surface p-6 rounded-2xl border border-white/5 shadow-lg">
            <p className="text-playbox-text-secondary text-sm font-bold mb-2">Klien Aktif</p>
            <p className="text-4xl font-black text-playbox-accent">
              {stores.filter(s => s.status === 'active').length}
            </p>
          </div>
          <div className="bg-playbox-surface p-6 rounded-2xl border border-white/5 shadow-lg">
            <p className="text-playbox-text-secondary text-sm font-bold mb-2">Klien Trial</p>
            <p className="text-4xl font-black text-yellow-400">
              {stores.filter(s => s.status === 'trial').length}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-playbox-surface rounded-2xl border border-white/5 shadow-lg overflow-hidden">
          <div className="p-6 border-b border-white/5">
            <h2 className="text-xl font-bold text-white">Daftar Toko (Tenants)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/20 text-playbox-text-secondary text-xs uppercase tracking-wider">
                  <th className="p-4 font-bold">ID Toko</th>
                  <th className="p-4 font-bold">Brand Name</th>
                  <th className="p-4 font-bold">Status</th>
                  <th className="p-4 font-bold">Valid Until</th>
                  <th className="p-4 font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stores.map((store) => {
                  const isExpired = store.validUntil && new Date(store.validUntil) < new Date();
                  
                  return (
                    <tr key={store.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <span className="font-mono text-white bg-black/50 px-2 py-1 rounded text-sm">
                          {store.id}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-white">{store.brandName || '-'}</p>
                        <p className="text-xs text-playbox-text-secondary">{store.phone || '-'}</p>
                      </td>
                      <td className="p-4">
                        {store.status === 'suspended' ? (
                          <span className="px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20">SUSPENDED</span>
                        ) : isExpired ? (
                          <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 text-xs font-bold border border-orange-500/20">EXPIRED</span>
                        ) : store.status === 'trial' ? (
                          <span className="px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-bold border border-yellow-500/20">TRIAL</span>
                        ) : (
                          <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-bold border border-green-500/20">ACTIVE</span>
                        )}
                      </td>
                      <td className="p-4">
                        {store.validUntil ? (
                          <p className={`text-sm font-medium ${isExpired ? 'text-red-400' : 'text-white'}`}>
                            {new Date(store.validUntil).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        ) : '-'}
                      </td>
                      <td className="p-4">
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => handleBypassLogin(store.id)}
                            className="px-3 py-1.5 bg-playbox-accent/10 text-playbox-accent font-bold rounded-lg hover:bg-playbox-accent hover:text-white transition-colors text-xs"
                          >
                            Bypass Login
                          </button>
                          <button 
                            onClick={() => handleExtend(store.id, store.validUntil)}
                            className="px-3 py-1.5 bg-green-500/10 text-green-400 font-bold rounded-lg hover:bg-green-500 hover:text-white transition-colors text-xs"
                          >
                            +30 Hari
                          </button>
                          {store.status !== 'suspended' && (
                            <button 
                              onClick={() => handleSuspend(store.id)}
                              className="px-3 py-1.5 bg-orange-500/10 text-orange-400 font-bold rounded-lg hover:bg-orange-500 hover:text-white transition-colors text-xs"
                            >
                              Suspend
                            </button>
                          )}
                          <button 
                            onClick={() => handleDelete(store.id)}
                            className="px-3 py-1.5 bg-red-500/10 text-red-400 font-bold rounded-lg hover:bg-red-500 hover:text-white transition-colors text-xs"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {stores.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-playbox-text-secondary">
                      Belum ada toko yang terdaftar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
