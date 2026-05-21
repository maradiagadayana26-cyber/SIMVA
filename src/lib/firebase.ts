import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
  getDocFromServer, 
  getDoc as firestoreGetDoc, 
  getDocFromCache, 
  DocumentReference, 
  DocumentSnapshot 
} from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);

// Resilient getDoc with automatic local cache fallback and exponential backoff retry for network transients (like "client is offline")
export async function getDocWithRetry(docRef: DocumentReference, maxRetries = 5, delayMs = 1200): Promise<DocumentSnapshot> {
  let lastError: any = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Try to fetch normally from the server or cache as determined by Firestore SDK
      const docSnap = await firestoreGetDoc(docRef);
      return docSnap;
    } catch (error: any) {
      lastError = error;
      const errorMsg = error?.message || String(error);
      
      // If the error indicates client is offline, retry after a delay or try cache fallback
      if (errorMsg.includes('client is offline') || errorMsg.includes('offline') || error?.code === 'unavailable') {
        console.warn(`[SIMVA Firestore] Connection transient error (Attempt ${i + 1}/${maxRetries}): ${errorMsg}`);
        
        // Attempt immediate offline cache fallback as a safe recovery measure
        try {
          const cachedSnap = await getDocFromCache(docRef);
          if (cachedSnap.exists()) {
            console.log("[SIMVA Firestore] Safely resolved document from local cache fallback.");
            return cachedSnap;
          }
        } catch (cacheErr) {
          // Cache read failed or document is not cached yet, continue to retry
        }

        // Wait before next retrying attempt
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs = delayMs * 1.5; // Exponential backoff spacing
        continue;
      }
      
      // For permission errors or other hard errors, throw immediately to avoid infinite looping
      throw error;
    }
  }
  throw lastError;
}

// Connectivity check (delayed to avoid throwing normal network connection handshake phase errors on cold-start)
async function testConnection() {
  setTimeout(async () => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
      console.log("[SIMVA] Firebase Firestore online channel established.");
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      if (errorMsg.includes('the client is offline')) {
        console.warn("[SIMVA] Firestore offline transient warning: Initializing background connection stream.");
      }
    }
  }, 4000); // 4 second initial delay for browser engine stabilization
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function handleFirebaseAuthError(error: any): string {
  const code = error?.code || error?.message || "";
  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  switch (code) {
    case 'auth/unauthorized-domain':
      return `⚠️ El dominio actual (${currentDomain}) no está autorizado en tu proyecto de Firebase.\n\nPara solucionarlo, ve a Firebase Console > Authentication > Settings > Authorized domains y añade "${currentDomain}".`;
    case 'auth/user-not-found':
      return 'No encontramos ningún usuario registrado con este correo electrónico. Por favor, regístrate si es tu primera vez.';
    case 'auth/wrong-password':
      return 'La contraseña es incorrecta. Por favor, verifícala e inténtalo de nuevo.';
    case 'auth/invalid-credential':
      return 'Las credenciales proporcionadas no son válidas o han expirado. Revisa tu correo y contraseña.';
    case 'auth/email-already-in-use':
      return 'Este correo electrónico ya está registrado. Prueba a iniciar sesión en lugar de registrarte.';
    case 'auth/weak-password':
      return 'La contraseña es demasiado débil. Debe tener al menos 6 caracteres.';
    case 'auth/invalid-email':
      return 'El formato del correo electrónico ingresado no es válido.';
    case 'auth/network-request-failed':
      return 'Error de red. Por favor, comprueba tu conexión a internet e inténtalo de nuevo.';
    case 'auth/popup-closed-by-user':
      return 'El inicio de sesión se canceló al cerrar la ventana emergente de Google.';
    case 'auth/cancelled-popup-request':
      return 'Se canceló la ventana emergente de autenticación anterior. Inténtalo de nuevo.';
    case 'auth/operation-not-allowed':
      return 'Este método de autenticación no está habilitado en la configuración de Authentication de tu consola Firebase.';
    default:
      return error?.message || 'Ocurrió un error inesperado al autenticar. Por favor, inténtalo de nuevo.';
  }
}

