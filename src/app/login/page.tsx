'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Simulate network delay
    setTimeout(() => {
      if (username === 'bos' && password === '123') {
        localStorage.setItem('playbox_auth', JSON.stringify({ username: 'bos', role: 'owner' }));
        router.push('/dashboard');
      } else if (username === 'kasir' && password === '123') {
        localStorage.setItem('playbox_auth', JSON.stringify({ username: 'kasir', role: 'kasir' }));
        router.push('/dashboard/booking');
      } else {
        setError('Username atau Password salah!');
        setLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-playbox-bg relative overflow-hidden p-4">
      <div className="ambient-glow"></div>
      
      <div className="glass-surface p-8 rounded-3xl w-full max-w-sm relative z-10 shadow-2xl border border-white/10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white tracking-tighter mb-2">PLAYBOX</h1>
          <p className="text-sm text-playbox-text-secondary">OS / Manajemen Rental</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl mb-6 text-center animate-in fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2 ml-1">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-4 rounded-2xl bg-black/40 border border-white/5 text-white text-sm focus:outline-none focus:border-playbox-accent transition-colors"
              placeholder="Masukkan username"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2 ml-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 rounded-2xl bg-black/40 border border-white/5 text-white text-sm focus:outline-none focus:border-playbox-accent transition-colors"
              placeholder="••••••"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading || !username || !password}
            className="w-full py-4 bg-playbox-accent text-white rounded-2xl font-bold shadow-[0_4px_20px_rgba(226,23,142,0.4)] tracking-wide hover:bg-opacity-90 active:scale-95 transition-all text-sm mt-4 disabled:opacity-50 disabled:active:scale-100"
          >
            {loading ? 'Memverifikasi...' : 'MASUK'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <p className="text-[10px] text-white/30">Versi Demo 0.1.0 (Akun dummy: bos/123 atau kasir/123)</p>
        </div>
      </div>
    </div>
  );
}
