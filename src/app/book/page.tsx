'use client';
import Link from 'next/link';

export default function CustomerLanding() {
  const businessName = "PlayBox Malang";

  const availableUnits = [
    {
      id: 1,
      name: 'PS5 Premium Set',
      price: 'Rp 150.000 / 24 Jam',
      package: 'PS5 + 2 Stik + TV 43"',
    },
    {
      id: 4,
      name: 'PS4 Slim',
      price: 'Rp 100.000 / 24 Jam',
      package: 'PS4 + 2 Stik',
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-playbox-bg text-playbox-text-primary max-w-md mx-auto relative shadow-2xl">
      {/* Header */}
      <header className="p-6 bg-gradient-to-b from-playbox-surface to-transparent text-center border-b border-[#2A3455]">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-playbox-gradient-start to-playbox-gradient-end flex items-center justify-center mb-4 shadow-lg">
          <span className="text-3xl font-bold text-white">P</span>
        </div>
        <h1 className="text-2xl font-bold text-white">{businessName}</h1>
        <p className="text-sm text-playbox-text-secondary mt-1">Sewa PlayStation Cepat, Anti Bentrok!</p>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 pb-24">
        <h2 className="font-bold mb-4 flex justify-between items-center">
          <span>Pilih Unit yang Tersedia</span>
          <span className="text-xs text-playbox-ready bg-playbox-ready/10 px-2 py-1 rounded">Live</span>
        </h2>
        
        <div className="space-y-4">
          {availableUnits.map(unit => (
            <div key={unit.id} className="bg-playbox-surface rounded-2xl p-4 border border-[#2A3455] flex flex-col">
              <div className="flex items-start space-x-4 mb-4">
                <div className="w-24 h-24 bg-[#1A2240] rounded-xl flex items-center justify-center border border-[#2A3455] flex-shrink-0">
                  <span className="text-4xl">🎮</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{unit.name}</h3>
                  <p className="text-playbox-text-secondary text-xs mt-1 mb-2">Mulai dari</p>
                  <p className="font-bold text-playbox-accent">{unit.price}</p>
                </div>
              </div>
              
              <div className="bg-[#1A2240] rounded-lg p-3 text-xs text-playbox-text-primary mb-4 flex items-center">
                <span className="mr-2">📦</span> {unit.package}
              </div>

              <Link 
                href={`/book/${unit.id}/schedule`}
                className="w-full text-center py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Booking Sekarang
              </Link>
            </div>
          ))}
        </div>
      </main>
      
      {/* Footer Track Booking */}
      <div className="p-4 bg-playbox-surface border-t border-[#2A3455] text-center">
        <p className="text-sm text-playbox-text-secondary">
          Sudah melakukan booking? <Link href="/book/track" className="text-playbox-accent font-bold hover:underline">Lacak Status</Link>
        </p>
      </div>
    </div>
  );
}
