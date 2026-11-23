import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
        : undefined,
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Verify the requester is a logged-in Admin
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : null;

    if (!idToken) {
      return res.status(401).json({ error: "Unauthorized: Missing token." });
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const adminDoc = await admin.firestore().collection("users").doc(decodedToken.uid).get();

    if (!adminDoc.exists || adminDoc.data().role !== "admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required." });
    }

    // 2. Validate payload
    const { uid, newPassword } = req.body;

    if (!uid || !newPassword) {
      return res.status(400).json({ error: "Missing user ID or new password." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    // 3. Update the real password in Firebase Authentication
    await admin.auth().updateUser(uid, { password: newPassword });

    return res.status(200).json({ success: true, message: "Password updated in Firebase Auth." });
  } catch (error) {
    console.error("Update Password Error:", error);
    return res.status(500).json({ error: error.message || "Failed to update password." });
  }
}