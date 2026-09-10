import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import SidebarLayout from "../../components/SidebarLayout";
import { db, auth } from "../../firebase/firebase";
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { triggerAttendanceNotification } from "../../services/pushService";

export default function ParentHome() {
  const [parentProfile, setParentProfile] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [latestNotification, setLatestNotification] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeAttendance = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // 1. Get the Parent's assigned LRN and Room from their account
          const parentDoc = await getDoc(doc(db, "users", user.uid));
          if (parentDoc.exists()) {
            const pData = parentDoc.data();
            setParentProfile(pData);
            
            // Save LRN to local storage so the layout/notification badge can use it
            localStorage.setItem("parentLRN", pData.studentLRN);

            // 2. Fetch the Student's actual data from the roster using the LRN
            const qStudent = query(collection(db, "students"), where("lrn", "==", pData.studentLRN));
            const studentSnap = await getDocs(qStudent);
            
            if (!studentSnap.empty) {
              setStudentData(studentSnap.docs[0].data());
            }

            // 3. Listen to real-time attendance updates for this LRN
            const qAtt = query(collection(db, "attendance"), where("studentLRN", "==", pData.studentLRN));
            
            let initialLoad = true;
            unsubscribeAttendance = onSnapshot(qAtt, (attSnap) => {
              const records = [];
              attSnap.forEach(d => records.push(d.data()));
              
              // Sort to get the most recent record
              records.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

              if (records.length > 0) {
                const latest = records[0];
                setLatestNotification(latest);

                // Trigger desktop notification and alert audio on new update after initial load
                if (!initialLoad) {
                  triggerAttendanceNotification(latest.studentName, latest.status);
                }
              }
              initialLoad = false;
            });
          }
        } catch (error) {
          console.error("Error fetching parent data:", error);
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeAttendance) unsubscribeAttendance();
    };
  }, []);

  if (loading) {
    return (
      <SidebarLayout role="parent">
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>Loading student data...</div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout role="parent">
      
      {/* 1. STUDENT IDENTITY CARD */}
      <div className="card" style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)", color: "white", border: "none" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ height: '60px', width: '60px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', fontWeight: 'bold' }}>
            {studentData ? studentData.firstName.charAt(0) : "🎓"}
          </div>
          <div>
            <h2 style={{ margin: '0 0 5px 0', fontSize: '1.5rem', fontWeight: '700' }}>
              {studentData ? `${studentData.firstName} ${studentData.lastName}` : "Student Profile"}
            </h2>
            <div style={{ fontSize: '0.9rem', opacity: 0.9, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span><strong>LRN:</strong> {parentProfile?.studentLRN || "Not Assigned"}</span>
              <span><strong>Room:</strong> {parentProfile?.assignedRoom || "Not Assigned"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. LATEST NOTIFICATION FROM TEACHER */}
      <div className="card" style={{ borderLeft: "4px solid #10b981", padding: "1.25rem" }}>
        <h3 style={{ fontSize: '1rem', color: '#374151', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🔔 Latest Update
        </h3>
        
        {latestNotification ? (
          <div>
            <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: '#111827' }}>
              Attendance: <span style={{ color: latestNotification.status === 'Present' ? '#10b981' : '#ef4444' }}>{latestNotification.status}</span>
            </p>
            <p style={{ margin: '5px 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
              Recorded on {latestNotification.date} 
            </p>
          </div>
        ) : (
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>No recent notifications from the teacher.</p>
        )}
      </div>

      {/* 3. QUICK ACTION BUTTONS */}
      <h3 style={{ margin: "1.5rem 0 1rem 0", fontSize: "1.1rem", color: "#374151" }}>Check Status</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        
        <Link to="/parent/attendance" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ margin: 0, textAlign: 'center', padding: '1.5rem', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📅</div>
            <h4 style={{ color: '#111827', margin: 0 }}>Attendance Log</h4>
            <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '5px 0 0 0' }}>View history</p>
          </div>
        </Link>

        <Link to="/parent/grades" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ margin: 0, textAlign: 'center', padding: '1.5rem', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📊</div>
            <h4 style={{ color: '#111827', margin: 0 }}>Academic Grades</h4>
            <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '5px 0 0 0' }}>Check progress</p>
          </div>
        </Link>

      </div>
    </SidebarLayout>
  );
}