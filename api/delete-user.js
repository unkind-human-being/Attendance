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

    // 2. Validate target UID
    const { uid } = req.body;
    if (!uid) {
      return res.status(400).json({ error: "Missing user ID." });
    }

    if (uid === decodedToken.uid) {
      return res.status(400).json({ error: "You cannot delete your own active admin account." });
    }

    const db = admin.firestore();
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    // 3. Clean up related Firestore data (Rooms for Teachers, Students for Parents)
    if (userSnap.exists) {
      const userData = userSnap.data();

      if (userData.role === "teacher") {
        const roomsSnap = await db.collection("rooms").where("assignedTeacherId", "==", uid).get();
        const roomUpdates = roomsSnap.docs.map((roomDoc) =>
          roomDoc.ref.update({
            assignedTeacherId: "",
            assignedTeacherName: "Unassigned",
          })
        );
        await Promise.all(roomUpdates);
      }

      if (userData.role === "parent") {
        const studentsByParent = await db.collection("students").where("parentUid", "==", uid).get();
        const deletePromises = studentsByParent.docs.map((studentDoc) => studentDoc.ref.delete());
        await Promise.all(deletePromises);
      }

      // Delete the Firestore user profile
      await userRef.delete();
    }

    // 4. Permanently delete from Firebase Authentication
    try {
      await admin.auth().deleteUser(uid);
    } catch (authErr) {
      // Ignore if already removed from Firebase Auth so Firestore cleanup still succeeds
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