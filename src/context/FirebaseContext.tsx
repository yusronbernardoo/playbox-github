'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

interface Booking {
  id: string;
  [key: string]: any;
}

interface FirebaseContextType {
  bookings: Booking[];
  newBookingToast: Booking | null;
  clearToast: () => void;
  isLoading: boolean;
}

const FirebaseContext = createContext<FirebaseContextType>({
  bookings: [],
  newBookingToast: null,
  clearToast: () => {},
  isLoading: true,
});

export const useFirebase = () => useContext(FirebaseContext);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [newBookingToast, setNewBookingToast] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialLoadRef = useRef(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'bookings'), (snapshot) => {
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

    return () => unsubscribe();
  }, []);

  const clearToast = () => setNewBookingToast(null);

  return (
    <FirebaseContext.Provider value={{ bookings, newBookingToast, clearToast, isLoading }}>
      {children}
    </FirebaseContext.Provider>
  );
}
