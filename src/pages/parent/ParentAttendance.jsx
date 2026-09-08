import { useState, useEffect } from "react";
import SidebarLayout from "../../components/SidebarLayout";
import { db, auth } from "../../firebase/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function ParentAttendance() {
  const [attendance, setAttendance] = useState([]);
  const [studentName, setStudentName] = useState("Loading...");
  const [loading, setLoading] = useState(true);

  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchAttendanceData = async (user) => {
      try {
        // 1. Get the Parent's assigned LRN directly from their profile
        const parentDoc = await getDoc(doc(db, "users", user.uid));
        if (!parentDoc.exists()) {
          setStudentName("Profile Not Found");
          setLoading(false);
          return;
        }
        
        const parentLRN = parentDoc.data().studentLRN;
        
        if (!parentLRN) {
          setStudentName("No Student LRN Linked");
          setLoading(false);
          return;
        }

        // 2. Get the Student's Name
        const qStudent = query(collection(db, "students"), where("lrn", "==", parentLRN));
        const studentSnap = await getDocs(qStudent);
        if (!studentSnap.empty) {
          setStudentName(`${studentSnap.docs[0].data().firstName} ${studentSnap.docs[0].data().lastName}`);
        } else {
          setStudentName("Student Profile Not Found");
        }

        // 3. Get all Attendance Records using the exact LRN
        const qAtt = query(collection(db, "attendance"), where("studentLRN", "==", parentLRN));
        const querySnapshot = await getDocs(qAtt);
        
        const records = [];
        querySnapshot.forEach((doc) => records.push({ id: doc.id, ...doc.data() }));
        
        // Sort by newest first
        records.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        setAttendance(records);
      } catch (error) {
        console.error("Error fetching attendance:", error);
      }
      setLoading(false);
    };

    // Ensure we run this securely with the currently logged-in parent
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchAttendanceData(user);
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const formatTime = (timestamp) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // --- Pagination Calculations ---
  const totalItems = attendance.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAttendance = attendance.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <SidebarLayout role="parent">
      <div className="card">
        {/* Prominent Header UI */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '2rem' }}>
          <div style={{ height: '50px', width: '50px', borderRadius: '50%', backgroundColor: '#dbeafe', color: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
            {studentName.charAt(0)}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.5rem' }}>{studentName}</h3>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>Full Attendance History</p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading records...</div>
        ) : (
          <>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {currentAttendance.length === 0 ? (
                    <tr><td colSpan="3" className="empty-state">No attendance recorded yet.</td></tr>
                  ) : (
                    currentAttendance.map(a => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: "600", color: '#111827' }}>{a.date}</td>
                        <td style={{ color: "#6b7280", fontSize: '0.875rem' }}>{formatTime(a.timestamp)}</td>
                        <td>
                          <span className={`badge ${a.status === 'Present' ? 'badge-present' : 'badge-absent'}`}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Load Management Pagination Format (e.g., 10 / 100) */}
            {totalItems > 0 && (
              <div className="pagination-controls" style={{ marginTop: '1.5rem' }}>
                <button className="btn-outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  Previous
                </button>
                
                <span style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#374151' }}>
                  {Math.min(indexOfLastItem, totalItems)} / {totalItems}
                </span>
                
                <button className="btn-outline" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </SidebarLayout>
  );
}