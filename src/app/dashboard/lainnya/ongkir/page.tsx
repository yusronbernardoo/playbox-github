'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OngkirSettingsPage() {
  const router = useRouter();

  const [rules, setRules] = useState<{minKm: number, maxKm: number, fee: number}[]>([]);
  const [newRule, setNewRule] = useState({ minKm: '', maxKm: '', fee: '' });

  useEffect(() => {
    const saved = localStorage.getItem('playbox_delivery_rules');
    if (saved) {
      setRules(JSON.parse(saved));
    } else {
      // Default fallback
      const defaultRules = [
        { minKm: 0, maxKm: 5, fee: 0 },
        { minKm: 6, maxKm: 10, fee: 10000 },
        { minKm: 11, maxKm: 15, fee: 20000 },
        { minKm: 16, maxKm: 999, fee: 50000 }
      ];
      setRules(defaultRules);
      localStorage.setItem('playbox_delivery_rules', JSON.stringify(defaultRules));
    }
  }, []);

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.minKm || !newRule.maxKm || !newRule.fee) return alert('Lengkapi semua kolom!');
    
    const min = parseInt(newRule.minKm);
    const max = parseInt(newRule.maxKm);
    const fee = parseInt(newRule.fee);

    if (min >= max && max !== 999) return alert('Batas maksimum (Km) harus lebih besar dari batas minimum!');

    const updatedRules = [...rules, { minKm: min, maxKm: max, fee }];
    
    // Sort by minKm
    updatedRules.sort((a, b) => a.minKm - b.minKm);
    
    setRules(updatedRules);
    localStorage.setItem('playbox_delivery_rules', JSON.stringify(updatedRules));
    
    setNewRule({ minKm: '', maxKm: '', fee: '' });
  };

  const removeRule = (idx: number) => {
    const confirmDelete = window.confirm('Hapus aturan ongkir ini?');
    if (confirmDelete) {
      const updated = rules.filter((_, i) => i !== idx);
      setRules(updated);
      localStorage.setItem('playbox_delivery_rules', JSON.stringify(updated));
    }
  };

  return (
    <div className="p-4 pb-28 min-h-screen flex flex-col relative">
      <div className="ambient-glow"></div>

      {/* Header */}
      <div className="flex items-center mt-2 mb-6 relative z-10">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl mr-4 hover:bg-white/10 transition-colors">
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Pengaturan Ongkir</h1>
          <p className="text-xs text-playbox-text-secondary mt-0.5">Tarif Antar-Jemput berdasar Jarak</p>
        </div>
      </div>

      <div className="relative z-10 space-y-6">
        <div className="glass-surface p-5 rounded-2xl">
          <h2 className="text-sm font-bold text-white/90 mb-4 flex items-center"><span className="mr-2">📋</span> Aturan Jarak Saat Ini</h2>
          
          <div className="space-y-3">
            {rules.length === 0 ? (
              <p className="text-white/50 text-xs italic text-center py-4">Belum ada aturan ongkir.</p>
            ) : (
              rules.map((rule, idx) => (
                <div key={idx} className="flex justify-between items-center bg-black/20 p-4 rounded-xl border border-white/5">
                  <div>
                    <p className="text-sm font-semibold text-white/90">
                      {rule.maxKm === 999 ? `> ${rule.minKm - 1} km` : `${rule.minKm} - ${rule.maxKm} km`}
                    </p>
                    <p className="text-[11px] text-playbox-text-secondary mt-1">
                      {rule.fee === 0 ? <span className="text-playbox-ready font-bold">Free Ongkir</span> : `Rp ${rule.fee.toLocaleString('id-ID')}`}
                    </p>
                  </div>
                  <button onClick={() => removeRule(idx)} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors text-xs">
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <form onSubmit={handleAddRule} className="glass-surface p-5 rounded-2xl space-y-4">
          <h2 className="text-sm font-bold text-white/90 flex items-center"><span className="mr-2">➕</span> Tambah Aturan Baru</h2>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase text-white/50 mb-1.5 font-medium">Jarak Min (km)</label>
              <input 
                type="number" 
                value={newRule.minKm}
                onChange={e => setNewRule({...newRule, minKm: e.target.value})}
                className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent"
                placeholder="Mis: 16"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-white/50 mb-1.5 font-medium">Jarak Max (km)</label>
              <input 
                type="number" 
                value={newRule.maxKm}
                onChange={e => setNewRule({...newRule, maxKm: e.target.value})}
                className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent"
                placeholder="999 = Tak Terbatas"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase text-white/50 mb-1.5 font-medium">Biaya Ongkir (Rp)</label>
            <input 
              type="number" 
              value={newRule.fee}
              onChange={e => setNewRule({...newRule, fee: e.target.value})}
              className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent"
              placeholder="Mis: 40000"
              required
            />
          </div>
          <button type="submit" className="w-full py-3 bg-white/10 hover:bg-playbox-accent text-white rounded-xl text-sm font-semibold transition-colors mt-2">
            Simpan Aturan Jarak
          </button>
        </form>
        
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-200 text-[11px] leading-relaxed">
          <strong className="block text-blue-400 mb-1">💡 Tips Owner:</strong>
          Gunakan angka <b>999</b> pada Jarak Max untuk membuat tarif <i>"Batas Tak Terhingga"</i> (Misal: Jarak lebih dari 16km, maka Jarak Min: 16, Jarak Max: 999).
        </div>
      </div>
    </div>
  );
}
