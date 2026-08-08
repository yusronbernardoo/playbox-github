'use client';
import { getStoreId, getTenantStorageKey } from '@/lib/tenant';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface Admin {
  id: string;
  name: string;
  role: string;
  email: string;
  active: boolean;
  password?: string;
}

export default function AdminManagement() {
  const router = useRouter();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Staff Admin');
  const [active, setActive] = useState(true);

  useEffect(() => {
    const loadAdmins = async () => {
      let loaded: Admin[] | null = null;
      try {
        const snap = await getDoc(doc(db, 'stores', getStoreId(), 'settings', 'admins'));
        if (snap.exists() && snap.data()?.list) {
          loaded = snap.data().list;
        }
      } catch (err) {
        console.warn('Fallback loading admins:', err);
      }

      if (!loaded) {
        const saved = localStorage.getItem(getTenantStorageKey('playbox_admins'));
        if (saved) {
          loaded = JSON.parse(saved);
        }
      }

      if (loaded) {
        setAdmins(loaded);
      } else {
        const initial: Admin[] = [
          { id: 'A01', name: 'Owner Toko', role: 'Owner', email: 'owner@playbox.com', active: true, password: 'password123' },
          { id: 'A02', name: 'Kasir Toko', role: 'Staff Admin', email: 'kasir@playbox.com', active: true, password: 'password123' },
        ];
        setAdmins(initial);
        localStorage.setItem(getTenantStorageKey('playbox_admins'), JSON.stringify(initial));
      }
    };

    loadAdmins();
  }, []);

  const openAddModal = () => {
    setEditId(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole('Staff Admin');
    setActive(true);
    setShowModal(true);
  };

  const openEditModal = (admin: Admin) => {
    setEditId(admin.id);
    setName(admin.name);
    setEmail(admin.email);
    setPassword(''); // don't show real password, but allow changing
    setRole(admin.role);
    setActive(admin.active);
    setShowModal(true);
  };

  const saveAdmin = async () => {
    if (!name || !email) return alert('Nama dan Email wajib diisi!');

    let updated = [...admins];
    if (editId) {
      // Edit
      updated = updated.map(a => {
        if (a.id === editId) {
          const newData = { ...a, name, email, role, active };
          if (password) (newData as any).password = password;
          return newData;
        }
        return a;
      });
    } else {
      // Add
      if (!password) return alert('Password wajib diisi untuk admin baru!');
      const newAdmin: Admin = {
        id: 'A' + Math.floor(Math.random() * 10000),
        name, email, role, active, password
      };
      updated.push(newAdmin);
    }

    setAdmins(updated);
    localStorage.setItem(getTenantStorageKey('playbox_admins'), JSON.stringify(updated));
    try {
      await setDoc(doc(db, 'stores', getStoreId(), 'settings', 'admins'), {
        list: updated,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error('Failed to sync admin to Firestore:', err);
    }

    setShowModal(false);
  };

  const deleteAdmin = async (id: string) => {
    if (confirm('Yakin ingin menghapus admin ini?')) {
      const updated = admins.filter(a => a.id !== id);
      setAdmins(updated);
      localStorage.setItem(getTenantStorageKey('playbox_admins'), JSON.stringify(updated));
      try {
        await setDoc(doc(db, 'stores', getStoreId(), 'settings', 'admins'), {
          list: updated,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error('Failed to sync admin delete to Firestore:', err);
      }
      setShowModal(false);
    }
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
          <h1 className="text-xl font-bold tracking-tight">Manajemen Admin</h1>
        </div>
      </div>

      <div className="space-y-4 relative z-10">
        {admins.map((admin) => (
          <div key={admin.id} className="glass-surface p-5 rounded-2xl flex items-center justify-between group hover:bg-white/5 transition-colors">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-lg font-bold uppercase">
                {admin.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-white/90">{admin.name}</h3>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${admin.role === 'Owner' ? 'bg-playbox-accent/20 text-playbox-accent' : 'bg-white/10 text-white/70'}`}>
                    {admin.role}
                  </span>
                  <span className="text-[10px] text-playbox-text-secondary">{admin.email}</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-end space-y-2">
              <div className={`w-2.5 h-2.5 rounded-full ${admin.active ? 'bg-playbox-ready shadow-[0_0_8px_rgba(35,197,82,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`}></div>
              <button onClick={() => openEditModal(admin)} className="text-xs text-playbox-text-secondary hover:text-white transition-colors">Edit</button>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Action Button */}
      {/* Floating Action Button */}
      <div className="fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2 p-4 pb-6 sm:pb-4 bg-[#0A0F1F]/95 backdrop-blur-2xl border-t border-white/10 z-40 shadow-2xl">
        <button 
          onClick={openAddModal}
          type="button" 
          className="w-full py-4 bg-playbox-accent text-white rounded-2xl font-bold shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:bg-blue-600 transition-all text-sm tracking-wide"
        >
          + Tambah Admin Baru
        </button>
      </div>

      {/* Modal Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 max-w-md mx-auto flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#0A0F1F] w-full max-h-[88vh] sm:rounded-3xl rounded-t-3xl border border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 duration-300 relative overflow-hidden">
            <div className="p-5 border-b border-white/10 shrink-0 bg-[#0A0F1F]/95 backdrop-blur-md z-10 flex justify-between items-center">
              <h2 className="text-lg font-bold">{editId ? 'Edit Admin' : 'Tambah Admin'}</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 text-white/70">✕</button>
            </div>
            
            <div className="p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
              <div>
                <label className="block text-xs font-bold text-white/60 uppercase mb-2">Nama Lengkap</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-4 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent" />
              </div>
              <div>
                <label className="block text-xs font-bold text-white/60 uppercase mb-2">Email / Username</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent" />
              </div>
              <div>
                <label className="block text-xs font-bold text-white/60 uppercase mb-2">Password {editId && '(Kosongkan jika tidak diubah)'}</label>
                <input type="text" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent" />
              </div>
              <div>
                <label className="block text-xs font-bold text-white/60 uppercase mb-2">Role Akses</label>
                <select value={role} onChange={e => setRole(e.target.value)} className="w-full p-4 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-playbox-accent appearance-none">
                  <option value="Staff Admin">Staff Admin (Kasir)</option>
                  <option value="Owner">Owner (Pemilik)</option>
                </select>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                <div>
                  <h3 className="font-bold text-sm">Status Aktif</h3>
                  <p className="text-xs text-white/50">Admin dapat login ke sistem</p>
                </div>
                <button 
                  onClick={() => setActive(!active)}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${active ? 'bg-playbox-ready' : 'bg-white/20'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute transition-transform ${active ? 'translate-x-7' : 'translate-x-1'}`}></div>
                </button>
              </div>
            </div>

            <div className="p-4 pb-6 sm:pb-4 border-t border-white/10 bg-[#0A0F1F] shrink-0 flex gap-3 z-20">
              {editId && (
                <button onClick={() => deleteAdmin(editId)} className="p-3.5 rounded-xl font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 w-14 flex justify-center items-center border border-red-500/20 transition-colors">
                  🗑
                </button>
              )}
              <button onClick={saveAdmin} className="flex-1 py-4 bg-playbox-accent text-white rounded-xl font-bold shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:bg-blue-600 transition-all text-sm">
                Simpan Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
