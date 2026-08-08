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
      
      <div className="glass-surface-elevated p-6 sm:p-8 rounded-3xl w-full max-w-sm relative z-10 shadow-2xl border border-white/10 overflow-hidden group">
        {/* Subtle hover glow effect behind the card */}
        <div className="absolute -inset-0.5 bg-gradient-to-br from-playbox-gradient-start/30 to-playbox-gradient-end/30 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-xl -z-10"></div>
        
        <div className="text-center mb-6 relative z-10">
          <div className="mx-auto w-32 h-14 mb-4 relative flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
            <img 
              src="/renterva-logo.png" 
              alt="Renterva Play Logo" 
              className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(37,99,235,0.4)]"
            />
          </div>
          
          <h1 className="text-xl sm:text-2xl font-black mb-3 tracking-tight leading-tight text-white relative inline-block px-4">
            Sistem Operasional Rental<br/>Playstation Professional
          </h1>
          <p className="text-[11px] text-white/50 font-medium tracking-wide max-w-[250px] mx-auto leading-relaxed">
            Kelola rental Anda dengan mudah dalam satu platform cerdas.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium p-3 rounded-xl mb-4 text-center animate-in slide-in-from-top-2 fade-in duration-300">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 relative z-10">
          <div className="group/input">
            <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1.5 ml-2 group-focus-within/input:text-playbox-accent transition-colors">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within/input:text-playbox-accent transition-colors">👤</span>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3.5 pl-11 rounded-2xl bg-black/40 border border-white/5 text-white text-sm focus:outline-none focus:border-playbox-accent focus:bg-playbox-surface transition-all focus:shadow-[0_0_15px_rgba(37,99,235,0.15)]"
                placeholder="Masukkan username"
                required
              />
            </div>
          </div>
          <div className="group/input">
            <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1.5 ml-2 group-focus-within/input:text-playbox-accent transition-colors">Password</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within/input:text-playbox-accent transition-colors">🔒</span>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3.5 pl-11 rounded-2xl bg-black/40 border border-white/5 text-white text-sm focus:outline-none focus:border-playbox-accent focus:bg-playbox-surface transition-all focus:shadow-[0_0_15px_rgba(37,99,235,0.15)]"
                placeholder="••••••"
                required
              />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={loading || !username || !password}
            className="w-full py-3.5 bg-gradient-to-r from-playbox-gradient-start to-playbox-gradient-end text-white rounded-2xl font-bold shadow-[0_8px_30px_rgba(37,99,235,0.4)] tracking-wide hover:shadow-[0_8px_30px_rgba(37,99,235,0.6)] active:scale-95 transition-all text-sm mt-4 disabled:opacity-50 disabled:active:scale-100 disabled:shadow-none border border-white/10"
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

        <div className="mt-6 pt-4 border-t border-white/5 text-center relative z-10">
          <p className="text-[10px] text-white/30 font-medium">Versi Demo 0.1.0 (dummy: bos/123 atau kasir/123)</p>
        </div>
      </div>
    </div>
  );
}
