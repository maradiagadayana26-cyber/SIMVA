import { Resend } from 'resend';

let resendInstance: Resend | null = null;

/**
 * Returns a lazy-initialized instance of the Resend client.
 * Returns null if RESEND_API_KEY is not defined to gracefully handle sandbox environments.
 */
export function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return null;
  }
  if (!resendInstance) {
    resendInstance = new Resend(key);
  }
  return resendInstance;
}

interface ResendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
}

/**
 * Sends an email using the Resend API with a graceful fallback to a log-simulation mode 
 * when the developer API key is not present.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text = '',
  fromName = 'SIMVA 🦁'
}: ResendMailOptions) {
  // Configured sender domain, or global EMAIL_FROM fallback, or default onboarding address provided by Resend
  const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || "onboarding@resend.dev";
  const resend = getResendClient();

  if (!resend) {
    console.warn(`[Resend Server Sandbox Mode] RESEND_API_KEY is missing in your environment.`);
    console.log(`[Resend Simulator Log Output]:
      TO: ${to}
      FROM: "${fromName}" <${fromEmail}>
      SUBJECT: ${subject}
      HTML PREVIEW:
      ${html.substring(0, 400)}
    `);
    return {
      success: true,
      messageId: `sandbox-resend-${Date.now()}`,
      sandbox: true,
      warning: "RESEND_API_KEY no configurado en .env. El correo ha sido simulado exitosamente en el panel y consola del servidor."
    };
  }

  try {
    const backupText = text || html.replace(/<[^>]*>/g, '');
    const { data, error } = await resend.emails.send({
      from: `"${fromName}" <${fromEmail}>`,
      to: [to],
      subject,
      html,
      text: backupText,
    });

    if (error) {
      console.error("❌ [Resend Error]:", error);
      return { success: false, error: error.message };
    }

    console.log(`✅ [Resend Success] Email delivered to ${to} successfully. ID: ${data?.id}`);
    return { success: true, messageId: data?.id };
  } catch (error: any) {
    console.error("❌ Exception during Resend engine execution:", error);
    return { success: false, error: error.message };
  }
}
