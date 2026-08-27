import { auth, db } from "./firebase.js";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
} from "firebase/auth";
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";

// ==========================================
// 1. AUTHENTICATION & USER ROLES
// Roles: 'admin', 'teacher', 'parent'[cite: 1]
// ==========================================

export const registerUser = async (email, password, fullName, role, additionalData = {}) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Save extended profile in 'users' collection[cite: 1]
    await setDoc(doc(db, "users", uid), {
      uid,
      email,
      fullName,
      role, // 'admin', 'teacher', or 'parent'[cite: 1]
      createdAt: serverTimestamp(),
      ...additionalData
    });

    return { success: true, uid };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Fetch user role details[cite: 1]
    const userDoc = await getDoc(doc(db, "users", uid));
    const userData = userDoc.exists() ? userDoc.data() : null;

    return { success: true, user: userCredential.user, profile: userData };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==========================================
// 2. STUDENT & CLASS MANAGEMENT
// ==========================================

export const addStudent = async (studentData) => {
  // studentData: { studentNo, fullName, gradeLevel, section, parentId }[cite: 1]
  try {
    const docRef = await addDoc(collection(db, "students"), {
      ...studentData,
      createdAt: serverTimestamp()
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getStudentsBySection = async (section) => {
  try {
    const q = query(collection(db, "students"), where("section", "==", section));
    const querySnapshot = await getDocs(q);
    const students = [];
    querySnapshot.forEach((doc) => students.push({ id: doc.id, ...doc.data() }));
    return { success: true, students };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==========================================
// 3. ATTENDANCE MONITORING
// ==========================================

export const markAttendance = async (studentId, studentName, status, section, markedByTeacherId) => {
  try {
    const docRef = await addDoc(collection(db, "attendance"), {
      studentId,
      studentName,
      status, // 'Present', 'Late', 'Absent'[cite: 1]
      section,
      markedByTeacherId,
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      timestamp: serverTimestamp()
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getStudentAttendance = async (studentId) => {
  try {
    const q = query(
      collection(db, "attendance"), 
      where("studentId", "==", studentId),
      orderBy("timestamp", "desc")
    );
    const querySnapshot = await getDocs(q);
    const records = [];
    querySnapshot.forEach((doc) => records.push({ id: doc.id, ...doc.data() }));
    return { success: true, records };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==========================================
// 4. GRADE NOTIFICATIONS
// ==========================================

export const addGradeRecord = async (studentId, subject, quarter, score, teacherId) => {
  try {
    const docRef = await addDoc(collection(db, "grades"), {
      studentId,
      subject,
      quarter, // 'Q1', 'Q2', 'Q3', 'Q4'[cite: 1]
      score,
      encodedByTeacherId: teacherId,
      timestamp: serverTimestamp()
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getStudentGrades = async (studentId) => {
  try {
    const q = query(collection(db, "grades"), where("studentId", "==", studentId));
    const querySnapshot = await getDocs(q);
    const grades = [];
    querySnapshot.forEach((doc) => grades.push({ id: doc.id, ...doc.data() }));
    return { success: true, grades };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==========================================
// 5. EMERGENCY ALERTS & NOTIFICATIONS
// ==========================================

export const sendEmergencyAlert = async (title, message, adminId) => {
  try {
    const docRef = await addDoc(collection(db, "emergencyAlerts"), {
      title,
      message,
      postedByAdminId: adminId,
      createdAt: serverTimestamp()
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getActiveEmergencyAlerts = async () => {
  try {
    const q = query(collection(db, "emergencyAlerts"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const alerts = [];
    querySnapshot.forEach((doc) => alerts.push({ id: doc.id, ...doc.data() }));
    return { success: true, alerts };
  } catch (error) {
    return { success: false, error: error.message };
  }
};