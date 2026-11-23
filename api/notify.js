import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

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

    const { token, title, body } = req.body || {};

    if (!token) {
      return res.status(400).json({ error: "No device token provided" });
    }

    const response = await getMessaging().send({
      token,
      notification: {
        title,
        body,
      },
    });

    return res.status(200).json({ success: true, message: "Notification sent!", response });
  } catch (error) {
    console.error("Error sending push notification:", error);
    return res.status(500).json({ error: error.message });
  }
}