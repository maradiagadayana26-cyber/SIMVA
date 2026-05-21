import admin from 'firebase-admin';
import { sendNotification as sendOneSignalNotification } from './onesignal-server';
import { sendEmail as sendGmailEmail } from './gmail-server';
import { sendEmail as sendResendEmail } from './resend-server';

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
    const freq = typeof maintenanceFrequency === 'number' 
      ? maintenanceFrequency 
      : parseInt(maintenanceFrequency.replace(/[^0-9]/g, '')) || 15000;
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
          title = `Recordatorio de mantenimiento - Cambio de aceite para tu ${vehicleData.brand} ${vehicleData.model}`;
          message = `Estimado ${userData.fullName || userData.displayName || 'Usuario'}, tu vehículo ${vehicleData.brand} ${vehicleData.model} tiene actualmente ${vehicleData.currentKms || 0} km. El próximo cambio de aceite está programado para los ${dueKm || 0} km. Te recomendamos agendar la revisión para asegurar el óptimo funcionamiento del motor. ¡Gracias por confiar en SIMVA!`;
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

// Helper to safely fetch last notification time to prevent spamming
async function getLastAlertTime(userId: string, vehicleId: string, type: string, db: admin.firestore.Firestore): Promise<Date | null> {
  try {
    const snap = await db.collection('users').doc(userId).collection('notifications')
      .where('relatedVehicleId', '==', vehicleId)
      .where('type', '==', type)
      .get();
    if (snap.empty) return null;
    let maxDate = 0;
    snap.docs.forEach((doc) => {
      const data = doc.data();
      let dateVal = 0;
      if (data.createdAt) {
        if (data.createdAt.toDate) {
          dateVal = data.createdAt.toDate().getTime();
        } else {
          dateVal = new Date(data.createdAt).getTime();
        }
      }
      if (dateVal > maxDate) {
        maxDate = dateVal;
      }
    });
    return maxDate > 0 ? new Date(maxDate) : null;
  } catch (e) {
    console.warn("[getLastAlertTime fallback]", e);
    return null;
  }
}

// 1. Check & send maintenance alerts based on user-configured frequency
export async function checkMaintenanceAlerts(db: admin.firestore.Firestore) {
  console.log("[AlertService] Checking Maintenance Alerts...");
  try {
    const vehiclesSnap = await db.collection('vehicles').get();
    if (vehiclesSnap.empty) {
      console.log("[AlertService] No vehicles found for maintenance checks.");
      return;
    }

    for (const doc of vehiclesSnap.docs) {
      const v = doc.data();
      const vehicleId = doc.id;
      
      const { userId, brand, model, currentKms, lastMaintenanceKms, maintenanceFrequency } = v;
      if (!userId || currentKms === undefined || lastMaintenanceKms === undefined) continue;

      const freq = typeof maintenanceFrequency === 'number' 
        ? maintenanceFrequency 
        : parseInt(String(maintenanceFrequency || '').replace(/[^0-9]/g, '')) || 15000;

      const nextKm = (lastMaintenanceKms || 0) + freq;

      if (currentKms >= nextKm) {
        console.log(`[AlertService] Vehicle ${brand} ${model} (${vehicleId}) of user ${userId} exceeded maintenance: actual=${currentKms}, target=${nextKm}`);

        // Prevent spam: verify if alert already sent in the last 7 days
        const lastAlert = await getLastAlertTime(userId, vehicleId, 'maintenance', db);
        if (!lastAlert || (Date.now() - lastAlert.getTime()) > 7 * 24 * 60 * 60 * 1000) {
          // Fetch user details
          const userDoc = await db.collection('users').doc(userId).get();
          if (!userDoc.exists) continue;
          const userData = userDoc.data()!;
          const email = userData.email;
          const fullName = userData.fullName || userData.displayName || 'Usuario';

          if (!email) continue;

          const title = '🔧 Mantenimiento necesario';
          const message = `Tu ${brand} ${model} necesita revisión (${currentKms} km).`;

          // A. Store in App Notifications Subcollection
          await db.collection('users').doc(userId).collection('notifications').add({
            userId,
            title,
            message,
            type: 'maintenance',
            relatedVehicleId: vehicleId,
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // B. Send Email via Gmail
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px; background-color: #ffffff;">
              <h2 style="color: #F2B205; text-align: center; border-bottom: 2px solid #F2B205; padding-bottom: 10px;">🔧 Recordatorio de mantenimiento</h2>
              <p>Hola <strong>${fullName}</strong>,</p>
              <p>Tu vehículo <strong>${brand} ${model}</strong> necesita una revisión de mantenimiento.</p>
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <ul style="list-style-type: none; padding: 0; margin: 0;">
                  <li style="margin-bottom: 10px;">🚗 <strong>Vehículo:</strong> ${brand} ${model}</li>
                  <li style="margin-bottom: 10px;">📈 <strong>Kilómetros actuales:</strong> ${currentKms.toLocaleString()} km</li>
                  <li style="margin-bottom: 10px;">📅 <strong>Próximo mantenimiento programado:</strong> ${nextKm.toLocaleString()} km</li>
                </ul>
              </div>
              <p>Por favor, acude a un taller y actualiza los datos en SIMVA después de la revisión.</p>
              <p style="text-align: center; color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">
                🦁 El león perezoso de SIMVA cuida de tu coche.
              </p>
            </div>
          `;

          await sendGmailEmail({
            to: email,
            subject: '🔧 Recordatorio de mantenimiento SIMVA',
            html: emailHtml
          });

          // C. Also notify OneSignal
          await sendOneSignalNotification({
            userEmail: email,
            userName: fullName,
            type: 'maintenance',
            userId: userId,
            customData: {
              vehicle: { brand, model },
              due_km: nextKm,
              due_date: new Date().toLocaleDateString()
            }
          }).catch(err => console.warn("[OneSignal error in checkMaintenanceAlerts]", err));
        }
      }
    }
  } catch (error) {
    console.error("[AlertService] Error checking maintenance alerts:", error);
  }
}

// 2. Check & send ITV alerts based on remaining days (30, 15, 7, 3, 1)
export async function checkItvAlerts(db: admin.firestore.Firestore) {
  console.log("[AlertService] Checking ITV Alerts...");
  try {
    const vehiclesSnap = await db.collection('vehicles').get();
    if (vehiclesSnap.empty) {
      console.log("[AlertService] No vehicles found for ITV checks.");
      return;
    }

    for (const doc of vehiclesSnap.docs) {
      const v = doc.data();
      const vehicleId = doc.id;

      const { userId, brand, model, itvDueDate } = v;
      if (!userId || !itvDueDate) continue;

      const dueDate = new Date(itvDueDate);
      const today = new Date();
      today.setHours(0,0,0,0);
      dueDate.setHours(0,0,0,0);

      const diffTime = dueDate.getTime() - today.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const alertDays = [30, 15, 7, 3, 1];

      if (alertDays.includes(daysLeft)) {
        console.log(`[AlertService] Vehicle ${brand} ${model} (${vehicleId}) has ITV in ${daysLeft} days.`);

        // Prevent spam: check if already notified today or recently (within 20 hours)
        const lastItvAlert = await getLastAlertTime(userId, vehicleId, 'itv', db);
        const alreadySentToday = lastItvAlert && (Date.now() - lastItvAlert.getTime() < 20 * 60 * 60 * 1000);

        if (!alreadySentToday) {
          // Fetch user details
          const userDoc = await db.collection('users').doc(userId).get();
          if (!userDoc.exists) continue;
          const userData = userDoc.data()!;
          const email = userData.email;
          const fullName = userData.fullName || userData.displayName || 'Usuario';

          if (!email) continue;

          const title = '🚗 ITV próxima';
          const message = `La ITV de tu ${brand} ${model} vence el ${dueDate.toLocaleDateString()} (dentro de ${daysLeft} días).`;

          // A. Store in App Notifications Subcollection
          await db.collection('users').doc(userId).collection('notifications').add({
            userId,
            title,
            message,
            type: 'itv',
            relatedVehicleId: vehicleId,
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // B. Send Email via Gmail
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px; background-color: #ffffff;">
              <h2 style="color: #F2B205; text-align: center; border-bottom: 2px solid #F2B205; padding-bottom: 10px;">🚗 Tu ITV está próxima</h2>
              <p>Hola <strong>${fullName}</strong>,</p>
              <p>La ITV de tu vehículo <strong>${brand} ${model}</strong> vence muy pronto.</p>
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <ul style="list-style-type: none; padding: 0; margin: 0;">
                  <li style="margin-bottom: 10px;">🚗 <strong>Vehículo:</strong> ${brand} ${model}</li>
                  <li style="margin-bottom: 10px;">📅 <strong>Fecha de vencimiento:</strong> ${dueDate.toLocaleDateString()}</li>
                  <li style="margin-bottom: 10px;">⏳ <strong>Días restantes:</strong> <span style="color: #ff3333; font-weight: bold;">${daysLeft} días</span></li>
                </ul>
              </div>
              <p>No olvides pasar la inspección reglamentaria de ITV a tiempo para poder circular de forma segura y legal.</p>
              <p style="text-align: center; color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">
                🦁 SIMVA te recuerda mantener tu vehículo en perfectas condiciones.
              </p>
            </div>
          `;

          await sendGmailEmail({
            to: email,
            subject: '📅 Recordatorio de ITV - SIMVA',
            html: emailHtml
          });

          // C. Also notify OneSignal
          await sendOneSignalNotification({
            userEmail: email,
            userName: fullName,
            type: 'itv',
            userId: userId,
            customData: {
              vehicle: { brand, model },
              due_date: dueDate.toLocaleDateString(),
              days_left: daysLeft
            }
          }).catch(err => console.warn("[OneSignal error in checkItvAlerts]", err));
        }
      }
    }
  } catch (error) {
    console.error("[AlertService] Error checking ITV alerts:", error);
  }
}

// 1. Función para enviar notificación push (OneSignal)
export async function sendOilChangePush(
  userId: string,
  userName: string,
  userEmail: string,
  vehicle: string,
  currentKm: number,
  nextKm: number
) {
  try {
    await sendOneSignalNotification({
      userEmail,
      userName,
      type: 'oil_change' as any,
      userId,
      customData: {
        contents: `🔧 ${userName}, tu ${vehicle} necesita cambio de aceite. Actualmente ${currentKm} km, próximo a ${nextKm} km. Agenda tu revisión.`,
        headings: 'Recordatorio de mantenimiento - Cambio de aceite'
      }
    });
    return { success: true };
  } catch (error: any) {
    console.error('Error enviando push de cambio de aceite:', error);
    return { success: false, error: error.message };
  }
}

// 2. Función para enviar email (exactamente el texto solicitado)
export async function sendOilChangeEmail(
  userEmail: string,
  userName: string,
  vehicle: string,
  currentKm: number,
  nextKm: number
) {
  const subject = `Recordatorio de mantenimiento - Cambio de aceite para tu ${vehicle}`;
  const text = `Estimado ${userName},\n\nTu vehículo ${vehicle} tiene actualmente ${currentKm} km. El próximo cambio de aceite está programado para los ${nextKm} km.\n\nTe recomendamos agendar la revisión para asegurar el óptimo funcionamiento del motor.\n\n¡Gracias por confiar en SIMVA!\n\nAtentamente,\nEquipo SIMVA 🦁`;
  const html = `<p>Estimado ${userName},</p>
         <p>Tu vehículo <strong>${vehicle}</strong> tiene actualmente <strong>${currentKm} km</strong>. El próximo cambio de aceite está programado para los <strong>${nextKm} km</strong>.</p>
         <p>Te recomendamos agendar la revisión para asegurar el óptimo funcionamiento del motor.</p>
         <p>¡Gracias por confiar en SIMVA!</p>
         <p>Atentamente,<br>Equipo SIMVA 🦁</p>`;

  try {
    const result = await sendResendEmail({
      to: userEmail,
      subject,
      html,
      text
    });
    return result;
  } catch (error: any) {
    console.error('Error enviando email de cambio de aceite:', error);
    return { success: false, error: error.message };
  }
}

// 3. Función para guardar notificación en la base de datos (sección de avisos de la app)
export async function saveInAppNotification(
  userId: string,
  userName: string,
  vehicleId: string,
  vehicle: string,
  currentKm: number,
  nextKm: number,
  db: admin.firestore.Firestore
) {
  try {
    await db.collection('users').doc(userId).collection('notifications').add({
      userId,
      title: `Recordatorio de mantenimiento - Cambio de aceite para tu ${vehicle}`,
      message: `Estimado ${userName}, tu vehículo ${vehicle} tiene actualmente ${currentKm} km. El próximo cambio de aceite está programado para los ${nextKm} km. Te recomendamos agendar la revisión para asegurar el óptimo funcionamiento del motor. ¡Gracias por confiar en SIMVA!`,
      type: 'oil_change',
      relatedVehicleId: vehicleId,
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (error: any) {
    console.error('Error guardando notificación de cambio de aceite:', error);
    return { success: false, error: error.message };
  }
}

// 4. Función principal que se ejecuta cuando se detecta que el vehículo está cerca del mantenimiento
export async function sendOilChangeReminders(
  userId: string,
  userName: string,
  userEmail: string,
  vehicleId: string,
  vehicle: string,
  currentKm: number,
  nextKm: number,
  db: admin.firestore.Firestore
) {
  try {
    // Llamar a los tres métodos en paralelo
    await Promise.all([
      sendOilChangePush(userId, userName, userEmail, vehicle, currentKm, nextKm),
      sendOilChangeEmail(userEmail, userName, vehicle, currentKm, nextKm),
      saveInAppNotification(userId, userName, vehicleId, vehicle, currentKm, nextKm, db)
    ]);
    console.log(`Recordatorios de cambio de aceite enviados a ${userEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Error enviando recordatorios:', error);
    return { success: false, error };
  }
}

// Job function to check all vehicles for Oil Change alerts
export async function checkOilChangeAlerts(db: admin.firestore.Firestore) {
  console.log("[AlertService] Checking Oil Change Alerts...");
  try {
    const vehiclesSnap = await db.collection('vehicles').get();
    if (vehiclesSnap.empty) {
      console.log("[AlertService] No vehicles found for oil change checks.");
      return;
    }

    for (const doc of vehiclesSnap.docs) {
      const v = doc.data();
      const vehicleId = doc.id;

      const { userId, brand, model, currentKms, lastMaintenanceKms } = v;
      if (!userId || currentKms === undefined) continue;

      const vehicleName = `${brand} ${model}`;
      // Oil interval is 10000 km
      const nextOilKm = (lastMaintenanceKms || 0) + 10000;

      // Notify when currentKms is greater or equal to target next oil change km, or when it is close (under 500 km remaining)
      if (currentKms >= (nextOilKm - 500)) {
        // Prevent spamming active oil alerts (within 7 days)
        const lastAlert = await getLastAlertTime(userId, vehicleId, 'oil_change', db);
        if (!lastAlert || (Date.now() - lastAlert.getTime()) > 7 * 24 * 60 * 60 * 1000) {
          // Fetch user details
          const userDoc = await db.collection('users').doc(userId).get();
          if (!userDoc.exists) continue;
          const userData = userDoc.data()!;
          const email = userData.email;
          const fullName = userData.fullName || userData.displayName || 'Usuario';

          if (!email) continue;

          console.log(`[AlertService] Discharging oil change alerts for ${vehicleName} (user: ${fullName})`);
          await sendOilChangeReminders(userId, fullName, email, vehicleId, vehicleName, currentKms, nextOilKm, db);
        }
      }
    }
  } catch (error) {
    console.error("[AlertService] Error checking oil change alerts:", error);
  }
}
