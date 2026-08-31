import { useState, useEffect } from "react";
import SidebarLayout from "../../components/SidebarLayout";
import { db } from "../../firebase/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function ParentAttendance() {
  const [attendance, setAttendance] = useState([]);
  const [joinedChild, setJoinedChild] = useState(null);

  useEffect(() => {
    const savedChild = localStorage.getItem("joinedChild");
    if (savedChild) {
      const parsedChild = JSON.parse(savedChild);
      setJoinedChild(parsedChild);
      fetchAttendance(parsedChild.id);
    }
  }, []);

  const fetchAttendance = async (studentId) => {
    try {
      // 1. Fetch data WITHOUT Firebase's orderBy to bypass the Index block
      const q = query(
        collection(db, "attendance"),
        where("studentId", "==", studentId)
      );
      
      const querySnapshot = await getDocs(q);
      const records = [];
      querySnapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() });
      });

      // 2. Sort the data locally (Load Management: saves database compute)
      records.sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA; // Newest first
      });

      setAttendance(records);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    }
  };

  // Helper to format the Firestore timestamp into a readable time (e.g., 8:30 AM)
  const formatTime = (timestamp) => {
    if (!timestamp) return "N/A";
    const dateObj = new Date(timestamp.seconds * 1000);
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!joinedChild) {
    return (
      <SidebarLayout role="parent">
        <div className="card">
          <h3>No Child Connected</h3>
          <p>Please go to the Home tab and join a room first.</p>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout role="parent">
      <div className="card">
        <h3>Attendance History for {joinedChild.fullName}</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {attendance.length === 0 ? <tr><td colSpan="3">No attendance recorded yet.</td></tr> : null}
            {attendance.map(a => (
              <tr key={a.id}>
                <td style={{ fontWeight: "500" }}>{a.date}</td>
                <td style={{ color: "#6b7280" }}>{formatTime(a.timestamp)}</td>
                <td>
                  <span className={`badge ${a.status === 'Present' ? 'badge-present' : 'badge-absent'}`}>
                    {a.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SidebarLayout>
  );
}