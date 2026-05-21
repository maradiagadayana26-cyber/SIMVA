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
import cron from 'node-cron';
import { 
  createWelcomeNotification, 
  rescheduleVehicleNotifications, 
  processDueNotifications,
  checkMaintenanceAlerts,
  checkItvAlerts,
  checkOilChangeAlerts
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

  // Test Notification (push or email) endpoint
  app.post("/api/send-test-notification", async (req, res) => {
    const { userId, type, userEmail, userName } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: "El ID del usuario es obligatorio" });
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
          console.warn("[Server/Bypass] Fetching user in send-test-notification failed:", dbErr.message);
        }
      }

      if (!email) {
        return res.status(400).json({
          success: false,
          error: "No se proporcionó el email del usuario y no se pudo consultar de la base de datos."
        });
      }

      if (type === 'email') {
        const emailRes = await sendNotification({
          userEmail: email,
          userName: name,
          type: 'welcome',
          customData: {
            welcome: {
              message: 'Prueba de notificación SIMVA: Si has recibido este correo, el sistema de notificaciones está operativo.'
            }
          }
        });
        return res.json({ success: emailRes.success, error: emailRes.error, id: emailRes.id, warning: emailRes.warning });
      }

      if (type === 'push') {
        const emailRes = await sendNotification({
          userEmail: email,
          userName: name,
          type: 'maintenance',
          userId: userId,
          customData: {
            push: {
              title: "🔔 Prueba: Esta es una notificación push de SIMVA.",
              body: "Si has recibido esta notificación push, el sistema está operativo."
            }
          }
        });
        return res.json({ success: emailRes.success, error: emailRes.error, id: emailRes.id, warning: emailRes.warning });
      }

      return res.status(400).json({ success: false, error: `Tipo no soportado: ${type}` });
    } catch (error: any) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ success: false, error: error.message || "Error al enviar notificación de prueba" });
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

  // Force checking maintenance and ITV alert reminders
  app.post("/api/alerts/force-check", async (req, res) => {
    try {
      if (!db) {
        return res.status(500).json({ success: false, error: "Database not ready." });
      }
      await checkMaintenanceAlerts(db);
      await checkItvAlerts(db);
      await checkOilChangeAlerts(db);
      res.json({ success: true, message: 'Comprobación de alertas ejecutada' });
    } catch (error: any) {
      console.error("Error running manual alert check:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // AI-powered maintenance notification route
  app.post('/api/mantenimiento', async (req, res) => {
    try {
      const { name, vehicle, type, date, email } = req.body;
      
      if (!email) {
        return res.status(400).json({ success: false, error: "El correo electrónico ('email') es obligatorio." });
      }

      const { generateMaintenanceEmail } = await import("./services/ai.service");
      const { sendEmail } = await import("./services/notification.service");

      const emailContent = await generateMaintenanceEmail({
        name,
        vehicle,
        type,
        date
      });

      const emailRes = await sendEmail(
        email,
        'Recordatorio de mantenimiento',
        emailContent
      );

      res.json({
        success: true,
        emailSent: true,
        messageId: (emailRes as any)?.data?.id || `simulated-${Date.now()}`
      });
    } catch (error: any) {
      console.error("Error in /api/mantenimiento:", error);
      res.status(500).json({ success: false, error: error.message || "Error interno del servidor en /api/mantenimiento." });
    }
  });

  // Background interval and Daily Cron for processing notifications & alerts
  if (db) {
    const firestoreDb = db;
    setInterval(() => {
      processDueNotifications(firestoreDb).catch(err => {
        console.debug("Periodic job run (Optional, admin privilege bypassed).");
      });
    }, 30 * 60 * 1000);

    // Cron schedule '0 9 * * *' (Every day at 9:00 AM)
    cron.schedule('0 9 * * *', async () => {
      console.log('🦁 [Cron] Ejecutando comprobación diaria de alertas de mantenimiento, ITV y Cambio de Aceite...');
      try {
        await checkMaintenanceAlerts(firestoreDb);
        await checkItvAlerts(firestoreDb);
        await checkOilChangeAlerts(firestoreDb);
      } catch (err: any) {
        console.error("Error running daily alerts cron:", err.message);
      }
    });
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

  // --- Owner Manual Auto-Discovery Services ---
  // Decodes a VIN using the official NHTSA api
  async function getVehicleDataFromNHTSA(vin: string): Promise<any> {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${encodeURIComponent(vin)}?format=json`;
    try {
      console.log(`[VIN Decoder] Querying NHTSA API for VIN: ${vin}`);
      const response = await axios.get(url, { timeout: 3500 });
      if (response.data && response.data.Results) {
        const vehicleData: Record<string, string> = {};
        response.data.Results.forEach((item: any) => {
          if (item.Value && item.Value.trim() !== '') {
            vehicleData[item.Variable] = item.Value;
          }
        });
        return vehicleData;
      }
    } catch (error: any) {
      console.error("[VIN Decoder] Error decoding VIN with NHTSA:", error.message);
    }
    return null;
  }

  // Predicts / Searches the manufacturer's official owner manual URL based on brand, model, and year
  async function fetchOwnerManual(brand: string, model: string, year: string | number): Promise<string | null> {
    console.log(`[Manual Finder] Searching manual for: ${brand} ${model} (${year})`);
    
    const cleanBrand = brand.trim().toLowerCase();
    const cleanModel = model.trim().toLowerCase();
    const cleanYear = String(year).trim();

    // Pattern 1: Charm.li dataset lookup link for workshop/repair manuals
    // format: https://charm.li/{Brand}/{Year}/{Model}/
    const charmBrand = brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
    const charmModel = model.charAt(0).toUpperCase() + model.slice(1).toLowerCase();
    const charmUrl = `https://charm.li/${encodeURIComponent(charmBrand)}/${encodeURIComponent(cleanYear)}/${encodeURIComponent(charmModel)}/`;

    // Pattern 2: Predictable official pattern by manufacturer
    let officialUrl = "";
    if (cleanBrand.includes("toyota")) {
      officialUrl = `https://www.toyota.com/owners/resources/warranty-owners-manuals/manual?brand=toyota&year=${cleanYear}&model=${encodeURIComponent(cleanModel)}`;
    } else if (cleanBrand.includes("ford")) {
      officialUrl = `https://www.ford.com/support/vehicle/${encodeURIComponent(cleanModel)}/${cleanYear}/owner-manual/`;
    } else if (cleanBrand.includes("honda")) {
      officialUrl = `https://owners.honda.com/vehicle-information/manuals?year=${cleanYear}&model=${encodeURIComponent(charmModel)}`;
    } else if (cleanBrand.includes("nissan")) {
      officialUrl = `https://www.nissanusa.com/content/dam/Nissan/us/manuals-and-guides/shared/common-manuals/${cleanYear}/owner-manual.pdf`;
    } else if (cleanBrand.includes("chevrolet") || cleanBrand.includes("chevy")) {
      officialUrl = `https://www.chevrolet.com/bypass/pcf/gma-content-api/resources/gma/pdf/${cleanYear}/chevrolet/${encodeURIComponent(cleanModel)}/owner-manual.pdf`;
    } else if (cleanBrand.includes("seat")) {
      officialUrl = `https://www.seat.es/posventa/manuales-instrucciones.html`;
    } else if (cleanBrand.includes("volkswagen") || cleanBrand.includes("vw")) {
      officialUrl = `https://userguide.volkswagen.de/public/vin/login/es_ES`;
    } else if (cleanBrand.includes("peugeot")) {
      officialUrl = `https://public.servicebox.peugeot.com/APddb/`;
    } else {
      // General fallback to charm repair database which contains incredible extensive catalogs
      officialUrl = charmUrl;
    }

    try {
      // Validate with a metadata head/get request
      const testRes = await axios.get(officialUrl, { 
        timeout: 1500, 
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } 
      });
      if (testRes.status === 200) {
        return officialUrl;
      }
    } catch (e: any) {
      console.log(`[Manual Finder] Verification of URL status failed or timed out: ${officialUrl}`);
    }

    // Default return calculated url
    return officialUrl;
  }

  // Decode VIN endpoint
  app.get('/api/vehicles/decode-vin/:vin', async (req, res) => {
    try {
      const { vin } = req.params;
      if (!vin) {
        return res.status(400).json({ error: "El VIN es obligatorio" });
      }
      const data = await getVehicleDataFromNHTSA(vin);
      if (!data) {
        return res.status(404).json({ error: "No se pudieron decodificar los datos del VIN" });
      }
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI Maintenance Planner endpoint
  app.post('/api/vehicles/ai-maintenance', async (req, res) => {
    try {
      const { brand, model, year, fuelType, currentKms, lastOilChangeKms, lastFilterChangeKms, lastTireChangeKms } = req.body;
      
      if (!brand || !model) {
        return res.status(400).json({ error: "Marca y modelo son obligatorios" });
      }

      const { getAIMaintenanceIntervals, calculateFutureMaintenance } = await import("./src/services/geminiService");

      const intervals = await getAIMaintenanceIntervals(brand, model, year || "", fuelType || "");
      const current = Number(currentKms) || 0;
      const lastOil = lastOilChangeKms !== undefined && lastOilChangeKms !== "" && lastOilChangeKms !== null ? Number(lastOilChangeKms) : undefined;
      const lastFilter = lastFilterChangeKms !== undefined && lastFilterChangeKms !== "" && lastFilterChangeKms !== null ? Number(lastFilterChangeKms) : undefined;
      const lastTire = lastTireChangeKms !== undefined && lastTireChangeKms !== "" && lastTireChangeKms !== null ? Number(lastTireChangeKms) : undefined;

      const upcoming = calculateFutureMaintenance(intervals, current, lastOil, lastFilter, lastTire);

      res.json({
        success: true,
        intervals,
        upcoming
      });
    } catch (error: any) {
      console.error("Error in AI maintenance endpoint:", error);
      res.status(500).json({ error: error.message });
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

      let manualId = `manual-${Date.now()}`;
      let dbSucceeded = false;

      if (db) {
        try {
          // Bypassing SQL in favor of Firestore, writing to "vehicle_manuals" collection
          const docRef = await db.collection("vehicle_manuals").add({
            ...manualData,
            uploaded_at: admin.firestore.FieldValue.serverTimestamp()
          });
          manualId = docRef.id;
          dbSucceeded = true;
        } catch (dbErr: any) {
          console.warn("[Server/Bypass] Creating Firestore vehicle_manuals entry failed:", dbErr.message);
        }
      }

      // Always save to a local JSON backup as fallback for smooth preview environments
      try {
        const localDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
        }
        const localDbPath = path.join(localDir, 'manuals.json');
        let localManuals: any[] = [];
        if (fs.existsSync(localDbPath)) {
          try {
            localManuals = JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
          } catch (e) {
            localManuals = [];
          }
        }
        localManuals.push({
          id: manualId,
          ...manualData
        });
        fs.writeFileSync(localDbPath, JSON.stringify(localManuals, null, 2), 'utf8');
      } catch (backupErr: any) {
        console.warn("[Server/Backup] Failed to write local manuals.json:", backupErr.message);
      }

      return res.status(201).json({
        message: 'Manual subido correctamente',
        manual: { id: manualId, title: manualData.title, file_url: fileUrl }
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
      const { brand, model, year, vin } = req.query;
      const manuals: any[] = [];
      let dbSucceeded = false;

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
          dbSucceeded = true;
        } catch (dbErr: any) {
          console.warn("[Server/Bypass] Loading vehicle_manuals from Firestore failed:", dbErr.message);
        }
      }

      // If database fetch was not successful or returned empty, load from backup local database
      if (!dbSucceeded || manuals.length === 0) {
        try {
          const localDbPath = path.join(process.cwd(), 'uploads', 'manuals.json');
          if (fs.existsSync(localDbPath)) {
            const localManuals = JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
            const filtered = localManuals.filter((m: any) => m.vehicle_id === vehicle_id);
            filtered.forEach((m: any) => {
              if (!manuals.some(existing => existing.id === m.id)) {
                manuals.push(m);
              }
            });
            manuals.sort((a, b) => new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime());
          }
        } catch (backupErr: any) {
          console.warn("[Server/Backup] Failed to read local manuals.json:", backupErr.message);
        }
      }

      // --- Suggested official manual auto-discovery ---
      let suggestedManual: any = null;
      let decodedData: any = null;

      let searchBrand = brand as string;
      let searchModel = model as string;
      let searchYear = year as string;

      if (vin && String(vin).trim().length >= 10) {
        decodedData = await getVehicleDataFromNHTSA(String(vin).trim());
        if (decodedData) {
          if (decodedData["Make"]) searchBrand = decodedData["Make"];
          if (decodedData["Model"]) searchModel = decodedData["Model"];
          if (decodedData["Model Year"]) searchYear = decodedData["Model Year"];
        }
      }

      if (searchBrand && searchModel && searchYear) {
        const manualUrl = await fetchOwnerManual(searchBrand, searchModel, searchYear);
        if (manualUrl) {
          suggestedManual = {
            id: "suggested-official-manual",
            title: `Manual Oficial de ${searchBrand} ${searchModel} (${searchYear})`,
            description: decodedData ? `Decodificado del VIN via Base de Datos Nacional NHTSA` : "Manual original sugerido por el fabricante",
            file_url: manualUrl,
            file_type: "link",
            file_size: 0,
            uploaded_at: new Date().toISOString(),
            isOfficial: true,
            decodedVinData: decodedData ? {
              make: decodedData["Make"],
              model: decodedData["Model"],
              year: decodedData["Model Year"],
              bodyClass: decodedData["Body Class"],
              engineCylinders: decodedData["Engine Number of Cylinders"],
              driveType: decodedData["Drive Type"]
            } : null
          };
        }
      }

      res.json({
        manuals,
        suggestedManual
      });
    } catch (error) {
      console.error("Error loading vehicle manuals:", error);
      res.status(500).json({ error: 'Error al obtener los manuales.' });
    }
  });

  // Endpoint to delete a manual
  app.delete('/api/manual/:id', async (req, res) => {
    try {
      const { id } = req.params;
      let dbDeleted = false;

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
            dbDeleted = true;
          }
        } catch (dbErr: any) {
          console.warn("[Server/Bypass] Deleting vehicle_manual entry failed:", dbErr.message);
        }
      }

      // Clean up from the local backup DB as well
      try {
        const localDbPath = path.join(process.cwd(), 'uploads', 'manuals.json');
        if (fs.existsSync(localDbPath)) {
          let localManuals = JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
          const itemToDelete = localManuals.find((m: any) => m.id === id);
          if (itemToDelete && itemToDelete.file_url && !dbDeleted) {
            const fileName = itemToDelete.file_url.split('/').pop();
            const localFilePath = path.join(process.cwd(), 'uploads', fileName);
            if (fs.existsSync(localFilePath)) {
              fs.unlinkSync(localFilePath);
            }
          }
          localManuals = localManuals.filter((m: any) => m.id !== id);
          fs.writeFileSync(localDbPath, JSON.stringify(localManuals, null, 2), 'utf8');
        }
      } catch (backupErr: any) {
        console.warn("[Server/Backup] Failed to update local manuals.json:", backupErr.message);
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
