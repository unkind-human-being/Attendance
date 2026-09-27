importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCl7QIk-ag61ffM1yJKYLU4qaARZvNCEgY",
  authDomain: "smartpta-attendance.firebaseapp.com",
  projectId: "smartpta-attendance",
  storageBucket: "smartpta-attendance.appspot.com",
  messagingSenderId: "1035641084614",
  appId: "1:1035641084614:web:8360fc07294128c40595c7"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Attendance Notification";
  const options = {
    body: payload.notification?.body || "Attendance status updated.",
    icon: "/favicon.ico",
  };

  self.registration.showNotification(title, options);
});