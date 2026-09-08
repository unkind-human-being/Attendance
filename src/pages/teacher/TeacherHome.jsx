import { useState, useEffect } from "react";
import SidebarLayout from "../../components/SidebarLayout";
import { db, auth } from "../../firebase/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function TeacherHome() {
  const [currentView, setCurrentView] = useState("rooms"); // 'rooms', 'roster', 'attendance', 'grades'
  const [feedback, setFeedback] = useState({ text: "", type: "", show: false });

  const [myRooms, setMyRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [students, setStudents] = useState([]);

  // Grades State
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentGrades, setStudentGrades] = useState([]);
  const [subject, setSubject] = useState("Mathematics");
  const [quarter, setQuarter] = useState("Q1");
  const [score, setScore] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const showMessage = (text, type = "success") => {
    setFeedback({ text, type, show: true });
    setTimeout(() => setFeedback({ text: "", type: "", show: false }), 3000);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchMyRooms(user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchMyRooms = async (teacherUid) => {
    try {
      const q = query(collection(db, "rooms"), where("assignedTeacherId", "==", teacherUid));
      const querySnapshot = await getDocs(q);
      const roomsLoaded = [];
      querySnapshot.forEach((doc) => roomsLoaded.push({ id: doc.id, ...doc.data() }));
      setMyRooms(roomsLoaded);
    } catch (error) {
      showMessage("Failed to load assigned rooms.", "error");
    }
  };

  const openRoom = async (room) => {
    setActiveRoom(room);
    setCurrentPage(1);
    
    const fullRoomName = `Grade ${room.grade} - ${room.name}`;
    await fetchStudents(fullRoomName);
    setCurrentView("roster");
  };

  const fetchStudents = async (fullRoomName) => {
    try {
      const q = query(collection(db, "students"), where("room", "==", fullRoomName));
      const querySnapshot = await getDocs(q);
      const loadedStudents = [];
      querySnapshot.forEach((doc) => loadedStudents.push({ id: doc.id, ...doc.data() }));
      
      loadedStudents.sort((a, b) => a.lastName.localeCompare(b.lastName));
      setStudents(loadedStudents);
    } catch (error) {
      showMessage("Failed to load students.", "error");
    }
  };

  const markAttendance = async (student, status) => {
    try {
      const fullRoomName = `Grade ${activeRoom.grade} - ${activeRoom.name}`;

      await addDoc(collection(db, "attendance"), {
        studentId: student.id,
        studentLRN: student.lrn, // Links to Parent Account
        studentName: student.fullName,
        room: fullRoomName, 
        status: status,
        timestamp: serverTimestamp(),
        date: new Date().toLocaleDateString()
      });
      showMessage(`${student.firstName} marked as ${status}.`);
    } catch (error) {
      showMessage(`Failed to mark attendance.`, "error");
    }
  };

  // --- Grades Logic ---
  const openGradesView = async (student) => {
    setSelectedStudent(student);
    setCurrentView("grades");
    await fetchStudentGrades(student.lrn);
  };

  const fetchStudentGrades = async (lrn) => {
    try {
      const q = query(collection(db, "grades"), where("studentLRN", "==", lrn));
      const querySnapshot = await getDocs(q);
      const loadedGrades = [];
      querySnapshot.forEach((doc) => loadedGrades.push({ id: doc.id, ...doc.data() }));
      setStudentGrades(loadedGrades);
    } catch (error) {
      showMessage("Failed to load grades.", "error");
    }
  };

  const submitGrade = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "grades"), {
        studentId: selectedStudent.id,
        studentLRN: selectedStudent.lrn, // Crucial: Links to Parent Account!
        studentName: selectedStudent.fullName,
        subject: subject,
        quarter: quarter,
        score: Number(score),
        teacherId: auth.currentUser.uid,
        timestamp: serverTimestamp()
      });
      showMessage(`Grade saved for ${selectedStudent.firstName}!`);
      setScore("");
      fetchStudentGrades(selectedStudent.lrn); // Refresh the grade list instantly
    } catch (error) {
      showMessage("Failed to save grade.", "error");
    }
  };

  // --- Load Management (Pagination) ---
  const totalItems = students.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentStudents = students.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <SidebarLayout role="teacher">
      <style>{`
        .toast-popup { position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-100px); opacity: 0; background: white; padding: 12px 24px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; font-weight: 600; transition: all 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28); display: flex; align-items: center; }
        .toast-popup.show { transform: translateX(-50%) translateY(0); opacity: 1; }
        .toast-success { border-left: 6px solid #10b981; color: #065f46; }
        .toast-error { border-left: 6px solid #ef4444; color: #991b1b; }
        
        .student-link { color: #1877f2; font-weight: 600; cursor: pointer; text-decoration: none; padding: 5px 0; display: inline-block; transition: color 0.2s; }
        .student-link:hover { color: #1e3a8a; text-decoration: underline; }
      `}</style>

      <div className={`toast-popup ${feedback.show ? 'show' : ''} ${feedback.type === 'error' ? 'toast-error' : 'toast-success'}`}>
        {feedback.text}
      </div>

      {/* =========================================
          VIEW 1: ROOMS
      ========================================= */}
      {currentView === "rooms" && (
        <div className="card">
          <h3>My Assigned Classrooms</h3>
          <p className="subtext">Select a room to view your students and manage records.</p>
          
          {myRooms.length === 0 ? (
            <div className="empty-state">
              You have not been assigned to a room yet. Please contact the Admin.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '1rem' }}>
              {myRooms.map((room) => (
                <button 
                  key={room.id} 
                  className="btn-primary" 
                  style={{ flex: '1', minWidth: '200px', padding: '1.5rem', fontSize: '1.1rem', backgroundColor: '#1877f2' }} 
                  onClick={() => openRoom(room)}
                >
                  Grade {room.grade} - {room.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================
          VIEW 2: ROSTER
      ========================================= */}
      {currentView === "roster" && (
        <div className="card">
          <div className="breadcrumb">
            <span onClick={() => setCurrentView("rooms")} style={{ cursor: 'pointer', color: '#1877f2' }}>My Rooms</span> 
            <span> / Grade {activeRoom.grade} - {activeRoom.name}</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0 }}>Class Roster</h3>
            <button className="btn-primary" style={{ backgroundColor: '#10b981' }} onClick={() => setCurrentView("attendance")}>
              📅 Take Daily Attendance
            </button>
          </div>

          <p className="subtext" style={{ fontSize: '0.85rem' }}>Tap on a student's name to view and update their academic grades.</p>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Student Name (Tap for Grades)</th>
                  <th>LRN Number</th>
                </tr>
              </thead>
              <tbody>
                {currentStudents.length === 0 ? (
                  <tr><td colSpan="2" className="empty-state">No students have been assigned to this room yet.</td></tr>
                ) : (
                  currentStudents.map(student => (
                    <tr key={student.id}>
                      <td>
                        {/* Clickable student name to open Grades view */}
                        <div className="student-link" onClick={() => openGradesView(student)}>
                          {student.lastName}, {student.firstName}
                        </div>
                      </td>
                      <td style={{ color: '#6b7280' }}>{student.lrn}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Load Management Updated to 10/100 Format */}
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
        </div>
      )}

      {/* =========================================
          VIEW 3: ATTENDANCE
      ========================================= */}
      {currentView === "attendance" && (
        <div className="card">
          <div className="breadcrumb">
            <span onClick={() => setCurrentView("rooms")} style={{ cursor: 'pointer', color: '#1877f2' }}>My Rooms</span> / 
            <span onClick={() => setCurrentView("roster")} style={{ cursor: 'pointer', color: '#1877f2' }}> {activeRoom.name}</span> / 
            <span> Attendance</span>
          </div>
          
          <h3 style={{ marginBottom: '0.5rem' }}>Daily Attendance</h3>
          <p className="subtext">Tap present or absent to instantly notify the parent's app.</p>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentStudents.length === 0 ? (
                  <tr><td colSpan="2" className="empty-state">No students available.</td></tr>
                ) : (
                  currentStudents.map(student => (
                    <tr key={student.id}>
                      <td style={{ fontWeight: '600' }}>{student.lastName}, {student.firstName}</td>
                      <td style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn-outline" style={{ color: '#10b981', borderColor: '#10b981', flex: 1 }} onClick={() => markAttendance(student, 'Present')}>
                          Present
                        </button>
                        <button className="btn-outline" style={{ color: '#ef4444', borderColor: '#ef4444', flex: 1 }} onClick={() => markAttendance(student, 'Absent')}>
                          Absent
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
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
        </div>
      )}

      {/* =========================================
          VIEW 4: GRADES
      ========================================= */}
      {currentView === "grades" && selectedStudent && (
        <div className="card">
          <div className="breadcrumb">
            <span onClick={() => setCurrentView("roster")} style={{ cursor: 'pointer', color: '#1877f2' }}>← Back to Roster</span>
          </div>
          
          <h3>Academic Record: {selectedStudent.firstName} {selectedStudent.lastName}</h3>
          
          <div className="table-responsive" style={{ marginBottom: '2rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Quarter</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {studentGrades.length === 0 ? (
                  <tr><td colSpan="3" className="empty-state">No grades recorded yet.</td></tr>
                ) : (
                  studentGrades.map(g => (
                    <tr key={g.id}>
                      <td>{g.subject}</td>
                      <td>{g.quarter}</td>
                      <td style={{ fontWeight: 'bold', color: '#3b82f6', fontSize: '1.1rem' }}>{g.score}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', marginBottom: '1.5rem' }} />

          <h3>Add Grade</h3>
          <form onSubmit={submitGrade} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '400px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.875rem', fontWeight: '600' }}>
              Subject
              <select className="auth-input" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="Mathematics">Mathematics</option>
                <option value="Science">Science</option>
                <option value="English">English</option>
                <option value="History">History</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.875rem', fontWeight: '600' }}>
              Quarter
              <select className="auth-input" value={quarter} onChange={(e) => setQuarter(e.target.value)}>
                <option value="Q1">Q1</option>
                <option value="Q2">Q2</option>
                <option value="Q3">Q3</option>
                <option value="Q4">Q4</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.875rem', fontWeight: '600' }}>
              Score (Percentage)
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="number" min="0" max="100" className="auth-input" value={score} onChange={(e) => setScore(e.target.value)} required />
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#4b5563' }}>%</span>
              </div>
            </label>
            <button type="submit" className="btn-primary">Save Grade</button>
          </form>
        </div>
      )}
    </SidebarLayout>
  );
}