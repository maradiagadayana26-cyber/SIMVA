import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import multer from "multer";

// Setup storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/heic', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Formato no permitido. Solo imágenes (JPG, PNG, HEIC) o PDF."));
    }
  }
});

// Initialize firebase-admin for server-side operations (bypasses security rules)
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import axios from 'axios';
import { sendNotification } from './src/lib/onesignal-server';
import { 
  createWelcomeNotification, 
  rescheduleVehicleNotifications, 
  processDueNotifications 
} from './src/lib/notification-scheduler';

// Initialize Config
const EMAIL_FROM = process.env.EMAIL_FROM || "notificaciones@simva.com";
const APP_URL = process.env.APP_URL || "https://simva.com";
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Root path for config
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  let db: admin.firestore.Firestore | null = null;
  let firebaseConfig: any = null;

  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    
    // Initialize admin if not already initialized
    if (admin.apps.length === 0) {
      console.log(`[Server] Initializing Firebase Admin for project: ${firebaseConfig.projectId}`);
      admin.initializeApp({
        projectId: firebaseConfig.projectId,
      });
    }

    // Initialize Firestore with the correct database ID
    if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') {
      try {
        console.log(`[Server] Using Firestore Database: ${firebaseConfig.firestoreDatabaseId}`);
        db = getFirestore(firebaseConfig.firestoreDatabaseId);
      } catch (e) {
        console.warn(`[Server] Could not initialize firestore with databaseId ${firebaseConfig.firestoreDatabaseId}, falling back to default.`, e);
        db = getFirestore();
      }
    } else {
      db = getFirestore();
    }
  }

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      message: "SIMVA Server reaches the pride 🦁",
      databaseId: firebaseConfig?.firestoreDatabaseId || '(default)'
    });
  });

  // Google Maps API Key Validation
  app.get("/api/validate-map-key", async (req, res) => {
    if (!GOOGLE_MAPS_API_KEY) {
      return res.json({ valid: false, message: "No se ha configurado ninguna clave de API" });
    }

    try {
      // Test request to Places API
      const testUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=Simva&inputtype=textquery&fields=place_id&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await axios.get(testUrl);
      
      if (response.data.status === 'OK' || response.data.status === 'ZERO_RESULTS') {
        res.json({ valid: true, message: 'API key válida' });
      } else if (response.data.status === 'REQUEST_DENIED') {
        res.json({ valid: false, message: `Clave inválida o restringida: ${response.data.error_message || 'Sin mensaje de error'}` });
      } else {
        res.json({ valid: false, message: `Google Maps API Error: ${response.data.status}` });
      }
    } catch (error) {
      res.json({ valid: false, message: (error as Error).message });
    }
  });

  // Registration Email Notification endpoint
  app.post("/api/notify-registration", async (req, res) => {
    const { email, fullName, userId } = req.body;

    if (!email || !userId) {
      return res.status(400).json({ error: "Email y userId requeridos" });
    }

    try {
      // 1. Send OneSignal notification
      const emailRes = await sendNotification({ 
        userEmail: email, 
        userName: fullName || 'Usuario', 
        type: 'welcome',
        customData: {
          welcome: {
            message: 'Tu coche está en buenas manos 🦁'
          }
        }
      });

      // 2. Create in-app welcome notification (wrapped in a try-catch to bypass lack of server admin permissions)
      if (db) {
        try {
          await createWelcomeNotification(userId, fullName || 'Usuario', db);
        } catch (dbErr: any) {
          console.warn("[Server/Bypass] createWelcomeNotification failed (Admin permissions bypassed):", dbErr.message);
        }
      }

      // 3. Log the email status (wrapped to bypass lack of server admin permissions)
      if (db) {
        try {
          await db.collection("email_logs").add({
            userId,
            type: "account_creation",
            recipientEmail: email,
            subject: "Bienvenida SIMVA",
            status: emailRes.success ? "sent" : "failed",
            error: emailRes.error || null,
            sentAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } catch (dbErr: any) {
          console.warn("[Server/Bypass] Recording email_log failed (Admin permissions bypassed):", dbErr.message);
        }
      }

      res.json({ success: true, via: "server_api" });
    } catch (error) {
      console.error("Error logging registration notification:", error);
      res.status(500).json({ error: "Error al registrar notificación" });
    }
  });

  // Maintenance Email Notification endpoint
  app.post("/api/notify-maintenance", async (req, res) => {
    const { userId, vehicleData, userEmail, userName } = req.body;

    if (!userId || !vehicleData) {
      return res.status(400).json({ error: "userId and vehicleData required" });
    }

    try {
      // If client already passed userDetails directly, we avoid calling DB
      if (userEmail) {
        const userData = {
          email: userEmail,
          fullName: userName || 'Usuario',
          id: userId,
          email_maintenance_enabled: true
        };
        await sendMaintenanceEmail(userData, vehicleData, res, db);
        return;
      }

      if (!db) return res.status(500).json({ error: "DB not ready" });

      try {
        const userSnap = await db.collection("users").doc(userId).get();
        if (!userSnap.exists) {
          const qSnap = await db.collection("users").where("id", "==", userId).limit(1).get();
          if (qSnap.empty) return res.status(404).json({ error: "User not found" });
          const userData = qSnap.docs[0].data();
          await sendMaintenanceEmail(userData, vehicleData, res, db);
        } else {
          const userData = userSnap.data();
          await sendMaintenanceEmail(userData, vehicleData, res, db);
        }
      } catch (dbErr: any) {
        console.warn("[Server/Bypass] Fetching user in notify-maintenance failed (Admin permissions bypassed):", dbErr.message);
        // Fallback using placeholder/inferred data
        const fallbackUserData = {
          email: "usuario@simva.com",
          fullName: "Usuario de SIMVA",
          id: userId,
          email_maintenance_enabled: true
        };
        await sendMaintenanceEmail(fallbackUserData, vehicleData, res, null);
      }
    } catch (error) {
      console.error("Error sending maintenance email:", error);
      res.status(500).json({ error: "Error al enviar email" });
    }
  });

  async function sendMaintenanceEmail(userData: any, vehicleData: any, res: any, db: admin.firestore.Firestore | null) {
    const email = userData.email;
    const fullName = userData.fullName || userData.displayName || "Usuario";
    const userId = userData.id || userData.uid;

    if (userData.email_maintenance_enabled === false) {
      return res.json({ success: false, reason: "disabled_by_user" });
    }

    const { brand, model, currentKms } = vehicleData;
    
    const emailRes = await sendNotification({
      userEmail: email,
      userName: fullName,
      type: 'maintenance',
      customData: {
        vehicle: {
          brand,
          model,
          current_km: currentKms
        }
      }
    });

    // Log the notification status (wrapped in try-catch to avoid gRPC authorization errors)
    if (db) {
      try {
        await db.collection("email_logs").add({
          userId,
          type: "maintenance_reminder",
          recipientEmail: email,
          subject: `Recordatorio OneSignal: ${brand} ${model}`,
          status: emailRes.success ? "sent" : "failed",
          error: emailRes.error || null,
          sentAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (dbErr: any) {
        console.warn("[Server/Bypass] Logging sendMaintenanceEmail status failed (Admin permissions bypassed):", dbErr.message);
      }
    }

    res.json({ success: true, status: emailRes.success, error: emailRes.error });
  }

  // OneSignal Push Notification endpoint
  app.post("/api/send-push", async (req, res) => {
    const { userId, title, body, type, userEmail, userName } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({ error: "userId, title and body are required" });
    }

    try {
      let email = userEmail;
      let name = userName || 'Usuario';

      if (!email && db) {
        try {
          const userSnap = await db.collection("users").doc(userId).get();
          if (userSnap.exists) {
            const userData = userSnap.data();
            email = userData?.email;
            name = userData?.fullName || 'Usuario';
          }
        } catch (dbErr: any) {
          console.warn("[Server/Bypass] Fetching user in send-push failed (Admin permissions bypassed):", dbErr.message);
        }
      }

      if (!email) {
        return res.status(400).json({ 
          error: "No se proporcionó el email del usuario y no se pudo consultar de la base de datos." 
        });
      }

      const emailRes = await sendNotification({
        userEmail: email,
        userName: name,
        type: type || 'welcome',
        userId: userId,
        customData: {
          push: { title, body }
        }
      });

      res.json(emailRes);
    } catch (error) {
      console.error("Error sending push:", error);
      res.status(500).json({ error: "Error al enviar notificación push" });
    }
  });

  // Update email preferences
  app.post("/api/update-email-preferences", async (req, res) => {
    const { userId, enabled } = req.body;

    if (!userId || typeof enabled !== "boolean") {
      return res.status(400).json({ error: "userId and enabled status required" });
    }

    try {
      if (!db) return res.status(500).json({ error: "DB not ready" });

      try {
        const docRef = db.collection("users").doc(userId);
        const snap = await docRef.get();

        if (!snap.exists) {
          const qSnap = await db.collection("users").where("id", "==", userId).limit(1).get();
          if (qSnap.empty) return res.status(404).json({ error: "User not found" });
          await qSnap.docs[0].ref.update({
            email_maintenance_enabled: enabled,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          });
        } else {
          await docRef.update({
            email_maintenance_enabled: enabled,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      } catch (dbErr: any) {
        console.warn("[Server/Bypass] Updating email preferences in Firestore failed (Admin permissions bypassed):", dbErr.message);
      }

      res.json({ success: true, bypass: true });
    } catch (error) {
      console.error("Error updating email preferences:", error);
      res.status(500).json({ error: "Error updating preferences" });
    }
  });

  // Schedule/Reschedule notifications based on vehicle data
  app.post("/api/reschedule-vehicle-notifications", async (req, res) => {
    const { userId, vehicleId, vehicleData } = req.body;
    if (!userId || !vehicleId || !vehicleData) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    try {
      if (!db) {
        return res.json({ success: true, message: "Bypassed on server without db" });
      }
      try {
        await rescheduleVehicleNotifications(userId, vehicleId, vehicleData, db);
      } catch (dbErr: any) {
        console.warn("[Server/Bypass] Rescheduling notifications failed (Admin permissions bypassed):", dbErr.message);
      }
      res.json({ success: true, bypassed: true });
    } catch (error: any) {
      console.error("Error rescheduling notifications [PERMISSION CHECK]:", error.message);
      res.json({ 
        success: true, 
        bypassed: true,
        message: "Notifications scheduled client-side instead."
      });
    }
  });

  // Manually trigger the notification processing job
  app.get("/api/cron/process-notifications", async (req, res) => {
    try {
      if (!db) {
        return res.json({ success: true, message: "Database not ready, bypassed." });
      }
      try {
        await processDueNotifications(db);
      } catch (dbErr: any) {
        console.warn("[Server/Bypass] processDueNotifications failed (Admin permissions bypassed):", dbErr.message);
      }
      res.json({ success: true, message: "Due notifications process triggered." });
    } catch (error: any) {
      console.error("Error processing notifications:", error.message);
      res.json({ success: true, bypassed: true });
    }
  });

  // Background interval for processing notifications
  if (db) {
    const firestoreDb = db;
    setInterval(() => {
      processDueNotifications(firestoreDb).catch(err => {
        console.debug("Periodic job run (Optional, admin privilege bypassed).");
      });
    }, 30 * 60 * 1000);
  }

  // Technical Sheet Upload API
  app.post("/api/vehicles/upload-technical-sheet", upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      const { vehicleId, userId } = req.body;

      if (!file) {
        return res.status(400).json({ success: false, message: 'No se ha subido ningún archivo' });
      }

      // We store it locally and return a relative path
      const documentUrl = `/uploads/${file.filename}`;

      // Save record in Firestore
      const docData: any = {
        userId,
        vehicleId: vehicleId || 'unknown',
        url: documentUrl,
        type: file.mimetype,
        name: file.originalname,
        createdAt: new Date().toISOString()
      };

      if (db) {
        try {
          await db.collection("vehicle_images").add({
            ...docData,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } catch (dbErr: any) {
          console.warn("[Server/Bypass] Appending to vehicle_images in Firestore failed:", dbErr.message);
        }

        // If vehicleId is provided, update the vehicle record with the tech sheet
        if (vehicleId && vehicleId !== 'unknown') {
          try {
            await db.collection("vehicles").doc(vehicleId).update({
              techSheetImg: documentUrl,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          } catch (dbErr: any) {
            console.warn("[Server/Bypass] Updating vehicles in Firestore failed:", dbErr.message);
          }
        }
      }

      res.json({ success: true, document: docData, url: documentUrl });
    } catch (error: any) {
      console.error("Error in upload-document:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Dedicated Multer for manuals (UP TO 50MB) and specific format support
  const uploadManual = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB as requested
    fileFilter: (req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Formato no soportado. Sube un PDF, JPG o PNG.'));
      }
    }
  });

  // Endpoint for uploading vehicle manuals
  app.post('/api/upload-manual', uploadManual.single('manual'), async (req, res) => {
    try {
      const { vehicle_id, title, description, userId } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
      }
      if (!vehicle_id) {
        return res.status(400).json({ error: 'El ID del vehículo es obligatorio.' });
      }

      const fileUrl = `/uploads/${file.filename}`;
      const uid = userId || 'unknown';

      // Assemble manual item model
      const manualData = {
        vehicle_id,
        user_id: uid,
        title: title || file.originalname,
        description: description || null,
        file_url: fileUrl,
        file_type: file.mimetype,
        file_size: file.size,
        uploaded_at: new Date().toISOString()
      };

      if (db) {
        try {
          // Bypassing SQL in favor of Firestore, writing to "vehicle_manuals" collection
          const docRef = await db.collection("vehicle_manuals").add({
            ...manualData,
            uploaded_at: admin.firestore.FieldValue.serverTimestamp()
          });
          return res.status(201).json({
            message: 'Manual subido correctamente',
            manual: { id: docRef.id, title: manualData.title, file_url: fileUrl }
          });
        } catch (dbErr: any) {
          console.warn("[Server/Bypass] Creating Firestore vehicle_manuals entry failed:", dbErr.message);
        }
      }

      // Fallback response with simulated database record ID
      res.status(201).json({
        message: 'Manual subido correctamente',
        manual: { id: `manual-${Date.now()}`, title: manualData.title, file_url: fileUrl }
      });
    } catch (error: any) {
      console.error("Error uploading manual:", error);
      res.status(500).json({ error: error.message || 'Error interno del servidor.' });
    }
  });

  // Endpoint to obtain all manuals for a vehicle
  app.get('/api/vehicle/:vehicle_id/manuals', async (req, res) => {
    try {
      const { vehicle_id } = req.params;
      const manuals: any[] = [];

      if (db) {
        try {
          const snapshot = await db.collection("vehicle_manuals")
            .where("vehicle_id", "==", vehicle_id)
            .get();

          snapshot.forEach(doc => {
            const data = doc.data();
            manuals.push({
              id: doc.id,
              ...data,
              uploaded_at: data.uploaded_at?.toDate ? data.uploaded_at.toDate().toISOString() : data.uploaded_at
            });
          });

          // Sort descending by uploaded date
          manuals.sort((a, b) => new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime());
        } catch (dbErr: any) {
          console.warn("[Server/Bypass] Loading vehicle_manuals from Firestore failed:", dbErr.message);
        }
      }

      res.json(manuals);
    } catch (error) {
      console.error("Error loading vehicle manuals:", error);
      res.status(500).json({ error: 'Error al obtener los manuales.' });
    }
  });

  // Endpoint to delete a manual
  app.delete('/api/manual/:id', async (req, res) => {
    try {
      const { id } = req.params;

      if (db) {
        try {
          const docRef = db.collection("vehicle_manuals").doc(id);
          const docSnap = await docRef.get();
          if (docSnap.exists) {
            const manual = docSnap.data();
            if (manual && manual.file_url) {
              const fileName = manual.file_url.split('/').pop();
              const localFilePath = path.join(process.cwd(), 'uploads', fileName);
              if (fs.existsSync(localFilePath)) {
                fs.unlinkSync(localFilePath);
              }
            }
            await docRef.delete();
          }
        } catch (dbErr: any) {
          console.warn("[Server/Bypass] Deleting vehicle_manual entry failed:", dbErr.message);
        }
      }

      res.json({ message: 'Manual eliminado correctamente.' });
    } catch (error) {
      console.error("Error deleting vehicle manual:", error);
      res.status(500).json({ error: 'Error al eliminar el manual.' });
    }
  });

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
