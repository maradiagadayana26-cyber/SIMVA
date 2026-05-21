import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Helper to load fallback credentials if file exists
function getAppletConfig() {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch (_) {
      return null;
    }
  }
  return null;
}

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n')
      })
    });
  } else {
    // Fallback to applet config file
    const appletConfig = getAppletConfig();
    if (appletConfig && appletConfig.projectId) {
      console.log(`[Firebase Admin Service] Initializing with applet configuration for project: ${appletConfig.projectId}`);
      admin.initializeApp({
        projectId: appletConfig.projectId
      });
    } else {
      // Gentle initialization fallback for local sandbox environments
      console.log("[Firebase Admin Service] No credentials or applet configuration found, initializing empty/default admin app");
      admin.initializeApp();
    }
  }
}

export default admin;
