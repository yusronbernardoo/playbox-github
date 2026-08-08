'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { getStoreId, getTenantStorageKey } from '@/lib/tenant';

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
    const storeId = getStoreId();

    // 0. Load cached data first for instant render
    if (typeof window !== 'undefined') {
      const savedBookings = localStorage.getItem(getTenantStorageKey('playbox_mock_bookings'));
      if (savedBookings) {
        try { setBookings(JSON.parse(savedBookings)); } catch (e) {}
      }
      const savedUnits = localStorage.getItem(getTenantStorageKey('playbox_mock_units'));
      if (savedUnits) {
        try { setUnits(JSON.parse(savedUnits)); } catch (e) {}
      }
      const savedShop = localStorage.getItem(getTenantStorageKey('playbox_shop_settings'));
      if (savedShop) {
        try { setShopInfo(JSON.parse(savedShop)); } catch (e) {}
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
      localStorage.setItem(getTenantStorageKey('playbox_mock_bookings'), JSON.stringify(cloudBookings));

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
      const saved = localStorage.getItem(getTenantStorageKey('playbox_mock_bookings'));
      if (saved) setBookings(JSON.parse(saved));
      setIsLoading(false);
    });

    const shopRef = doc(db, 'stores', storeId);
    const unsubscribeShop = onSnapshot(shopRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setShopInfo(data);
        localStorage.setItem(getTenantStorageKey('playbox_shop_settings'), JSON.stringify(data));
      } else {
        const saved = localStorage.getItem(getTenantStorageKey('playbox_shop_settings'));
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
      localStorage.setItem(getTenantStorageKey('playbox_mock_units'), JSON.stringify(cloudUnits));
    }, (error) => {
      console.warn('Firestore units error:', error);
      const saved = localStorage.getItem(getTenantStorageKey('playbox_mock_units'));
      if (saved) setUnits(JSON.parse(saved));
    });

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === getTenantStorageKey('playbox_mock_bookings') && e.newValue) {
        setBookings(JSON.parse(e.newValue));
      }
      if (e.key === getTenantStorageKey('playbox_mock_units') && e.newValue) {
        setUnits(JSON.parse(e.newValue));
      }
      if (e.key === getTenantStorageKey('playbox_shop_settings') && e.newValue) {
        setShopInfo(JSON.parse(e.newValue));
      }
    };
    
    // Custom event to force sync in the SAME tab immediately
    const handleLocalSync = (e: CustomEvent) => {
      const { key, newValue } = e.detail;
      if (key === getTenantStorageKey('playbox_mock_bookings') && newValue) {
        setBookings(JSON.parse(newValue));
      }
      if (key === getTenantStorageKey('playbox_mock_units') && newValue) {
        setUnits(JSON.parse(newValue));
      }
      if (key === getTenantStorageKey('playbox_shop_settings') && newValue) {
        setShopInfo(JSON.parse(newValue));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-sync', handleLocalSync as EventListener);

    return () => {
      unsubscribeBookings();
      unsubscribeShop();
      unsubscribeUnits();
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-sync', handleLocalSync as EventListener);
    };
  }, []);

  const clearToast = () => setNewBookingToast(null);

  return (
    <FirebaseContext.Provider value={{ bookings, shopInfo, units, newBookingToast, clearToast, isLoading }}>
      {children}
    </FirebaseContext.Provider>
  );
}
