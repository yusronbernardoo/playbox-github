'use client';
import { getStoreId, getTenantStorageKey } from '@/lib/tenant';
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
      const snap = await getDocs(collection(db, 'stores', getStoreId(), 'customers'));
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
      const savedBookings = localStorage.getItem(getTenantStorageKey('playbox_mock_bookings'));
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
          const docRef = doc(db, 'stores', getStoreId(), 'customers', phone);
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
      const ref = doc(db, 'stores', getStoreId(), 'customers', selectedCustomer.id);
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
      console.error("Gagal update blacklist:", e);
      alert("Terjadi kesalahan saat memperbarui status blacklist.");
    }
    setIsSubmitting(false);
  };

  const filteredCustomers = customers.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) || 
    c.phone?.includes(search)
  );

  return (
    <div className="p-4 space-y-6 pb-28 max-w-md mx-auto min-h-screen relative">
      {/* Header */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center space-x-3">
          <Link href="/dashboard/lainnya" className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-xl font-bold text-white">Database Pelanggan</h1>
        </div>
        <button 
          onClick={handleSyncData}
          disabled={isLoading}
          className="text-xs bg-playbox-accent/10 hover:bg-playbox-accent/20 text-playbox-accent border border-playbox-accent/20 px-3 py-1.5 rounded-lg flex items-center space-x-1 font-medium transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          <span>Sync Data</span>
        </button>
      </div>

      {/* Summary Widget */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-playbox-surface p-4 rounded-2xl border border-white/5 relative overflow-hidden">
          <p className="text-xs text-playbox-text-secondary font-medium">Total Pelanggan</p>
          <p className="text-2xl font-bold text-white mt-1">{customers.length}</p>
        </div>
        <div className="bg-playbox-surface p-4 rounded-2xl border border-white/5 relative overflow-hidden">
          <p className="text-xs text-playbox-text-secondary font-medium">Pelanggan Diblacklist</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{customers.filter(c => c.isBlacklisted).length}</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Cari nama atau nomor WhatsApp..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-playbox-surface border border-white/10 rounded-xl px-4 py-3 pl-10 text-sm text-white placeholder-white/40 focus:outline-none focus:border-playbox-accent transition-colors"
        />
        <svg className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      </div>

      {/* Customer List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-playbox-accent border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-playbox-text-secondary">Memuat database...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12 bg-playbox-surface rounded-2xl border border-white/5">
            <p className="text-sm text-playbox-text-secondary">Tidak ada pelanggan ditemukan.</p>
          </div>
        ) : (
          filteredCustomers.map(c => (
            <div 
              key={c.id} 
              className={`p-4 rounded-2xl border transition-all ${
                c.isBlacklisted 
                  ? 'bg-red-500/5 border-red-500/20' 
                  : 'bg-playbox-surface border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-white text-base">{c.name || 'Tanpa Nama'}</h3>
                    {c.isBlacklisted && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                        BLACKLIST
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-playbox-text-secondary mt-0.5">{c.phone}</p>
                </div>
                <button
                  onClick={() => handleToggleBlacklist(c)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                    c.isBlacklisted
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                  }`}
                >
                  {c.isBlacklisted ? 'Pulihkan' : 'Blacklist'}
                </button>
              </div>

              <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-playbox-text-secondary block">Total Sewa</span>
                  <p className="font-semibold text-white mt-0.5">{c.totalBookings || 1} Kali</p>
                </div>
                <div>
                  <span className="text-playbox-text-secondary block">Total Belanja</span>
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
