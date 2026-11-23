import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function initFirebaseAdmin() {
  if (getApps().length > 0) return;

  const projectId = process.env.FIREBASE_PROJECT_ID?.replace(/^"|"$/g, "").trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.replace(/^"|"$/g, "").trim();
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawPrivateKey) {
    throw new Error(
      `Missing Vercel Environment Variables: ${!projectId ? "FIREBASE_PROJECT_ID " : ""}${!clientEmail ? "FIREBASE_CLIENT_EMAIL " : ""}${!rawPrivateKey ? "FIREBASE_PRIVATE_KEY" : ""}`.trim()
    );
  }

  const privateKey = rawPrivateKey
    .trim()
    .replace(/,$/, "")
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n");

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    initFirebaseAdmin();

    const adminAuth = getAuth();
    const db = getFirestore();

    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : null;

    if (!idToken) {
      return res.status(401).json({ error: "Unauthorized: Missing token." });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const adminDoc = await db.collection("users").doc(decodedToken.uid).get();

    if (!adminDoc.exists || adminDoc.data().role !== "admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required." });
    }

    const { uid, newPassword } = req.body || {};

    if (!uid || !newPassword) {
      return res.status(400).json({ error: "Missing user ID or new password." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    await adminAuth.updateUser(uid, { password: newPassword });

    return res.status(200).json({ success: true, message: "Password updated in Firebase Auth." });
  } catch (error) {
    console.error("Update Password Error:", error);
    return res.status(500).json({ error: error.message || "Failed to update password." });
  }
}