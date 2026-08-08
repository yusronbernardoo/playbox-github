'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';

interface Booking {
  id: string;
  [key: string]: any;
}

interface FirebaseContextType {
  bookings: Booking[];
  shopInfo: any;
  units: any[];
  newBookingToast: Booking | null;
  clearToast: () => void;
  isLoading: boolean;
}

const FirebaseContext = createContext<FirebaseContextType>({
  bookings: [],
  shopInfo: null,
  units: [],
  newBookingToast: null,
  clearToast: () => {},
  isLoading: true,
});

export const useFirebase = () => useContext(FirebaseContext);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [shopInfo, setShopInfo] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [newBookingToast, setNewBookingToast] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialLoadRef = useRef(true);

  useEffect(() => {
    // 1. Get storeId from Auth
    let storeId = 'demo'; // fallback
    if (typeof window !== 'undefined') {
      const auth = localStorage.getItem('playbox_auth');
      if (auth) {
        try {
          const parsed = JSON.parse(auth);
          if (parsed.storeId) storeId = parsed.storeId;
        } catch (e) {}
      }
    }

    const bookingsRef = collection(db, 'stores', storeId, 'bookings');
    const unsubscribeBookings = onSnapshot(bookingsRef, (snapshot) => {
      setIsLoading(false);
      
      const cloudBookings: Booking[] = [];
      snapshot.forEach((docSnap) => {
        cloudBookings.push({ ...docSnap.data(), id: docSnap.id });
      });
      
      // Sort descending by id/createdAt
      cloudBookings.sort((a, b) => (b.createdAt || b.id).localeCompare(a.createdAt || a.id));
      setBookings(cloudBookings);
      
      // Also cache it just for fallback
      localStorage.setItem('playbox_mock_bookings', JSON.stringify(cloudBookings));

      // Notification Logic using docChanges for accuracy
      if (!initialLoadRef.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.status === 'Perlu Verifikasi') {
              setNewBookingToast({ ...data, id: change.doc.id });
              
              // Auto hide after 5 seconds
              setTimeout(() => {
                setNewBookingToast(null);
              }, 5000);
            }
          }
        });
      }
      
      initialLoadRef.current = false;
      
    }, (error) => {
      console.warn('Firestore real-time error:', error);
      const saved = localStorage.getItem('playbox_mock_bookings');
      if (saved) setBookings(JSON.parse(saved));
      setIsLoading(false);
    });

    const shopRef = doc(db, 'stores', storeId);
    const unsubscribeShop = onSnapshot(shopRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setShopInfo(data);
        localStorage.setItem('playbox_shop_settings', JSON.stringify(data));
      } else {
        const saved = localStorage.getItem('playbox_shop_settings');
        if (saved) setShopInfo(JSON.parse(saved));
      }
    });

    const unitsRef = collection(db, 'stores', storeId, 'units');
    const unsubscribeUnits = onSnapshot(unitsRef, (snapshot) => {
      const cloudUnits: any[] = [];
      snapshot.forEach((docSnap) => {
        cloudUnits.push({ ...docSnap.data(), id: docSnap.id });
      });
      setUnits(cloudUnits);
      localStorage.setItem('playbox_mock_units', JSON.stringify(cloudUnits));
    }, (error) => {
      console.warn('Firestore units error:', error);
      const saved = localStorage.getItem('playbox_mock_units');
      if (saved) setUnits(JSON.parse(saved));
    });

    return () => {
      unsubscribeBookings();
      unsubscribeShop();
      unsubscribeUnits();
    };
  }, []);

  const clearToast = () => setNewBookingToast(null);

  return (
    <FirebaseContext.Provider value={{ bookings, shopInfo, units, newBookingToast, clearToast, isLoading }}>
      {children}
    </FirebaseContext.Provider>
  );
}
