'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface PaymentMethod {
  id: string;
  type: 'Bank Transfer' | 'E-Wallet' | 'QRIS';
  name: string; // e.g. BCA, Mandiri, GoPay
  account: string; // Account Number or Phone
  owner: string;
  active: boolean;
  qrisImage?: string; // Base64 if QRIS
}

export default function PaymentMethods() {
  const router = useRouter();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form State
  const [type, setType] = useState<'Bank Transfer' | 'E-Wallet' | 'QRIS'>('Bank Transfer');
  const [name, setName] = useState('');
  const [account, setAccount] = useState('');
  const [owner, setOwner] = useState('');
  const [active, setActive] = useState(true);
  const [qrisImage, setQrisImage] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('playbox_payments');
    if (saved) {
      setMethods(JSON.parse(saved));
    } else {
      // Default initial payments
      const initial: PaymentMethod[] = [
        { id: 'P01', type: 'Bank Transfer', name: 'BCA', account: '1234567890', owner: 'Budi Santoso', active: true },
        { id: 'P02', type: 'E-Wallet', name: 'GoPay', account: '081234567890', owner: 'Budi Santoso', active: true },
      ];
      setMethods(initial);
      localStorage.setItem('playbox_payments', JSON.stringify(initial));
    }
  }, []);

  const openAddModal = () => {
    setEditId(null);
    setType('Bank Transfer');
    setName('');
    setAccount('');
    setOwner('');
    setActive(true);
    setQrisImage('');
    setShowModal(true);
  };

  const openEditModal = (method: PaymentMethod) => {
    setEditId(method.id);
    setType(method.type);
    setName(method.name);
    setAccount(method.account);
    setOwner(method.owner);
    setActive(method.active);
    setQrisImage(method.qrisImage || '');
    setShowModal(true);
  };

  const handleQrisUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setQrisImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveMethod = () => {
    if (!name || (!account && type !== 'QRIS') || (!qrisImage && type === 'QRIS') || !owner) {
      return alert('Mohon lengkapi semua data pembayaran!');
    }

    let updated = [...methods];
    if (editId) {
      updated = updated.map(m => m.id === editId ? { id: editId, type, name, account, owner, active, qrisImage } : m);
    } else {
      updated.push({
        id: 'P' + Math.floor(Math.random() * 10000),
        type, name, account, owner, active, qrisImage
      });
    }

    setMethods(updated);
    try {
      localStorage.setItem('playbox_payments', JSON.stringify(updated));
      setShowModal(false);
    } catch (e) {
      alert('Gagal menyimpan! Gambar QRIS mungkin terlalu besar. Gunakan gambar dengan ukuran lebih kecil (di bawah 1MB).');
      console.error(e);
    }
  };

  const deleteMethod = (id: string) => {
    if (confirm('Yakin ingin menghapus metode pembayaran ini?')) {
      const updated = methods.filter(m => m.id !== id);
      setMethods(updated);
      localStorage.setItem('playbox_payments', JSON.stringify(updated));
      setShowModal(false);
    }
  };

  return (
    <div className="p-4 space-y-6 pb-28 relative h-full">
      <div className="ambient-glow"></div>

      {/* Header */}
      <div className="flex items-center justify-between mt-2 mb-6 relative z-10">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl mr-4 hover:bg-white/10 transition-colors">
            ←
          </button>
          <h1 className="text-xl font-bold tracking-tight">Metode Pembayaran</h1>
        </div>
      </div>

      {/* List */}
      <div className="space-y-4 relative z-10">
        {methods.length === 0 ? (
          <div className="p-8 text-center text-white/50 text-sm glass-surface rounded-2xl">
            Belum ada metode pembayaran.<br/>Silakan tambahkan Rekening atau QRIS.
          </div>
        ) : (
          methods.map((method) => (
            <div key={method.id} className="glass-surface p-5 rounded-2xl group hover:bg-white/5 transition-colors relative overflow-hidden">
              {!method.active && <div className="absolute inset-0 bg-black/40 z-10"></div>}
              <div className="relative z-20">
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${method.type === 'QRIS' ? 'bg-[#25D366]/20 text-[#25D366]' : 'bg-white/10 text-white/70'}`}>
                    {method.type}
                  </span>
                  <button onClick={() => openEditModal(method)} className="text-xs text-playbox-accent hover:underline px-2 py-1 bg-white/10 rounded">Edit</button>
                </div>
                
                <h3 className="font-bold text-lg text-white/90">{method.name}</h3>
                {method.type === 'QRIS' ? (
                  <p className="text-sm font-mono text-white/70 mt-1 mb-1">QRIS Aktif</p>
                ) : (
                  <p className="text-xl font-mono text-white tracking-widest my-1">{method.account}</p>
                )}
                <p className="text-sm text-playbox-text-secondary">a.n. {method.owner}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-[72px] w-full max-w-md left-1/2 -translate-x-1/2 p-4 bg-playbox-bg/80 backdrop-blur-xl border-t border-white/5 z-40">
        <button 
          onClick={openAddModal}
          type="button" 
          className="w-full py-4 bg-white/10 text-white rounded-2xl font-semibold shadow-inner border border-white/10 hover:bg-white/20 transition-all text-sm tracking-wide"
        >
          + Tambah Rekening / E-Wallet / QRIS
        </button>
      </div>

      {/* Modal Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 max-w-md mx-auto flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#0A0F1F] w-full max-h-[90vh] overflow-y-auto sm:rounded-3xl rounded-t-3xl border border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 duration-300 relative">
            <div className="p-6 border-b border-white/5 sticky top-0 bg-[#0A0F1F]/90 backdrop-blur-md z-10 flex justify-between items-center">
              <h2 className="text-xl font-bold">{editId ? 'Edit Metode' : 'Tambah Metode'}</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10">✕</button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/60 uppercase mb-2">Jenis Pembayaran</label>
                <div className="flex gap-2">
                  {['Bank Transfer', 'E-Wallet', 'QRIS'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t as any)}
                      className={`flex-1 py-3 text-xs font-bold rounded-xl border transition-all ${type === t ? 'bg-playbox-accent/20 border-playbox-accent text-playbox-accent' : 'bg-black/40 border-white/5 text-white/60'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/60 uppercase mb-2">
                  {type === 'Bank Transfer' ? 'Nama Bank (contoh: BCA)' : type === 'E-Wallet' ? 'Nama E-Wallet (contoh: GoPay)' : 'Nama QRIS (contoh: QRIS Kedai)'}
                </label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Contoh: BCA / Mandiri / GoPay" className="w-full p-4 rounded-xl bg-black/40 border border-white/5 text-white focus:outline-none focus:border-playbox-accent" />
              </div>
              
              {type !== 'QRIS' && (
                <div>
                  <label className="block text-xs font-bold text-white/60 uppercase mb-2">Nomor Rekening / No HP</label>
                  <input type="text" inputMode="numeric" value={account} onChange={e => setAccount(e.target.value)} className="w-full p-4 rounded-xl bg-black/40 border border-white/5 text-white focus:outline-none focus:border-playbox-accent" />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-white/60 uppercase mb-2">Nama Pemilik (Atas Nama)</label>
                <input type="text" value={owner} onChange={e => setOwner(e.target.value)} placeholder="Contoh: Budi Santoso" className="w-full p-4 rounded-xl bg-black/40 border border-white/5 text-white focus:outline-none focus:border-playbox-accent" />
              </div>

              {type === 'QRIS' && (
                <div>
                  <label className="block text-xs font-bold text-white/60 uppercase mb-2">Upload Gambar QRIS</label>
                  <div className="w-full aspect-square bg-black/40 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group">
                    {qrisImage ? (
                      <img src={qrisImage} alt="QRIS" className="w-full h-full object-contain p-2" />
                    ) : (
                      <div className="text-center p-4">
                        <span className="text-4xl mb-2 block">📷</span>
                        <p className="text-xs text-white/50">Klik untuk upload gambar QRIS</p>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={handleQrisUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 mt-4">
                <div>
                  <h3 className="font-bold">Status Aktif</h3>
                  <p className="text-xs text-white/50">Tampilkan ke pelanggan</p>
                </div>
                <button 
                  onClick={() => setActive(!active)}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${active ? 'bg-playbox-ready' : 'bg-white/20'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute transition-transform ${active ? 'translate-x-7' : 'translate-x-1'}`}></div>
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-white/5 bg-black/20 flex gap-3">
              {editId && (
                <button onClick={() => deleteMethod(editId)} className="p-4 rounded-xl font-bold bg-red-500/20 text-red-500 hover:bg-red-500/30 w-16 flex justify-center items-center">
                  🗑
                </button>
              )}
              <button onClick={saveMethod} className="flex-1 py-4 bg-playbox-accent text-white rounded-xl font-bold shadow-[0_0_20px_rgba(226,23,142,0.4)] hover:bg-[#ff1e9f] transition-all">
                Simpan Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
