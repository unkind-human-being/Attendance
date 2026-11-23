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

    // 1. Verify the requester is a logged-in Admin
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

    // 2. Validate target UID
    const { uid } = req.body || {};
    if (!uid) {
      return res.status(400).json({ error: "Missing user ID." });
    }

    if (uid === decodedToken.uid) {
      return res.status(400).json({ error: "You cannot delete your own active admin account." });
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    // 3. Clean up related Firestore data
    if (userSnap.exists) {
      const userData = userSnap.data();

      if (userData.role === "teacher") {
        const roomsSnap = await db.collection("rooms").where("assignedTeacherId", "==", uid).get();
        await Promise.all(
          roomsSnap.docs.map((roomDoc) =>
            roomDoc.ref.update({
              assignedTeacherId: "",
              assignedTeacherName: "Unassigned",
            })
          )
        );
      }

      if (userData.role === "parent") {
        const studentsSnap = await db.collection("students").where("parentUid", "==", uid).get();
        await Promise.all(studentsSnap.docs.map((studentDoc) => studentDoc.ref.delete()));
      }

      await userRef.delete();
    }

    // 4. Permanently delete from Firebase Authentication
    try {
      await adminAuth.deleteUser(uid);
    } catch (authErr) {
      if (authErr.code !== "auth/user-not-found") {
        throw authErr;
      }
    }

    return res.status(200).json({ success: true, message: "User completely deleted from Auth and Firestore." });
  } catch (error) {
    console.error("Delete User Error:", error);
    return res.status(500).json({ error: error.message || "Failed to delete user." });
  }
}