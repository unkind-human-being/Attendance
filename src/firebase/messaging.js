import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc } from "firebase/firestore";
import { app, db } from "./firebase";

const messaging = getMessaging(app);

export const requestTeacherNotificationPermission = async (teacherUserId) => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      // Request device token using your Key Pair
      const currentToken = await getToken(messaging, {
        vapidKey: "BHMnpLvjyK9Bzd0JLjHk8TYKYLZ57cU0zNaDJzM7nsLM0LEK4Wsi9cBvPXDfuhaimvZn4wh0efWV3Wsf_nSZy1k"
      });

      if (currentToken && teacherUserId) {
        // Save the FCM Token to teacher's user document in Firestore
        const teacherRef = doc(db, "users", teacherUserId);
        await updateDoc(teacherRef, { fcmToken: currentToken });
        console.log("Teacher FCM Token saved successfully:", currentToken);
      }
    }
  } catch (error) {
    console.error("Error setting up push notifications:", error);
  }
};

// Show popup notification when teacher HAS the app open in foreground
export const listenToForegroundNotifications = () => {
  onMessage(messaging, (payload) => {
    new Notification(payload.notification.title, {
      body: payload.notification.body,
      icon: "/favicon.ico"
    });
  });
};