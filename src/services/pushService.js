// src/services/pushService.js
import { getMessaging, getToken } from "firebase/messaging";
import { doc, updateDoc } from "firebase/firestore";
import { db, app } from "../firebase/firebase"; 

/**
 * Plays sound and displays push notification to parents
 * @param {string} studentName 
 * @param {string} status "Present" or "Absent"
 */
export const triggerAttendanceNotification = (studentName, status) => {
  // 1. Play sound
  const audio = new Audio("/notification.mp3");
  audio.play().catch((err) => console.log("Audio playback blocked:", err));

  const title = "Attendance Alert";
  const body = `${studentName} was marked ${status} today.`;

  // 2. Display notification
  if (Notification.permission === "granted") {
    new Notification(title, {
      body: body,
      icon: "/favicon.ico",
    });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification(title, {
          body: body,
          icon: "/favicon.ico",
        });
      }
    });
  }
};

/**
 * Requests browser permission and generates an FCM Device Token
 * @param {string} userId - The logged-in user's Firebase UID
 */
export const requestNotificationPermission = async (userId) => {
  try {
    const messaging = getMessaging(app);
    
    const permission = await Notification.requestPermission();
    
    if (permission === "granted") {
      const currentToken = await getToken(messaging, { 
        vapidKey: "BHmnpLvjyK9Bzd0JLjHk8TYKYLZ57cUOzNaDjZm7nslMOlEK4Wsi9cBvPXDfuhaimvZn4wh0efWV3Wsf_nSzY1k" 
      });

      if (currentToken) {
        await updateDoc(doc(db, "users", userId), {
          fcmToken: currentToken
        });
        console.log("Device Token successfully saved to database!");
      } else {
        console.log("No registration token available.");
      }
    }
  } catch (error) {
    console.error("An error occurred while retrieving token:", error);
  }
};