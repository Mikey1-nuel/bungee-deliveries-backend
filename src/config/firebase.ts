import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const firebaseConfigRaw = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!firebaseConfigRaw) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT missing from environment");
}

let serviceAccount: admin.ServiceAccount;

try {
  serviceAccount = JSON.parse(firebaseConfigRaw);
} catch (err) {
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT is not valid JSON — check it was pasted as a single line with no line breaks",
  );
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const firebaseAdmin = admin;
