'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function UnitNew() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    type: 'PlayStation 5'
  });

  const [packageItems, setPackageItems] = useState(['']);
  const [priceTiers, setPriceTiers] = useState<any[]>([{ durationVal: 24, durationUnit: 'Jam', price: '' }]);
  const [games, setGames] = useState(['']);

  // Dropdown states
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [openUnitTierDropdown, setOpenUnitTierDropdown] = useState<number | null>(null);

  const handleAddItem = () => setPackageItems([...packageItems, '']);
  const handleItemChange = (idx: number, val: string) => {
    const newItems = [...packageItems];
    newItems[idx] = val;
    setPackageItems(newItems);
  };
  const handleRemoveItem = (idx: number) => {
    setPackageItems(packageItems.filter((_, i) => i !== idx));
  };

  const handleAddGame = () => setGames([...games, '']);
  const handleGameChange = (idx: number, val: string) => {
    const newGames = [...games];
    newGames[idx] = val;
    setGames(newGames);
  };
  const handleRemoveGame = (idx: number) => {
    setGames(games.filter((_, i) => i !== idx));
  };

  const handleAddTier = () => setPriceTiers([...priceTiers, { durationVal: 12, durationUnit: 'Jam', price: '' }]);
  const handleTierChange = (idx: number, field: string, val: any) => {
    const newTiers = [...priceTiers];
    if (field === 'price') {
      newTiers[idx][field] = val.replace(/\D/g, '');
    } else {
      newTiers[idx][field] = val;
    }
    setPriceTiers(newTiers);
  };
  const handleRemoveTier = (idx: number) => {
    setPriceTiers(priceTiers.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const unitId = 'U' + Date.now().toString().slice(-4);
    const newUnit = {
      id: unitId,
      code: formData.code,
      name: formData.name,
      type: formData.type,
      description: formData.description,
      status: 'Ready',
      statusColor: 'bg-playbox-ready/15 text-playbox-ready shadow-[0_0_10px_rgba(35,197,82,0.3)]',
      price: parseInt(priceTiers[0]?.price) || 0,
      priceTiers: priceTiers.map(t => ({ durationVal: parseInt(t.durationVal) || 0, durationUnit: t.durationUnit, price: parseInt(t.price) || 0 })),
      image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=500&q=80',
      specs: packageItems.filter(p => p.trim() !== ''),
      games: games.filter(g => g.trim() !== ''),
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Simpan ke Cloud Firestore (Real-Time across all devices)
      await setDoc(doc(db, 'units', unitId), newUnit);
    } catch (err) {
      console.error('Error saving unit to Firestore:', err);
    }

    // 2. Simpan juga ke LocalStorage sebagai offline cache
    const saved = localStorage.getItem('playbox_mock_units');
    let units = [];
    if (saved) {
      try {
        units = JSON.parse(saved);
      } catch {}
    }
    units.push(newUnit);
    localStorage.setItem('playbox_mock_units', JSON.stringify(units));

    setIsSubmitting(false);
    alert("Unit Baru Berhasil Ditambahkan!");
    router.push('/dashboard/unit');
  };

  return (
    <div className="p-4 space-y-6 pb-28 relative">
      <div className="ambient-glow"></div>
      
      {/* Header */}
      <div className="flex items-center mt-2 mb-6">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl mr-4 hover:bg-white/10 transition-colors">
          ←
        </button>
        <h1 className="text-xl font-bold tracking-tight">Tambah Unit Baru</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Info Dasar */}
        <div className="glass-surface p-6 rounded-3xl space-y-5">
          <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest mb-2">Info Dasar</h2>
          
          <div>
            <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Kode Unit</label>
            <input 
              type="text" 
              value={formData.code}
              onChange={e => setFormData({...formData, code: e.target.value})}
              placeholder="Contoh: #06"
              className="w-full p-4 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent focus:ring-1 focus:ring-playbox-accent transition-all placeholder:text-white/20"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Nama Unit</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="Contoh: PS5 Premium Set"
              className="w-full p-4 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent focus:ring-1 focus:ring-playbox-accent transition-all placeholder:text-white/20"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Jenis Konsol</label>
            <div className="relative">
              <div 
                onClick={() => setIsTypeOpen(!isTypeOpen)}
                className={`w-full p-4 rounded-xl bg-black/20 border text-white text-sm flex justify-between items-center cursor-pointer transition-all ${isTypeOpen ? 'border-playbox-accent shadow-[0_0_10px_rgba(226,23,142,0.2)]' : 'border-white/10 hover:border-white/20'}`}
              >
                <span>{formData.type}</span>
                <span className={`text-[10px] transition-transform duration-300 ${isTypeOpen ? 'rotate-180 text-playbox-accent' : 'opacity-50'}`}>▼</span>
              </div>
              
              {isTypeOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-[#10152B] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
                  {['PlayStation 5', 'PlayStation 4', 'PlayStation 3', 'Nintendo Switch'].map(t => (
                    <div 
                      key={t}
                      onClick={() => { setFormData({...formData, type: t}); setIsTypeOpen(false); }}
                      className={`p-4 text-sm cursor-pointer transition-colors flex items-center justify-between ${formData.type === t ? 'bg-playbox-accent/10 text-playbox-accent font-semibold' : 'text-white/80 hover:bg-white/5'}`}
                    >
                      {t}
                      {formData.type === t && <span className="text-playbox-accent">✓</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Deskripsi</label>
            <textarea 
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="Tambahkan catatan khusus tentang unit ini..."
              rows={3}
              className="w-full p-4 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent focus:ring-1 focus:ring-playbox-accent transition-all placeholder:text-white/20"
            />
          </div>
        </div>

        {/* Harga Sewa */}
        <div className="glass-surface p-6 rounded-3xl space-y-4 relative z-10">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest">Harga Sewa Per Durasi</h2>
            <span className="text-[11px] text-white/40">{priceTiers.length} Paket Aktif</span>
          </div>
          
          <div className="space-y-3">
            {priceTiers.map((tier, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-3 relative group hover:border-white/20 transition-all">
                {/* Baris 1: Durasi, Satuan, dan Tombol Hapus */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="relative">
                      <input 
                        type="number"
                        min="1"
                        value={tier.durationVal}
                        onChange={e => handleTierChange(idx, 'durationVal', parseInt(e.target.value) || '')}
                        placeholder="1"
                        className="w-20 p-3 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent transition-all placeholder:text-white/20 text-center font-bold"
                        required
                      />
                    </div>
                    <div className="relative flex-1">
                      <button
                        type="button"
                        onClick={() => setOpenUnitTierDropdown(openUnitTierDropdown === idx ? null : idx)}
                        className={`w-full p-3 rounded-xl bg-black/40 border text-white text-sm flex items-center justify-between transition-all font-bold ${
                          openUnitTierDropdown === idx ? 'border-playbox-accent shadow-[0_0_12px_rgba(226,23,142,0.35)] ring-1 ring-playbox-accent' : 'border-white/10 hover:border-white/20'
                        }`}
                      >
                        <span className="truncate">{tier.durationUnit || 'Jam'}</span>
                        <span className={`text-[9px] text-playbox-accent transition-transform duration-300 ${openUnitTierDropdown === idx ? 'rotate-180' : 'opacity-60'}`}>▼</span>
                      </button>

                      {openUnitTierDropdown === idx && (
                        <div className="absolute top-full left-0 w-full mt-2 bg-[#0D1122]/95 border border-white/15 rounded-2xl overflow-hidden shadow-2xl z-50 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 divide-y divide-white/5">
                          {[
                            { label: 'Jam', icon: '⏱️' },
                            { label: 'Hari', icon: '📅' },
                            { label: 'Minggu', icon: '📆' },
                            { label: 'Bulan', icon: '🌙' }
                          ].map((u) => {
                            const isSelected = (tier.durationUnit || 'Jam') === u.label;
                            return (
                              <div
                                key={u.label}
                                onClick={() => {
                                  handleTierChange(idx, 'durationUnit', u.label);
                                  setOpenUnitTierDropdown(null);
                                }}
                                className={`p-3 text-xs cursor-pointer transition-colors flex items-center justify-between ${
                                  isSelected ? 'bg-playbox-accent/15 text-playbox-accent font-bold' : 'text-white/80 hover:bg-white/10'
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  <span>{u.icon}</span>
                                  <span>{u.label}</span>
                                </span>
                                {isSelected && <span className="text-[10px] text-playbox-accent font-black">✓</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {priceTiers.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => handleRemoveTier(idx)} 
                      className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-colors text-lg flex-shrink-0 font-bold"
                      title="Hapus Paket"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Baris 2: Input Nominal Harga Full Width */}
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-playbox-text-secondary text-sm font-semibold">Rp</span>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={tier.price ? Number(tier.price).toLocaleString('id-ID') : ''}
                    onChange={e => handleTierChange(idx, 'price', e.target.value)}
                    placeholder="Contoh: 150.000"
                    className="w-full p-3.5 pl-12 rounded-xl bg-black/40 border border-white/10 text-white text-base focus:outline-none focus:border-playbox-accent transition-all placeholder:text-white/20 font-black tracking-wide"
                    required
                  />
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={handleAddTier} className="w-full py-3.5 rounded-xl text-xs font-bold text-playbox-accent bg-playbox-accent/10 border border-playbox-accent/20 hover:bg-playbox-accent/20 transition-all flex items-center justify-center gap-2">
            <span>+</span> Tambah Paket Durasi Baru
          </button>
        </div>

        {/* Isi Paket */}
        <div className="glass-surface p-6 rounded-3xl space-y-4">
          <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest mb-2">Isi Paket (Kelengkapan)</h2>
          
          {packageItems.map((item, idx) => (
            <div key={idx} className="flex space-x-2">
              <input 
                type="text" 
                value={item}
                onChange={e => handleItemChange(idx, e.target.value)}
                placeholder="Contoh: 2 Stik DualSense"
                className="flex-1 p-4 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent transition-all placeholder:text-white/20"
                required
              />
              {packageItems.length > 1 && (
                <button type="button" onClick={() => handleRemoveItem(idx)} className="text-red-400 p-3 hover:bg-white/5 rounded-xl transition-colors">×</button>
              )}
            </div>
          ))}
          <button type="button" onClick={handleAddItem} className="text-xs font-bold text-playbox-accent bg-playbox-accent/10 px-4 py-2 rounded-lg hover:bg-playbox-accent/20 transition-colors mt-2">
            + Tambah Item
          </button>
        </div>

        {/* Game Terinstal */}
        <div className="glass-surface p-6 rounded-3xl space-y-4">
          <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest mb-2">Game Terinstal</h2>
          
          {games.map((game, idx) => (
            <div key={idx} className="flex space-x-2">
              <input 
                type="text" 
                value={game}
                onChange={e => handleGameChange(idx, e.target.value)}
                placeholder="Contoh: EA FC 24"
                className="flex-1 p-4 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent transition-all placeholder:text-white/20"
              />
              {games.length > 1 && (
                <button type="button" onClick={() => handleRemoveGame(idx)} className="text-red-400 p-3 hover:bg-white/5 rounded-xl transition-colors">×</button>
              )}
            </div>
          ))}
          <button type="button" onClick={handleAddGame} className="text-xs font-bold text-playbox-accent bg-playbox-accent/10 px-4 py-2 rounded-lg hover:bg-playbox-accent/20 transition-colors mt-2">
            + Tambah Game
          </button>
        </div>

        {/* Floating Action Buttons */}
        <div className="fixed bottom-[72px] w-full max-w-md left-1/2 -translate-x-1/2 p-4 bg-playbox-bg/80 backdrop-blur-xl border-t border-white/5 z-50">
          <div className="max-w-md mx-auto">
            <button 
              type="submit" 
              className="w-full py-4 saas-button rounded-2xl font-semibold shadow-[0_4px_20px_rgba(226,23,142,0.4)] text-sm tracking-wide"
            >
              Simpan Unit Baru
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
