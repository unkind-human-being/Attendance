import { useState, useEffect } from "react";
import SidebarLayout from "../../components/SidebarLayout";
import { db, auth } from "../../firebase/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function ParentGrades() {
  const [grades, setGrades] = useState([]);
  const [studentName, setStudentName] = useState("Loading...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGradesData = async (user) => {
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

        // 3. Get the Grades using the exact LRN
        const qGrades = query(collection(db, "grades"), where("studentLRN", "==", parentLRN));
        const gradeSnap = await getDocs(qGrades);
        const loadedGrades = [];
        gradeSnap.forEach(document => loadedGrades.push({ id: document.id, ...document.data() }));
        
        setGrades(loadedGrades);
      } catch (error) {
        console.error("Error fetching grades:", error);
      }
      setLoading(false);
    };

    // Ensure we run this securely with the currently logged-in parent
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchGradesData(user);
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <SidebarLayout role="parent">
      <div className="card">
        {/* Prominent Header UI */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '2rem' }}>
          <div style={{ height: '50px', width: '50px', borderRadius: '50%', backgroundColor: '#fef3c7', color: '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
            {studentName.charAt(0)}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.5rem' }}>{studentName}</h3>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>Academic Report</p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading academic data...</div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Quarter</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {grades.length === 0 ? (
                  <tr><td colSpan="3" className="empty-state">No academic grades posted yet.</td></tr>
                ) : (
                  grades.map(g => (
                    <tr key={g.id}>
                      <td style={{ fontWeight: '500' }}>{g.subject}</td>
                      <td>{g.quarter}</td>
                      <td style={{ fontWeight: '800', color: '#3b82f6', fontSize: '1.1rem' }}>{g.score}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}