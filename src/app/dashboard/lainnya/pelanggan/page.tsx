'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

export default function PelangganPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Pastikan user adalah owner
    const authData = localStorage.getItem('playbox_auth');
    if (!authData) {
      router.push('/login');
      return;
    }
    const parsed = JSON.parse(authData);
    if (parsed.role !== 'owner') {
      router.push('/dashboard/lainnya');
      return;
    }

    loadCustomers();
  }, [router]);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, 'customers'));
      const data: any[] = [];
      snap.forEach(d => {
        data.push({ id: d.id, ...d.data() });
      });
      // Sort by totalSpent descending
      data.sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
      setCustomers(data);
    } catch (e) {
      console.error("Error loading customers:", e);
    }
    setIsLoading(false);
  };

  const handleSyncData = async () => {
    const confirmSync = confirm("Sinkronisasi akan mengecek semua riwayat pesanan (termasuk yang lama) dan mendaftarkannya ke Database Pelanggan. Lanjutkan?");
    if (!confirmSync) return;
    
    setIsLoading(true);
    try {
      const savedBookings = localStorage.getItem('playbox_mock_bookings');
      if (savedBookings) {
        const bookings = JSON.parse(savedBookings);
        const customerMap = new Map();
        
        for (const b of bookings) {
          if (!b.customerPhone) continue;
          const phone = b.customerPhone.replace(/\D/g, '');
          if (phone.length < 10) continue;
          
          if (!customerMap.has(phone)) {
            customerMap.set(phone, {
              name: b.customer,
              phone: phone,
              totalBookings: 1,
              totalSpent: Number(b.totalPrice || 0)
            });
          } else {
            const existing = customerMap.get(phone);
            existing.totalBookings += 1;
            existing.totalSpent += Number(b.totalPrice || 0);
          }
        }
        
        for (const [phone, data] of customerMap.entries()) {
          const docRef = doc(db, 'customers', phone);
          const snap = await getDoc(docRef);
          if (!snap.exists()) {
             await setDoc(docRef, {
               ...data,
               isBlacklisted: false,
               blacklistReason: ''
             });
          }
        }
        
        alert("Sinkronisasi berhasil! Data pelanggan lama telah dimasukkan.");
        await loadCustomers();
      }
    } catch (e) {
      console.error(e);
      alert("Gagal melakukan sinkronisasi data.");
    }
    setIsLoading(false);
  };

  const handleToggleBlacklist = (c: any) => {
    setSelectedCustomer(c);
    setBlacklistReason(c.blacklistReason || '');
    setIsModalOpen(true);
  };

  const submitBlacklist = async () => {
    if (!selectedCustomer) return;
    setIsSubmitting(true);
    try {
      const newStatus = !selectedCustomer.isBlacklisted;
      const ref = doc(db, 'customers', selectedCustomer.id);
      await updateDoc(ref, {
        isBlacklisted: newStatus,
        blacklistReason: newStatus ? blacklistReason : ''
      });
      
      setCustomers(prev => prev.map(c => 
        c.id === selectedCustomer.id 
          ? { ...c, isBlacklisted: newStatus, blacklistReason: newStatus ? blacklistReason : '' } 
          : c
      ));
      
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      alert("Gagal mengupdate status pelanggan.");
    }
    setIsSubmitting(false);
  };

  const filteredCustomers = customers.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) || 
    c.phone?.includes(search)
  );

  return (
    <div className="p-4 pb-28 min-h-screen flex flex-col relative">
      <div className="ambient-glow"></div>

      <div className="flex items-center justify-between mt-2 mb-6 relative z-10">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl mr-4 hover:bg-white/10 transition-colors">
            ←
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Database Pelanggan</h1>
            <p className="text-xs text-playbox-text-secondary">CRM & Manajemen Blacklist</p>
          </div>
        </div>
        
        {customers.length > 0 && (
          <button 
            onClick={handleSyncData}
            disabled={isLoading}
            className="p-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors border border-white/5 flex items-center justify-center disabled:opacity-50"
            title="Sinkronkan data lama"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>

      <div className="mb-4 relative z-10">
        <input 
          type="text" 
          placeholder="Cari nama atau nomor WA..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-playbox-surface border border-[#2A3455] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-playbox-accent transition-colors"
        />
      </div>

      <div className="flex-1 overflow-y-auto z-10 space-y-4">
        {isLoading ? (
          <div className="text-center py-10 text-playbox-text-secondary">Memuat data pelanggan...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-10 text-playbox-text-secondary bg-playbox-surface rounded-2xl border border-white/5 p-4">
            <p className="mb-4">Belum ada data pelanggan yang tersimpan. Data akan bertambah otomatis saat pesanan baru dibuat.</p>
            <button 
              onClick={handleSyncData}
              className="px-4 py-2 bg-playbox-accent hover:bg-playbox-accent-hover text-white rounded-xl font-bold text-xs transition-colors"
            >
              Sinkronkan Data Lama
            </button>
          </div>
        ) : (
          filteredCustomers.map(c => (
            <div key={c.id} className={`bg-playbox-surface border ${c.isBlacklisted ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-[#2A3455]'} rounded-xl p-4 transition-all duration-300`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-lg text-white flex items-center">
                    {c.name}
                    {c.isBlacklisted && <span className="ml-2 text-xs bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full border border-red-500/30">BLACKLIST</span>}
                  </h3>
                  <p className="text-sm text-playbox-text-secondary">{c.phone || c.id}</p>
                </div>
                <button 
                  onClick={() => handleToggleBlacklist(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${c.isBlacklisted ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20'}`}
                >
                  {c.isBlacklisted ? 'Pulihkan' : 'Blacklist'}
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/5">
                <div>
                  <p className="text-[10px] text-playbox-text-secondary uppercase tracking-wider mb-1">Total Sewa</p>
                  <p className="font-bold text-white">{c.totalBookings || 0}x Transaksi</p>
                </div>
                <div>
                  <p className="text-[10px] text-playbox-text-secondary uppercase tracking-wider mb-1">Total Belanja</p>
                  <p className="font-bold text-playbox-accent">Rp {(c.totalSpent || 0).toLocaleString('id-ID')}</p>
                </div>
              </div>
              
              {c.isBlacklisted && c.blacklistReason && (
                <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-xs text-red-400"><span className="font-bold">Alasan:</span> {c.blacklistReason}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Blacklist */}
      {isModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !isSubmitting && setIsModalOpen(false)}></div>
          <div className="bg-[#0E1221] border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-300">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4 border border-red-500/30">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {selectedCustomer.isBlacklisted ? 'Pulihkan Pelanggan?' : 'Blacklist Pelanggan?'}
              </h3>
              <p className="text-sm text-playbox-text-secondary mb-4">
                {selectedCustomer.isBlacklisted 
                  ? `Anda akan menghapus ${selectedCustomer.name} dari daftar Blacklist. Mereka akan dapat menyewa kembali.` 
                  : `Peringatan akan muncul jika ${selectedCustomer.name} mencoba menyewa lagi. Masukkan alasan blacklist:`}
              </p>
              
              {!selectedCustomer.isBlacklisted && (
                <textarea
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-red-500 transition-colors mb-4"
                  rows={3}
                  placeholder="Contoh: Suka telat saat pengembalian, stik rusak..."
                  value={blacklistReason}
                  onChange={e => setBlacklistReason(e.target.value)}
                />
              )}

              <div className="flex space-x-3 mt-2">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button 
                  onClick={submitBlacklist}
                  disabled={isSubmitting || (!selectedCustomer.isBlacklisted && !blacklistReason.trim())}
                  className={`flex-1 py-3 ${selectedCustomer.isBlacklisted ? 'bg-playbox-accent hover:bg-playbox-accent-hover' : 'bg-red-500 hover:bg-red-600'} text-white rounded-xl font-bold shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all disabled:opacity-50`}
                >
                  {isSubmitting ? 'Menyimpan...' : (selectedCustomer.isBlacklisted ? 'Pulihkan' : 'Blacklist')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
