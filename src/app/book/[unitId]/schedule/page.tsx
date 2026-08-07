'use client';
import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useParams, useRouter } from 'next/navigation';

export default function CustomerSchedule() {
  const { unitId } = useParams();
  const router = useRouter();

  const [schedule, setSchedule] = useState({ date: '', time: '', duration: 24 });

  // Dropdown states
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [tempTime, setTempTime] = useState('08:00');

  // Mock
  const unitName = unitId === '1' ? 'PS5 Premium Set' : 'PS4 Slim';
  
  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/book/${unitId}/details`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-playbox-bg text-playbox-text-primary max-w-md mx-auto relative shadow-2xl p-4">
      {/* Header */}
      <div className="flex items-center mt-2 mb-6">
        <button onClick={() => router.back()} className="text-xl mr-4">←</button>
        <div>
          <h1 className="text-lg font-bold">Pilih Jadwal</h1>
          <p className="text-xs text-playbox-text-secondary">{unitName}</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between mb-8 px-8">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-playbox-accent text-white flex items-center justify-center font-bold text-sm">1</div>
          <span className="text-[10px] mt-1 text-playbox-accent">Jadwal</span>
        </div>
        <div className="h-0.5 bg-[#2A3455] flex-1 mx-2"></div>
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-[#2A3455] text-playbox-text-secondary flex items-center justify-center font-bold text-sm">2</div>
          <span className="text-[10px] mt-1 text-playbox-text-secondary">Data Diri</span>
        </div>
      </div>

      <form onSubmit={handleNext} className="flex-1 flex flex-col space-y-6">
        
        <div className="bg-playbox-surface p-4 rounded-xl border border-[#2A3455] space-y-4">
          <div>
            <label className="block text-sm text-playbox-text-secondary mb-1">Tanggal Sewa</label>
            <div className="relative">
              <div 
                onClick={() => { setIsDatePickerOpen(!isDatePickerOpen); setIsTimePickerOpen(false); }}
                className={`w-full p-3 rounded-lg bg-[#1A2240] border text-sm flex justify-between items-center cursor-pointer transition-all ${isDatePickerOpen ? 'border-playbox-accent shadow-[0_0_10px_rgba(37,99,235,0.2)] text-white' : 'border-[#2A3455] hover:border-white/20 text-white/80'}`}
              >
                {schedule.date ? format(new Date(schedule.date), 'dd MMMM yyyy', { locale: idLocale }) : <span className="text-white/40">Pilih Tanggal</span>}
                <span className="opacity-70">📅</span>
              </div>
              
              {isDatePickerOpen && (
                <div className="absolute top-full left-0 mt-2 p-3 bg-[#1A2240] border border-[#2A3455] rounded-2xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
                  <style>{`
                    .rdp { --rdp-cell-size: 38px; --rdp-accent-color: #2563eb; --rdp-background-color: rgba(37,99,235,0.2); margin: 0; }
                    .rdp-day_selected, .rdp-day_selected:focus-visible, .rdp-day_selected:hover { background-color: var(--rdp-accent-color); color: white; font-weight: bold; }
                    .rdp-button:hover:not([disabled]):not(.rdp-day_selected) { background-color: rgba(255,255,255,0.1); }
                    .rdp-caption_label { padding-right: 24px; font-size: 14px; font-weight: bold; }
                    .rdp-nav { gap: 8px; }
                  `}</style>
                  <DayPicker
                    mode="single"
                    selected={schedule.date ? new Date(schedule.date) : undefined}
                    onSelect={(d) => {
                      if (d) {
                        const dStr = format(d, 'yyyy-MM-dd');
                        setSchedule({...schedule, date: dStr});
                        setIsDatePickerOpen(false);
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[11px] font-medium text-playbox-text-secondary uppercase tracking-wider">Jam Mulai</label>
              <button 
                type="button" 
                onClick={() => {
                  const now = new Date();
                  const t = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                  setSchedule({...schedule, time: t});
                }}
                className="text-[10px] font-bold text-playbox-accent hover:text-white transition-colors"
              >
                Waktu Saat Ini
              </button>
            </div>
            <div className="relative">
              <div 
                onClick={() => { 
                  setTempTime(schedule.time || '08:00'); 
                  setIsTimePickerOpen(true); 
                  setIsDatePickerOpen(false); 
                }}
                className={`w-full p-4 rounded-xl bg-black/20 border text-sm flex justify-between items-center cursor-pointer transition-all ${isTimePickerOpen ? 'border-playbox-accent text-white shadow-[0_0_10px_rgba(37,99,235,0.2)]' : 'border-[#2A3455] text-white/80'}`}
              >
                {schedule.time || <span className="text-white/40">00:00</span>}
                <span className="opacity-70">⏰</span>
              </div>
              
              {isTimePickerOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
                  <div className="bg-[#161B30] p-6 border border-white/10 rounded-3xl shadow-2xl relative max-w-[320px] w-full space-y-5">
                    <div className="flex justify-between items-center">
                      <h3 className="text-white font-bold text-sm">Pilih Waktu Sewa</h3>
                      <button type="button" onClick={() => setIsTimePickerOpen(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors text-xs">✕</button>
                    </div>
                    
                    {/* Direct Input (Big Display) */}
                    <div className="flex justify-center items-center space-x-3 my-2">
                      <input 
                        type="text" 
                        maxLength={2} 
                        value={tempTime.split(':')[0]} 
                        onChange={(e) => {
                           let h = e.target.value.replace(/\D/g, '');
                           if (parseInt(h) > 23) h = '23';
                           setTempTime(`${h}:${tempTime.split(':')[1] || '00'}`);
                        }}
                        onBlur={(e) => {
                           let h = e.target.value.padStart(2, '0');
                           if (!h || h === '000') h = '08';
                           if (parseInt(h) > 23) h = '23';
                           setTempTime(`${h}:${tempTime.split(':')[1] || '00'}`);
                        }}
                        className="w-20 h-20 bg-[#0E1326] border border-white/10 rounded-2xl text-4xl text-center font-extrabold text-white focus:border-playbox-accent focus:bg-playbox-accent/10 focus:outline-none transition-all shadow-inner" 
                      />
                      <span className="text-4xl font-extrabold text-white/30 pb-1">:</span>
                      <input 
                        type="text" 
                        maxLength={2} 
                        value={tempTime.split(':')[1] || '00'} 
                        onChange={(e) => {
                           let m = e.target.value.replace(/\D/g, '');
                           if (parseInt(m) > 59) m = '59';
                           setTempTime(`${tempTime.split(':')[0] || '00'}:${m}`);
                        }}
                        onBlur={(e) => {
                           let m = e.target.value.padStart(2, '0');
                           if (!m || m === '000') m = '00';
                           if (parseInt(m) > 59) m = '59';
                           setTempTime(`${tempTime.split(':')[0] || '00'}:${m}`);
                        }}
                        className="w-20 h-20 bg-[#0E1326] border border-white/10 rounded-2xl text-4xl text-center font-extrabold text-white focus:border-playbox-accent focus:bg-playbox-accent/10 focus:outline-none transition-all shadow-inner" 
                      />
                    </div>

                    {/* Quick Select Grid */}
                    <div>
                      <p className="text-[10px] text-white/40 text-center mb-3 uppercase font-bold tracking-[0.2em]">Pilih Cepat</p>
                      <div className="grid grid-cols-4 gap-2">
                        {['08:00', '10:00', '13:00', '15:00', '17:00', '19:00', '21:00', '23:00'].map(t => (
                          <button 
                            key={t}
                            type="button"
                            onClick={() => setTempTime(t)}
                            className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${tempTime === t ? 'bg-playbox-accent border-playbox-accent text-white shadow-[0_4px_15px_rgba(37,99,235,0.4)] scale-105' : 'bg-white/5 border-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button 
                      type="button"
                      onClick={() => {
                        const parts = (tempTime || '08:00').split(':');
                        const h = (parts[0] || '08').padStart(2, '0');
                        const m = (parts[1] || '00').padStart(2, '0');
                        const finalTime = `${h}:${m}`;
                        setSchedule({...schedule, time: finalTime});
                        setIsTimePickerOpen(false);
                      }}
                      className="w-full py-4 bg-gradient-to-r from-[#2563eb] via-pink-600 to-purple-600 hover:opacity-95 text-white font-bold rounded-2xl text-sm shadow-[0_4px_20px_rgba(37,99,235,0.35)] active:scale-95 transition-all"
                    >
                      Simpan Jam
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-playbox-text-secondary mb-1">Pilih Paket Durasi</label>
            <div className="grid grid-cols-2 gap-3">
              {[6, 12, 24].map(dur => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => setSchedule({...schedule, duration: dur})}
                  className={`py-3 rounded-lg border font-bold text-sm ${
                    schedule.duration === dur 
                      ? 'bg-playbox-accent border-playbox-accent text-white' 
                      : 'bg-[#1A2240] border-[#2A3455] text-playbox-text-secondary hover:text-white'
                  }`}
                >
                  {dur} Jam
                </button>
              ))}
            </div>
          </div>
        </div>

        {schedule.date && schedule.time && (
          <div className="bg-playbox-ready/10 border border-playbox-ready p-3 rounded-xl flex items-center">
            <span className="text-playbox-ready mr-3 text-xl">✓</span>
            <div>
              <p className="text-sm font-bold text-playbox-ready">Jadwal Tersedia!</p>
              <p className="text-xs text-playbox-ready/80">Slot ini bisa dibooking.</p>
            </div>
          </div>
        )}

        <div className="mt-auto pt-6">
          <button 
            type="submit" 
            className="w-full py-4 rounded-xl font-bold bg-white text-black hover:bg-gray-200 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]"
          >
            Lanjut Isi Data Diri
          </button>
        </div>
      </form>
    </div>
  );
}
