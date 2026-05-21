import { db, auth, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { generateEmailContent } from "@/src/services/geminiService";

export async function sendNotification(type: 'welcome' | 'maintenance', data: any) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    if (type === 'welcome') {
      const response = await fetch("/api/notify-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          email: user.email,
          fullName: data.fullName || user.displayName || "Usuario"
        })
      });
      return response.ok;
    } else if (type === 'maintenance') {
      const response = await fetch("/api/notify-maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          vehicleData: data,
          userEmail: user.email,
          userName: user.displayName || "Usuario"
        })
      });
      return response.ok;
    }

    return true;
  } catch (error) {
    console.error("Error dispatching notification:", error);
    return false;
  }
}

export async function updateEmailPreferences(enabled: boolean) {
  try {
    const user = auth.currentUser;
    if (!user) return false;

    const response = await fetch("/api/update-email-preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.uid,
        enabled
      })
    });
    return response.ok;
  } catch (error) {
    console.error("Error updating email preferences:", error);
    return false;
  }
}

export function checkMaintenanceAlert(vehicle: any) {
  if (!vehicle) return false;
  
  const freq = parseInt(vehicle.maintenanceFrequency) || 15000;
  const currentKms = vehicle.currentKms;
  const lastKms = vehicle.lastMaintenanceKms || 0;
  
  const kmsSinceLast = currentKms - lastKms;
  
  // Trigger alert if we are at 90% or more of the frequency
  return kmsSinceLast >= (freq * 0.9);
}

export async function sendTestNotification(userId: string, type: 'push' | 'email', userEmail?: string, userName?: string) {
  try {
    const response = await fetch("/api/send-test-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        type,
        userEmail,
        userName
      })
    });
    
    const data = await response.json();
    return { 
      success: response.ok && data.success !== false, 
      message: data.error || data.message, 
      warning: data.warning 
    };
  } catch (error: any) {
    console.error("Error dispatching test notification:", error);
    return { success: false, message: error.message || "Error de red al enviar notificación." };
  }
}
