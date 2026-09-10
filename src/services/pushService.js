// src/services/pushService.js

/**
 * Plays sound and displays push notification to parents
 * @param {string} studentName 
 * @param {string} status - "Present" or "Absent"
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