import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  // Try to initialize using credential cert if variables are present,
  // otherwise fallback to application default credentials
  try {
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      admin.initializeApp();
    }
  } catch (error: any) {
    console.error('Firebase Admin Initialization Error', error.stack);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
