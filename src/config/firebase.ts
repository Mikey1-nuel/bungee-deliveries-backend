import admin from "firebase-admin";
import serviceAccount from "./bungee-deliveriees-94526-firebase-adminsdk-fbsvc-bd9f57baad.json";
import dotenv from "dotenv";

dotenv.config();

const firebaseConfig = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!firebaseConfig) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT missing from .env");
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

export const firebaseAdmin = admin;
