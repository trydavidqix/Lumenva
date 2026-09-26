import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

/**
 * Firebase Auth (Identity Platform) Adapter.
 * Replaces Supabase Auth.
 */

export function initFirebaseAuth() {
  if (getApps().length === 0) {
    // Expected to run in a GCP environment where GOOGLE_APPLICATION_CREDENTIALS 
    // is set or default service account is available.
    initializeApp({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || 'lumenva-project',
    });
  }
  return getAuth();
}

export const auth = initFirebaseAuth();

export async function verifyIdToken(token: string) {
  try {
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    throw error;
  }
}
