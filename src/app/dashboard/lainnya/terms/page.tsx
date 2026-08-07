'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TermsAndConditions() {
  const router = useRouter();

  const [terms, setTerms] = useState(
    "1. Penyewa wajib menyertakan KTP/SIM asli saat penyewaan sebagai jaminan.\n2. Waktu sewa dihitung 24 jam sejak unit diserahkan.\n3. Keterlambatan pengembalian dikenakan denda Rp 10.000/jam.\n4. Segala bentuk kerusakan hardware maupun controller akibat kelalaian penyewa menjadi tanggung jawab penyewa secara penuh (wajib mengganti biaya servis/komponen).\n5. Tidak diperkenankan meminjamkan kembali (sub-rental) unit kepada pihak ketiga tanpa sepengetahuan pihak PlayBox Malang."
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Syarat & Ketentuan berhasil disimpan!');
    router.back();
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
          <h1 className="text-xl font-bold tracking-tight">Syarat & Ketentuan</h1>
        </div>
      </div>

      <div className="relative z-10">
        <p className="text-sm text-playbox-text-secondary mb-4">
          Teks ini akan ditampilkan pada halaman checkout pelanggan dan di-print dalam invoice PDF. Pastikan aturan tertulis dengan jelas.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="glass-surface p-1 rounded-2xl">
            {/* Toolbar Editor (Mock) */}
            <div className="flex space-x-2 p-3 border-b border-white/5 overflow-x-auto scrollbar-hide">
              {['B', 'I', 'U'].map(format => (
                <button key={format} type="button" className="w-8 h-8 rounded bg-white/5 text-white/70 hover:bg-white/10 font-bold transition-colors">
                  {format}
                </button>
              ))}
              <div className="w-px h-6 bg-white/10 mx-2 self-center"></div>
              <button type="button" className="px-3 h-8 rounded bg-white/5 text-white/70 hover:bg-white/10 text-xs font-bold transition-colors">
                List
              </button>
            </div>
            
            <textarea 
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className="w-full p-4 bg-transparent text-white text-sm focus:outline-none resize-none h-[40vh] leading-relaxed"
              placeholder="Ketik syarat & ketentuan di sini..."
              required
            ></textarea>
          </div>

          {/* Floating Action Button */}
          <div className="fixed bottom-[72px] w-full max-w-md left-1/2 -translate-x-1/2 p-4 bg-playbox-bg/80 backdrop-blur-xl border-t border-white/5 z-50">
            <div className="max-w-md mx-auto">
              <button 
                type="submit" 
                className="w-full py-4 saas-button rounded-2xl font-semibold shadow-[0_4px_20px_rgba(37,99,235,0.4)] text-sm tracking-wide"
              >
                Simpan Ketentuan
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
