import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface NotificationContextType {
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "notifications"),
      where("isRead", "==", false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/notifications`);
    });

    return unsubscribe;
  }, [user]);

  return (
    <NotificationContext.Provider value={{ unreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
