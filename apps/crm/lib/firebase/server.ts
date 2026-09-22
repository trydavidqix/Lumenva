import { initializeApp, getApps, cert, AppOptions } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { cookies } from "next/headers";

export const FIREBASE_SESSION_COOKIE = "firebase_session";

export function getFirebaseAdminApp() {
  if (getApps().length === 0) {
    const options: AppOptions = {};
    
    // Se você estiver num ambiente local com credenciais de service account, você pode
    // definir a variável FIREBASE_SERVICE_ACCOUNT_KEY como um JSON em base64 ou
    // apenas confiar no GOOGLE_APPLICATION_CREDENTIALS do gcloud.
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(
          Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, "base64").toString("utf8")
        );
        options.credential = cert(serviceAccount);
      } catch (err) {
        console.error("Erro ao fazer parse de FIREBASE_SERVICE_ACCOUNT_KEY", err);
      }
    }

    // Se options.credential não for passado, ele fará fallback seguro pro Application Default Credentials (ADC)
    // Isso é ideal pro Cloud Run e ambientes GCP nativos.
    return initializeApp(options);
  }
  return getApps()[0];
}

export const adminAuth = getAuth(getFirebaseAdminApp());

export async function createSessionCookie(idToken: string, expiresIn: number) {
  return adminAuth.createSessionCookie(idToken, { expiresIn });
}

export async function verifySessionCookie(sessionCookie: string) {
  try {
    return await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch (error) {
    return null;
  }
}

/**
 * Utilitário para recuperar o UID da sessão atual
 */
export async function getSessionUid(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(FIREBASE_SESSION_COOKIE)?.value;
  
  if (!sessionCookie) return null;

  const decodedClaims = await verifySessionCookie(sessionCookie);
  return decodedClaims?.uid || null;
}
