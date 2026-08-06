'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DendaSettingsPage() {
  const router = useRouter();

  const [tolerance, setTolerance] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('playbox_denda_rules');
    if (saved) {
      const parsed = JSON.parse(saved);
      setTolerance(parsed.tolerance.toString());
      setHourlyRate(parsed.hourlyRate.toString());
    } else {
      setTolerance('15');
      setHourlyRate('20000');
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tolerance || !hourlyRate) return alert('Lengkapi semua kolom!');
    
    const rules = {
      tolerance: parseInt(tolerance),
      hourlyRate: parseInt(hourlyRate)
    };
    
    localStorage.setItem('playbox_denda_rules', JSON.stringify(rules));
    alert('Pengaturan Denda berhasil disimpan!');
    router.back();
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
          <h1 className="text-xl font-bold tracking-tight">Pengaturan Denda</h1>
          <p className="text-xs text-playbox-text-secondary mt-0.5">Tarif Keterlambatan Sewa</p>
        </div>
      </div>

      <div className="relative z-10 space-y-6">
        <form onSubmit={handleSave} className="glass-surface p-5 rounded-2xl space-y-5">
          <div className="p-4 bg-playbox-ready/10 border border-playbox-ready/20 rounded-xl text-playbox-ready text-[11px] leading-relaxed">
            <strong className="block mb-1">💡 Cara Kerja:</strong>
            Sistem akan menghitung denda keterlambatan secara otomatis saat Anda membuat Invoice Selesai. Jika klien lewat dari masa toleransi, akan dikalikan dengan tarif per jam di bawah ini.
          </div>

          <div>
            <label className="block text-xs font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Masa Toleransi (Menit)</label>
            <p className="text-[10px] text-white/50 mb-2">Batas waktu aman sebelum dihitung telat.</p>
            <div className="relative">
              <input 
                type="number" 
                value={tolerance}
                onChange={e => setTolerance(e.target.value)}
                className="w-full p-4 pr-16 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent transition-colors"
                placeholder="Mis: 15"
                min="0"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-playbox-text-secondary text-sm font-medium">Menit</span>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-playbox-text-secondary mb-1.5 uppercase tracking-wider">Tarif Denda (Per Jam)</label>
            <p className="text-[10px] text-white/50 mb-2">Berlaku kelipatan (misal telat 2 jam = 2 x tarif).</p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-playbox-text-secondary text-sm font-medium">Rp</span>
              <input 
                type="number" 
                value={hourlyRate}
                onChange={e => setHourlyRate(e.target.value)}
                className="w-full p-4 pl-12 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent transition-colors"
                placeholder="Mis: 20000"
                min="0"
                required
              />
            </div>
          </div>

          <button type="submit" className="w-full py-4 mt-4 bg-playbox-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-playbox-accent/30 hover:shadow-playbox-accent/50 hover:bg-[#6C3FFF] transition-all active:scale-95">
            Simpan Pengaturan
          </button>
        </form>
      </div>
    </div>
  );
}
