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
      
      <div className="glass-surface-elevated p-8 sm:p-10 rounded-[2.5rem] w-full max-w-sm relative z-10 shadow-2xl border border-white/10 overflow-hidden group">
        {/* Subtle hover glow effect behind the card */}
        <div className="absolute -inset-0.5 bg-gradient-to-br from-playbox-gradient-start/30 to-playbox-gradient-end/30 rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-xl -z-10"></div>
        
        <div className="text-center mb-8 relative z-10">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-playbox-gradient-start to-playbox-gradient-end flex items-center justify-center text-4xl font-black text-white shadow-[0_0_40px_rgba(226,23,142,0.3)] mb-6 relative group-hover:scale-105 transition-transform duration-500">
            <div className="absolute inset-0 rounded-3xl border border-white/20"></div>
            P
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter mb-1.5 drop-shadow-sm">PLAYBOX</h1>
          <p className="text-xs text-playbox-text-secondary font-medium tracking-wide uppercase">OS / Manajemen Rental</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium p-3 rounded-xl mb-6 text-center animate-in slide-in-from-top-2 fade-in duration-300">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5 relative z-10">
          <div className="group/input">
            <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2 ml-2 group-focus-within/input:text-playbox-accent transition-colors">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within/input:text-playbox-accent transition-colors">👤</span>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-4 pl-11 rounded-2xl bg-black/40 border border-white/5 text-white text-sm focus:outline-none focus:border-playbox-accent focus:bg-playbox-surface transition-all focus:shadow-[0_0_15px_rgba(226,23,142,0.15)]"
                placeholder="Masukkan username"
                required
              />
            </div>
          </div>
          <div className="group/input">
            <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2 ml-2 group-focus-within/input:text-playbox-accent transition-colors">Password</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within/input:text-playbox-accent transition-colors">🔒</span>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-4 pl-11 rounded-2xl bg-black/40 border border-white/5 text-white text-sm focus:outline-none focus:border-playbox-accent focus:bg-playbox-surface transition-all focus:shadow-[0_0_15px_rgba(226,23,142,0.15)]"
                placeholder="••••••"
                required
              />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={loading || !username || !password}
            className="w-full py-4 bg-gradient-to-r from-playbox-gradient-start to-playbox-gradient-end text-white rounded-2xl font-bold shadow-[0_8px_30px_rgba(226,23,142,0.4)] tracking-wide hover:shadow-[0_8px_30px_rgba(226,23,142,0.6)] active:scale-95 transition-all text-sm mt-6 disabled:opacity-50 disabled:active:scale-100 disabled:shadow-none border border-white/10"
          >
            {loading ? (
              <span className="flex items-center justify-center space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </span>
            ) : 'MASUK KE WORKSPACE'}
          </button>
        </form>

        <div className="mt-10 pt-6 border-t border-white/5 text-center relative z-10">
          <p className="text-[10px] text-white/30 font-medium">Versi Demo 0.1.0 (dummy: bos/123 atau kasir/123)</p>
        </div>
      </div>
    </div>
  );
}
