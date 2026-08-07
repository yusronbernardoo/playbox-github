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
  newBookingToast: Booking | null;
  clearToast: () => void;
  isLoading: boolean;
}

const FirebaseContext = createContext<FirebaseContextType>({
  bookings: [],
  shopInfo: null,
  newBookingToast: null,
  clearToast: () => {},
  isLoading: true,
});

export const useFirebase = () => useContext(FirebaseContext);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [shopInfo, setShopInfo] = useState<any>(null);
  const [newBookingToast, setNewBookingToast] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialLoadRef = useRef(true);

  useEffect(() => {
    const unsubscribeBookings = onSnapshot(collection(db, 'bookings'), (snapshot) => {
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

    const unsubscribeShop = onSnapshot(doc(db, 'settings', 'shop'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setShopInfo(data);
        localStorage.setItem('playbox_shop_settings', JSON.stringify(data));
      } else {
        const saved = localStorage.getItem('playbox_shop_settings');
        if (saved) setShopInfo(JSON.parse(saved));
      }
    });

    return () => {
      unsubscribeBookings();
      unsubscribeShop();
    };
  }, []);

  const clearToast = () => setNewBookingToast(null);

  return (
    <FirebaseContext.Provider value={{ bookings, shopInfo, newBookingToast, clearToast, isLoading }}>
      {children}
    </FirebaseContext.Provider>
  );
}
