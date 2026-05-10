import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app';
import { getDatabase, ref, runTransaction, push } from 'firebase/database';

const SOURCE = 'hangr';

const SESSION_KEY = `deraj_visit_tracked_${SOURCE}`;

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const isConfigured = !!firebaseConfig.databaseURL;
const app = isConfigured
  ? (getApps()[0] ?? initializeApp(firebaseConfig))
  : null;

export async function trackVisit(): Promise<void> {
  if (!app) return;
  if (sessionStorage.getItem(SESSION_KEY)) return;
  sessionStorage.setItem(SESSION_KEY, '1');

  try {
    const db = getDatabase(app);

    await runTransaction(ref(db, 'visits/count'), (n) => (n || 0) + 1);

    await runTransaction(
      ref(db, `visits/sources/${SOURCE}/count`),
      (n) => (n || 0) + 1
    );

    try {
      const geo = await fetch('https://ipapi.co/json/').then((r) => r.json());
      if (geo?.latitude && geo?.longitude) {
        await push(ref(db, 'visits/locations'), {
          lat: geo.latitude,
          lng: geo.longitude,
          city: geo.city,
          country: geo.country_name,
          countryCode: geo.country,
          timestamp: Date.now(),
          source: SOURCE,
        });
      }
    } catch {
      // geolocation is best-effort; ignore failures
    }
  } catch (err) {
    console.warn('[visitTracker] failed', err);
  }
}
