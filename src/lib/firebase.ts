import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import { authPersistence } from './authPersistence';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

function makeAuth() {
  const app = getApps().length ? getApp() : initializeApp(config);
  try {
    return initializeAuth(app, {
      persistence: authPersistence,
    });
  } catch (error: any) {
    if (error.code !== 'auth/already-initialized') throw error;
    return getAuth(app);
  }
}

export const firebaseAuth = config.apiKey && config.projectId && config.appId ? makeAuth() : null;

export function authError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'The email or password is incorrect.';
    case 'auth/email-already-in-use':
      return 'This email already has an account. Sign in or reset your password.';
    case 'auth/weak-password':
      return 'Use a stronger password with at least 8 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait before trying again.';
    case 'auth/network-request-failed':
      return 'Could not connect. Check your internet connection.';
    case 'auth/operation-not-allowed':
      return 'Account signup is not enabled on the server yet.';
    default:
      return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  }
}
