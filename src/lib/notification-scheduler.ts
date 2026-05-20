import admin from 'firebase-admin';
import { sendNotification as sendOneSignalNotification } from './onesignal-server';

// Note: This logic assumes admin is already initialized in server.ts
// We will use db from there or pass it in.

export async function rescheduleVehicleNotifications(
  userId: string, 
  vehicleId: string, 
  vehicleData: any,
  db: admin.firestore.Firestore
) {
  // Delete previous unsent notifications for this vehicle
  const scheduledRef = db.collection('scheduled_notifications');
  const snapshot = await scheduledRef
    .where('userId', '==', userId)
    .where('vehicleId', '==', vehicleId)
    .where('isSent', '==', false)
    .get();

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  const { currentKms, lastMaintenanceDate, lastMaintenanceKms, maintenanceFrequency, itvDueDate } = vehicleData;
  const now = new Date();

  const addScheduled = async (type: string, dueAt: Date, dueKm: number | null = null) => {
    await scheduledRef.add({
      userId,
      vehicleId,
      type,
      dueAt: admin.firestore.Timestamp.fromDate(dueAt),
      dueKm,
      isSent: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
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
}

export async function processDueNotifications(db: admin.firestore.Firestore) {
  try {
    const now = admin.firestore.Timestamp.now();
    const scheduledRef = db.collection('scheduled_notifications');
    
    // Log attempting to fetch
    console.log(`[NotificationScheduler] Checking for due notifications (DB: ${(db as any).databaseId || '(default)'})`);

    const snapshot = await scheduledRef
      .where('dueAt', '<=', now)
      .where('isSent', '==', false)
      .limit(20)
      .get();

    if (snapshot.empty) {
      console.log("[NotificationScheduler] No due notifications found.");
      return;
    }

    console.log(`[NotificationScheduler] Processing ${snapshot.size} notifications...`);
    
    for (const doc of snapshot.docs) {
      const notif = doc.data();
      const { userId, vehicleId, type, dueKm, dueAt } = notif;

    // Get user and vehicle data
    const [userDoc, vehicleDoc] = await Promise.all([
      db.collection('users').doc(userId).get(),
      db.collection('vehicles').doc(vehicleId).get()
    ]);

    if (!userDoc.exists || !vehicleDoc.exists) {
      await doc.ref.update({ isSent: true, error: 'User or vehicle not found' });
      continue;
    }

    const userData = userDoc.data()!;
    const vehicleData = vehicleDoc.data()!;

    let title = '';
    let message = '';

    switch (type) {
      case 'maintenance':
        title = '🔧 Revisión pendiente';
        message = `Tu ${vehicleData.brand} ${vehicleData.model} necesita una revisión. Km: ${dueKm || 'próximo'}.`;
        break;
      case 'itv':
        title = '🚗 ITV próxima';
        message = `La ITV de tu ${vehicleData.brand} ${vehicleData.model} vence pronto. ¡No olvides pasarla!`;
        break;
      case 'oil_change':
        title = '🛢️ Cambio de aceite';
        message = `Tu vehículo necesita un cambio de aceite pronto. Meta: ${dueKm} km.`;
        break;
      case 'tyre_change':
        title = '🚨 Neumáticos';
        message = `Es momento de revisar los neumáticos de tu ${vehicleData.brand} ${vehicleData.model}.`;
        break;
    }

    // 1. Add to User In-App Notifications
    await db.collection('users').doc(userId).collection('notifications').add({
      userId,
      title,
      message,
      type,
      relatedVehicleId: vehicleId,
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 2. Send OneSignal (Push + Email)
    await sendOneSignalNotification({
      userEmail: userData.email,
      userName: userData.fullName || 'Usuario',
      type: type as any,
      userId: userId,
      customData: {
        vehicle: { brand: vehicleData.brand, model: vehicleData.model },
        due_km: dueKm,
        due_date: (dueAt as admin.firestore.Timestamp).toDate().toLocaleDateString()
      }
    });

    // 3. Mark as sent
    await doc.ref.update({ isSent: true });
  }
} catch (error) {
  console.error("[NotificationScheduler] Error processing due notifications:", error);
  throw error;
}
}

export async function createWelcomeNotification(userId: string, userName: string, db: admin.firestore.Firestore) {
  await db.collection('users').doc(userId).collection('notifications').add({
    userId,
    title: '🦁 ¡Bienvenido a SIMVA!',
    message: `Hola ${userName}, tu león perezoso ya está listo. Registra tu vehículo para recibir recordatorios de mantenimiento, ITV, cambio de aceite y más.`,
    type: 'welcome',
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}
