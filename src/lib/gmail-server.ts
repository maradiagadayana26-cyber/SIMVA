import nodemailer from 'nodemailer';
import { google } from 'googleapis';

const OAuth2 = google.auth.OAuth2;

// Create transporter depending on method chosen
async function createTransporter() {
  const gmailUser = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD;
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  // Sandbox Mode fallback if not fully configured
  const isConfigured = gmailUser && (appPassword || (clientId && clientSecret && refreshToken));
  if (!isConfigured) {
    console.warn("[Gmail Server Sandbox] Gmail is not configured. Falling back to sandbox transporter simulation (Ethereal or dummy).");
    return null;
  }

  if (appPassword) {
    // Standard app password login
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: appPassword,
      },
    });
  } else {
    // OAuth2 authentication
    const oauth2Client = new OAuth2(
      clientId,
      clientSecret,
      'https://developers.google.com/oauthplayground'
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const accessToken = await oauth2Client.getAccessToken();

    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: gmailUser,
        clientId: clientId,
        clientSecret: clientSecret,
        refreshToken: refreshToken,
        accessToken: accessToken.token ?? undefined,
      },
    });
  }
}

export async function sendEmail({
  to,
  subject,
  html,
  text = ''
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const gmailUser = process.env.GMAIL_USER || "sandbox@simva.com";
  try {
    const transporter = await createTransporter();
    
    if (!transporter) {
      console.log(`[Gmail Server Simulator] Would send email:
        FROM: "SIMVA 🦁" <${gmailUser}>
        TO: ${to}
        SUBJECT: ${subject}
        CONTENT: ${html.substring(0, 300)}...
      `);
      return { 
        success: true, 
        messageId: `sandbox-gmail-${Date.now()}`,
        sandbox: true,
        warning: "Aviso SIMVA (Simulador): Las credenciales de Gmail (GMAIL_USER / GMAIL_APP_PASSWORD o OAuth2) no están totalmente configuradas en tu archivo .env. Hemos simulado el envío con éxito."
      };
    }

    const info = await transporter.sendMail({
      from: `"SIMVA 🦁" <${gmailUser}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });

    console.log(`✅ Email de Gmail enviado a ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('❌ Error enviando email con Gmail:', error);
    return { success: false, error: error.message };
  }
}
