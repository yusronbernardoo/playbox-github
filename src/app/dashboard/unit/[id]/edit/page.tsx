'use client';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function EditUnit() {
  const { id } = useParams();
  const router = useRouter();

  const [unit, setUnit] = useState<any>({
    id: id,
    name: 'PS5 Premium Set (#01)',
    type: 'PlayStation 5',
    status: 'Ready',
    price: 150000,
    priceTiers: [{ durationVal: 24, durationUnit: 'Jam', price: 150000 }],
    image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=500&q=80',
    specs: ['2 Stik', 'FIFA 24', 'GTA V'],
    games: []
  });

  const [previewImage, setPreviewImage] = useState(unit.image);

  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [openUnitTierDropdown, setOpenUnitTierDropdown] = useState<number | null>(null);

  const handleAddTier = () => setUnit({...unit, priceTiers: [...unit.priceTiers, { durationVal: 12, durationUnit: 'Jam', price: '' }]});
  
  const handleTierChange = (idx: number, field: string, val: any) => {
    const newTiers = [...unit.priceTiers];
    if (field === 'price') {
      newTiers[idx][field] = val.toString().replace(/\D/g, '');
    } else {
      newTiers[idx][field] = val;
    }
    setUnit({...unit, priceTiers: newTiers});
  };

  const handleRemoveTier = (idx: number) => {
    setUnit({...unit, priceTiers: unit.priceTiers.filter((_: any, i: number) => i !== idx)});
  };

  useEffect(() => {
    const loadUnit = async () => {
      if (!id || typeof id !== 'string') return;
      let found: any = null;

      try {
        const snap = await getDoc(doc(db, 'units', id));
        if (snap.exists()) {
          found = { ...snap.data(), id: snap.id };
        }
      } catch (err) {
        console.warn('Firestore get unit err:', err);
      }

      if (!found) {
        const saved = localStorage.getItem('playbox_mock_units');
        if (saved) {
          try {
            const units = JSON.parse(saved);
            found = units.find((u: any) => u.id === id);
          } catch {}
        }
      }

      if (found) {
        setUnit({
          ...found,
          priceTiers: found.priceTiers || [{ durationVal: 24, durationUnit: 'Jam', price: found.price || 0 }],
          specs: found.specs || [],
          games: found.games || []
        });
        setPreviewImage(found.image);
      }
    };

    loadUnit();
  }, [id]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const imageUrl = URL.createObjectURL(file);
      setPreviewImage(imageUrl);
      setUnit({ ...unit, image: imageUrl });
    }
  };

  const handleSpecChange = (idx: number, val: string) => {
    const newSpecs = [...unit.specs];
    newSpecs[idx] = val;
    setUnit({ ...unit, specs: newSpecs });
  };

  const handleAddSpec = () => {
    setUnit({ ...unit, specs: [...unit.specs, ''] });
  };

  const handleRemoveSpec = (idx: number) => {
    setUnit({ ...unit, specs: unit.specs.filter((_: any, i: number) => i !== idx) });
  };

  const handleGameChange = (idx: number, val: string) => {
    const newGames = [...unit.games];
    newGames[idx] = val;
    setUnit({ ...unit, games: newGames });
  };

  const handleAddGame = () => {
    setUnit({ ...unit, games: [...unit.games, ''] });
  };

  const handleRemoveGame = (idx: number) => {
    setUnit({ ...unit, games: unit.games.filter((_: any, i: number) => i !== idx) });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clean up empty specs before saving
    const cleanedUnit = {
      ...unit,
      price: parseInt(unit.priceTiers[0]?.price) || unit.price || 0,
      priceTiers: unit.priceTiers.map((t: any) => ({ 
        durationVal: parseInt(t.durationVal) || 0, 
        durationUnit: t.durationUnit, 
        price: parseInt(t.price) || 0 
      })),
      specs: unit.specs.filter((s: string) => s.trim() !== ''),
      games: unit.games.filter((g: string) => g.trim() !== ''),
      updatedAt: new Date().toISOString()
    };

    // 1. Sync to Cloud Firestore
    try {
      if (id && typeof id === 'string') {
        await setDoc(doc(db, 'units', id), cleanedUnit, { merge: true });
      }
    } catch (err) {
      console.error('Error updating unit in Firestore:', err);
    }

    // 2. Sync to LocalStorage
    const saved = localStorage.getItem('playbox_mock_units');
    if (saved) {
      try {
        const units = JSON.parse(saved);
        const updated = units.map((u: any) => u.id === id ? cleanedUnit : u);
        localStorage.setItem('playbox_mock_units', JSON.stringify(updated));
      } catch {}
    }
    
    alert("Perubahan berhasil disimpan!");
    router.push(`/dashboard/unit/${id}`);
  };

  return (
    <div className="p-4 space-y-6 pb-28 relative">
      <div className="ambient-glow"></div>

      {/* Header */}
      <div className="flex items-center mt-2 mb-6">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl mr-4 hover:bg-white/10 transition-colors">
          ←
        </button>
        <h1 className="text-xl font-bold tracking-tight">Edit Unit</h1>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Foto Unit */}
        <div className="glass-surface p-6 rounded-3xl">
          <label className="block text-xs font-bold text-white/80 uppercase tracking-widest mb-3">Foto Unit</label>
          <div className="relative w-full h-48 bg-black/40 rounded-2xl border-2 border-dashed border-white/20 overflow-hidden group hover:border-playbox-accent transition-colors">
            {previewImage ? (
              <img 
                src={previewImage} 
                alt="Preview" 
                className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" 
                onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=500&q=80' }}
              />
            ) : (
              <div className="w-full h-full bg-black/40 flex items-center justify-center opacity-60">
                 <span className="text-white/20 font-medium text-xs">No Image Available</span>
              </div>
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
              <span className="text-3xl mb-2 group-hover:scale-110 transition-transform shadow-[0_0_10px_rgba(0,0,0,0.5)] bg-black/20 rounded-full w-12 h-12 flex items-center justify-center">📷</span>
              <span className="text-xs font-medium bg-black/50 px-3 py-1 rounded-full text-white/90 backdrop-blur-sm">Ketuk untuk ubah foto</span>
            </div>
            <input 
              type="file" 
              accept="image/*" 
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
              onChange={handleImageChange}
            />
          </div>
        </div>

        {/* Informasi Utama */}
        <div className="glass-surface p-6 rounded-3xl space-y-5 relative z-20">
          <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest mb-2">Informasi Utama</h2>
          
          <div>
            <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Nama Unit</label>
            <input 
              type="text" 
              value={unit.name} 
              onChange={(e) => setUnit({...unit, name: e.target.value})}
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
                <span>{unit.type}</span>
                <span className={`text-[10px] transition-transform duration-300 ${isTypeOpen ? 'rotate-180 text-playbox-accent' : 'opacity-50'}`}>▼</span>
              </div>
              
              {isTypeOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-[#10152B] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
                  {['PlayStation 5', 'PlayStation 4', 'PlayStation 3', 'Nintendo Switch'].map(t => (
                    <div 
                      key={t}
                      onClick={() => { setUnit({...unit, type: t}); setIsTypeOpen(false); }}
                      className={`p-4 text-sm cursor-pointer transition-colors flex items-center justify-between ${unit.type === t ? 'bg-playbox-accent/10 text-playbox-accent font-semibold' : 'text-white/80 hover:bg-white/5'}`}
                    >
                      {t}
                      {unit.type === t && <span className="text-playbox-accent">✓</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Status</label>
            <div className="relative">
              <div 
                onClick={() => setIsStatusOpen(!isStatusOpen)}
                className={`w-full p-4 rounded-xl bg-black/20 border text-white text-sm flex justify-between items-center cursor-pointer transition-all ${isStatusOpen ? 'border-playbox-accent shadow-[0_0_10px_rgba(226,23,142,0.2)]' : 'border-white/10 hover:border-white/20'}`}
              >
                <div className="flex items-center">
                  <span className={`w-2 h-2 rounded-full mr-2 ${unit.status === 'Ready' ? 'bg-playbox-ready' : unit.status === 'Disewa' ? 'bg-playbox-disewa' : 'bg-gray-400'}`}></span>
                  <span>{unit.status === 'Disewa' ? 'Sedang Disewa' : unit.status}</span>
                </div>
                <span className={`text-[10px] transition-transform duration-300 ${isStatusOpen ? 'rotate-180 text-playbox-accent' : 'opacity-50'}`}>▼</span>
              </div>
              
              {isStatusOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-[#10152B] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
                  {['Ready', 'Disewa', 'Maintenance'].map(s => (
                    <div 
                      key={s}
                      onClick={() => { setUnit({...unit, status: s}); setIsStatusOpen(false); }}
                      className={`p-4 text-sm cursor-pointer transition-colors flex items-center justify-between ${unit.status === s ? 'bg-playbox-accent/10 text-playbox-accent font-semibold' : 'text-white/80 hover:bg-white/5'}`}
                    >
                      <div className="flex items-center">
                        <span className={`w-2 h-2 rounded-full mr-2 ${s === 'Ready' ? 'bg-playbox-ready' : s === 'Disewa' ? 'bg-playbox-disewa' : 'bg-gray-400'}`}></span>
                        {s === 'Disewa' ? 'Sedang Disewa' : s}
                      </div>
                      {unit.status === s && <span className="text-playbox-accent">✓</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Harga Sewa */}
        <div className="glass-surface p-6 rounded-3xl space-y-4 relative z-10">
          <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest mb-2">Harga Sewa Per Durasi</h2>
          
          {unit.priceTiers?.map((tier: any, idx: number) => (
            <div key={idx} className="flex space-x-2 items-center">
              <input 
                type="number"
                min="1"
                value={tier.durationVal}
                onChange={e => handleTierChange(idx, 'durationVal', parseInt(e.target.value) || '')}
                placeholder="Angka"
                className="w-20 p-4 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent transition-all placeholder:text-white/20 text-center font-bold"
                required
              />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenUnitTierDropdown(openUnitTierDropdown === idx ? null : idx)}
                  className={`w-28 p-4 rounded-xl bg-black/30 border text-white text-sm flex items-center justify-between transition-all font-bold ${
                    openUnitTierDropdown === idx ? 'border-playbox-accent shadow-[0_0_12px_rgba(226,23,142,0.35)] ring-1 ring-playbox-accent' : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <span className="truncate">{tier.durationUnit || 'Jam'}</span>
                  <span className={`text-[9px] text-playbox-accent transition-transform duration-300 ${openUnitTierDropdown === idx ? 'rotate-180' : 'opacity-60'}`}>▼</span>
                </button>

                {openUnitTierDropdown === idx && (
                  <div className="absolute top-full left-0 w-36 mt-2 bg-[#0D1122]/95 border border-white/15 rounded-2xl overflow-hidden shadow-2xl z-50 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 divide-y divide-white/5">
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
              <div className="flex-1 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-playbox-text-secondary text-sm">Rp</span>
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={tier.price ? Number(tier.price).toLocaleString('id-ID') : ''}
                  onChange={e => handleTierChange(idx, 'price', e.target.value)}
                  placeholder="Mis: 150.000"
                  className="w-full p-4 pl-12 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent transition-all placeholder:text-white/20 font-bold"
                  required
                />
              </div>
              {unit.priceTiers.length > 1 && (
                <button type="button" onClick={() => handleRemoveTier(idx)} className="text-red-400 p-3 hover:bg-white/5 rounded-xl transition-colors">×</button>
              )}
            </div>
          ))}
          <button type="button" onClick={handleAddTier} className="text-xs font-bold text-playbox-accent bg-playbox-accent/10 px-4 py-2 rounded-lg hover:bg-playbox-accent/20 transition-colors mt-2">
            + Tambah Durasi
          </button>
        </div>

        {/* Isi Paket (Kelengkapan Standar) */}
        <div className="glass-surface p-6 rounded-3xl space-y-4">
          <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest mb-2">Isi Paket (Kelengkapan)</h2>
          
          {unit.specs.map((spec: string, idx: number) => (
            <div key={idx} className="flex space-x-2">
              <input 
                type="text" 
                value={spec}
                onChange={e => handleSpecChange(idx, e.target.value)}
                placeholder="Contoh: 2 Stik DualSense"
                className="flex-1 p-4 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent transition-all placeholder:text-white/20"
                required
              />
              {unit.specs.length > 1 && (
                <button type="button" onClick={() => handleRemoveSpec(idx)} className="text-red-400 p-3 hover:bg-white/5 rounded-xl transition-colors">×</button>
              )}
            </div>
          ))}
          <button type="button" onClick={handleAddSpec} className="text-xs font-bold text-playbox-accent bg-playbox-accent/10 px-4 py-2 rounded-lg hover:bg-playbox-accent/20 transition-colors mt-2">
            + Tambah Item
          </button>
        </div>

        {/* Game Terinstal */}
        <div className="glass-surface p-6 rounded-3xl space-y-4">
          <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest mb-2">Game Terinstal</h2>
          
          {unit.games?.map((game: string, idx: number) => (
            <div key={idx} className="flex space-x-2">
              <input 
                type="text" 
                value={game}
                onChange={e => handleGameChange(idx, e.target.value)}
                placeholder="Contoh: EA FC 24"
                className="flex-1 p-4 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent transition-all placeholder:text-white/20"
              />
              <button type="button" onClick={() => handleRemoveGame(idx)} className="text-red-400 p-3 hover:bg-white/5 rounded-xl transition-colors">×</button>
            </div>
          ))}
          <button type="button" onClick={handleAddGame} className="text-xs font-bold text-playbox-accent bg-playbox-accent/10 px-4 py-2 rounded-lg hover:bg-playbox-accent/20 transition-colors mt-2">
            + Tambah Game
          </button>
        </div>

        {/* Floating Action Buttons */}
        <div className="fixed bottom-[72px] w-full max-w-md left-1/2 -translate-x-1/2 p-4 bg-playbox-bg/80 backdrop-blur-xl border-t border-white/5 z-40">
          <div className="max-w-md mx-auto">
            <button 
              type="submit" 
              className="w-full py-4 saas-button rounded-2xl font-semibold shadow-[0_4px_20px_rgba(226,23,142,0.4)] text-sm tracking-wide"
            >
              Simpan Perubahan
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
