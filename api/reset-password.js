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

    const { action, email, newPassword } = req.body || {};
    const cleanedEmail = (email || "").trim();

    if (!cleanedEmail) {
      return res.status(400).json({ error: "Please enter your email address first to verify." });
    }

    // 1. Check if the email exists in Firebase Authentication
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(cleanedEmail);
    } catch (authErr) {
      if (authErr.code === "auth/user-not-found" || authErr.code === "auth/invalid-email") {
        return res.status(404).json({ error: "Email not found in the database." });
      }
      throw authErr;
    }

    // 2. Confirm the user also has an active profile in Firestore
    const userDoc = await db.collection("users").doc(userRecord.uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Account not found in the database." });
    }

    // Step A: Verify-only check
    if (action === "verify") {
      return res.status(200).json({ success: true, message: "Email verified." });
    }

    // Step B: Update password directly in Firebase Authentication
    if (action === "reset") {
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long." });
      }

      await adminAuth.updateUser(userRecord.uid, { password: newPassword });

      return res.status(200).json({
        success: true,
        message: "Password updated successfully! You can now sign in.",
      });
    }

    return res.status(400).json({ error: "Invalid action." });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({ error: error.message || "Failed to process password reset." });
  }
}