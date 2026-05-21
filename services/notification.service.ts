import { resend } from '@/lib/resend';
import admin from '@/lib/firebase';

export async function sendEmail(to: string, subject: string, html: string) {
  return await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'Car Maintenance <noreply@tuapp.com>',
    to,
    subject,
    html
  });
}

export async function sendPushNotification(
  token: string,
  title: string,
  body: string
) {
  try {
    const response = await admin.messaging().send({
      token,
      notification: {
        title,
        body
      }
    });
    console.log("Push notification sent successfully:", response);
    return response;
  } catch (error: any) {
    if (error?.message?.includes("credential") || error?.message?.includes("key") || error?.message?.includes("not initialized")) {
      console.warn("[Firebase Admin Messaging Sandbox Mode]: Push notification simulated due to invalid or missing credentials:", { token, title, body });
      return { id: `mock-push-${Date.now()}` };
    }
    console.error("Error sending push notification:", error);
    throw error;
  }
}
