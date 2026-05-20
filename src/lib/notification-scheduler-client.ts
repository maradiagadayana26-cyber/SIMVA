import { db } from './firebase';
import { collection, query, where, getDocs, writeBatch, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

export async function rescheduleVehicleNotificationsClient(
  userId: string, 
  vehicleId: string, 
  vehicleData: any
) {
  try {
    // 1. Delete previous unsent notifications for this vehicle
    const q = query(
      collection(db, 'scheduled_notifications'),
      where('userId', '==', userId),
      where('vehicleId', '==', vehicleId),
      where('isSent', '==', false)
    );
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();

    const { currentKms, lastMaintenanceDate, lastMaintenanceKms, maintenanceFrequency, itvDueDate } = vehicleData;
    const now = new Date();

    const addScheduled = async (type: string, dueAt: Date, dueKm: number | null = null) => {
      await addDoc(collection(db, 'scheduled_notifications'), {
        userId,
        vehicleId,
        type,
        dueAt: Timestamp.fromDate(dueAt),
        dueKm,
        isSent: false,
        createdAt: serverTimestamp()
      });
    };

    // 1. General Maintenance (based on frequency)
    if (maintenanceFrequency && currentKms) {
      const freq = parseInt(maintenanceFrequency.replace(/[^0-9]/g, '')) || 15000;
      const lastKm = lastMaintenanceKms || currentKms;
      const nextMaintenanceKm = lastKm + freq;
      
      if (nextMaintenanceKm <= currentKms + 1000) { // Notify 1000km before or if overdue
        await addScheduled('maintenance', now, nextMaintenanceKm);
      }
    }

    // 2. ITV
    if (itvDueDate) {
      const itvDate = new Date(itvDueDate);
      const notificationDate = new Date(itvDate);
      notificationDate.setDate(notificationDate.getDate() - 30); // Notify 30 days before

      if (notificationDate <= now) {
        await addScheduled('itv', now);
      } else {
        await addScheduled('itv', itvDate);
      }
    }

    // 3. Oil Change (Mock logic for this demonstration)
    const oilInterval = 10000;
    const nextOilKm = (lastMaintenanceKms || 0) + oilInterval;
    if (nextOilKm <= currentKms + 500) {
      await addScheduled('oil_change', now, nextOilKm);
    }

    // 4. Tyre Change (Mock logic)
    const tyreInterval = 40000;
    const nextTyreKm = (lastMaintenanceKms || 0) + tyreInterval;
    if (nextTyreKm <= currentKms + 1000) {
      await addScheduled('tyre_change', now, nextTyreKm);
    }
  } catch (error) {
    console.error("Error scheduling alerts client-side:", error);
  }
}
