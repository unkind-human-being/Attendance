import { useState, useEffect } from "react";
import SidebarLayout from "../../components/SidebarLayout";
import { addStudent, getStudentsBySection, markAttendance, addGradeRecord, getStudentGrades } from "../../firebase/attendanceService";
import { db } from "../../firebase/firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";

export default function TeacherHome() {
  const [currentView, setCurrentView] = useState("rooms");
  const [rooms, setRooms] = useState([]);
  const [activeSection, setActiveSection] = useState(null);
  const [students, setStudents] = useState([]);
  
  // UI Feedback Banner
  const [feedback, setFeedback] = useState({ text: "", type: "" });

  const [newGrade, setNewGrade] = useState("1");
  const [newSection, setNewSection] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  
  // Grade View State
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentGrades, setStudentGrades] = useState([]); // Holds the current student's grades
  const [subject, setSubject] = useState("Mathematics");
  const [quarter, setQuarter] = useState("Q1");
  const [score, setScore] = useState("");

  const showMessage = (text, type = "success") => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback({ text: "", type: "" }), 3000);
  };

  useEffect(() => {
    const fetchRooms = async () => {
      const querySnapshot = await getDocs(collection(db, "rooms"));
      const loadedRooms = [];
      querySnapshot.forEach((doc) => loadedRooms.push({ id: doc.id, ...doc.data() }));
      
      // Sort rooms by grade level
      loadedRooms.sort((a, b) => a.grade - b.grade);
      setRooms(loadedRooms);
    };
    fetchRooms();
  }, []);

  const handleAddSection = async (e) => {
    e.preventDefault();
    if (newSection.trim() !== "") {
      try {
        const roomData = { grade: newGrade, name: newSection, createdBy: "Teacher" };
        await addDoc(collection(db, "rooms"), roomData);
        setRooms([...rooms, roomData]);
        setNewSection("");
        showMessage("Section created successfully!");
      } catch (error) {
        showMessage("Failed to create room.", "error");
      }
    }
  };

  const openRoom = async (room) => {
    setActiveSection(room);
    const response = await getStudentsBySection(room.name);
    if (response.success) setStudents(response.students);
    setCurrentView("roster");
  };

  const handleAddNewStudent = async (e) => {
    e.preventDefault();
    const response = await addStudent({ fullName: newStudentName, gradeLevel: activeSection.grade, section: activeSection.name });
    if (response.success) {
      setNewStudentName("");
      const refresh = await getStudentsBySection(activeSection.name);
      setStudents(refresh.students);
      showMessage("Student added successfully!");
    } else {
      showMessage("Error adding student.", "error");
    }
  };

  const submitAttendance = async (studentId, studentName, status) => {
    const response = await markAttendance(studentId, studentName, status, activeSection.name, "teacher-id");
    if (response.success) {
      showMessage(`${studentName} marked as ${status}.`);
    } else {
      showMessage(`Failed to mark attendance for ${studentName}.`, "error");
    }
  };

  // --- NEW: Fetch grades when opening the grade view ---
  const openGradesView = async (student) => {
    setSelectedStudent(student);
    setCurrentView("grades");
    const response = await getStudentGrades(student.id);
    if (response.success) {
      setStudentGrades(response.grades);
    }
  };

  const submitGrade = async (e) => {
    e.preventDefault();
    const response = await addGradeRecord(selectedStudent.id, subject, quarter, Number(score), "teacher-id");
    if (response.success) {
      showMessage(`Grade saved for ${selectedStudent.fullName}!`);
      setScore("");
      
      // Refresh the displayed grades instantly so the teacher sees the update
      const refreshRes = await getStudentGrades(selectedStudent.id);
      if (refreshRes.success) setStudentGrades(refreshRes.grades);
    } else {
      showMessage("Failed to save grade.", "error");
    }
  };

  return (
    <SidebarLayout role="teacher">
      
      {/* Feedback Banner */}
      {feedback.text && (
        <div style={{
          padding: '12px 16px', marginBottom: '1rem', borderRadius: '8px', fontWeight: '500',
          backgroundColor: feedback.type === 'error' ? '#fee2e2' : '#d1fae5',
          color: feedback.type === 'error' ? '#991b1b' : '#065f46',
          border: `1px solid ${feedback.type === 'error' ? '#f87171' : '#34d399'}`
        }}>
          {feedback.text}
        </div>
      )}

      {/* VIEW 1: ROOMS */}
      {currentView === "rooms" && (
        <>
          <div className="card">
            <h3>Create a New Room</h3>
            <form onSubmit={handleAddSection} className="flex-row">
              <select className="auth-input" style={{ width: "150px" }} value={newGrade} onChange={(e) => setNewGrade(e.target.value)}>
                {[1, 2, 3, 4, 5, 6].map(num => <option key={num} value={num}>Grade {num}</option>)}
              </select>
              <input className="auth-input" style={{ width: "250px" }} placeholder="Section Name" value={newSection} onChange={(e) => setNewSection(e.target.value)} required />
              <button className="auth-button" type="submit">Create Room</button>
            </form>
          </div>

          <div className="card">
            <h3>My Adviser Rooms</h3>
            {rooms.length === 0 ? <p>No rooms created yet.</p> : (
              <div className="flex-row">
                {rooms.map((room, idx) => (
                  <button key={idx} className="btn-secondary" onClick={() => openRoom(room)}>
                    Grade {room.grade} - {room.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* VIEW 2: ROSTER */}
      {currentView === "roster" && (
        <div className="card">
          <button className="btn-secondary" style={{ marginBottom: '1rem' }} onClick={() => setCurrentView("rooms")}>← Back</button>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
            <h3>Students in {activeSection.name}</h3>
            <button className="btn-primary" onClick={() => setCurrentView("attendance")}>📅 Mark Attendance</button>
          </div>

          <form onSubmit={handleAddNewStudent} className="flex-row" style={{ marginBottom: '1rem' }}>
            <input className="auth-input" placeholder="New Student Name" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} required />
            <button className="btn-secondary" type="submit">+ Add Student</button>
          </form>

          <div className="table-responsive">
            <table>
              <thead><tr><th>Student Name (Click to view/edit grades)</th></tr></thead>
              <tbody>
                {students.map(student => (
                  <tr key={student.id}>
                    <td>
                      <button className="sidebar-link" style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} 
                        onClick={() => openGradesView(student)}>
                        {student.fullName}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: ATTENDANCE */}
      {currentView === "attendance" && (
        <div className="card">
          <button className="btn-secondary" style={{ marginBottom: '1rem' }} onClick={() => setCurrentView("roster")}>← Back</button>
          <h3>Mark Attendance ({activeSection.name})</h3>
          
          <div className="table-responsive">
            <table>
              <thead><tr><th>Name</th><th>Action</th></tr></thead>
              <tbody>
                {students.map(student => (
                  <tr key={student.id}>
                    <td>{student.fullName}</td>
                    <td>
                      <button className="btn-secondary" style={{ marginRight: '5px' }} onClick={() => submitAttendance(student.id, student.fullName, 'Present')}>Present</button>
                      <button className="btn-secondary" onClick={() => submitAttendance(student.id, student.fullName, 'Absent')}>Absent</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 4: GRADES */}
      {currentView === "grades" && (
        <div className="card">
          <button className="btn-secondary" style={{ marginBottom: '1rem' }} onClick={() => setCurrentView("roster")}>← Back to Roster</button>
          
          <h3>Academic Record: {selectedStudent.fullName}</h3>
          
          {/* Display Current Grades */}
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
                  <tr><td colSpan="3" style={{ color: '#6b7280' }}>No grades recorded yet.</td></tr>
                ) : (
                  studentGrades.map(g => (
                    <tr key={g.id}>
                      <td>{g.subject}</td>
                      <td>{g.quarter}</td>
                      <td style={{ fontWeight: 'bold', color: '#3b82f6' }}>{g.score}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', marginBottom: '1.5rem' }} />

          {/* Form to Add/Update Grades */}
          <h3>Add / Update Grade</h3>
          <form onSubmit={submitGrade} className="auth-form" style={{ maxWidth: '400px' }}>
            <label>Subject:
              <select className="auth-input" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="Mathematics">Mathematics</option>
                <option value="Science">Science</option>
                <option value="English">English</option>
              </select>
            </label>
            <label>Quarter:
              <select className="auth-input" value={quarter} onChange={(e) => setQuarter(e.target.value)}>
                <option value="Q1">Q1</option>
                <option value="Q2">Q2</option>
                <option value="Q3">Q3</option>
                <option value="Q4">Q4</option>
              </select>
            </label>
            
            <label>Score (Percentage):
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="number" min="0" max="100" className="auth-input" value={score} onChange={(e) => setScore(e.target.value)} required style={{ width: '100px' }} />
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#4b5563' }}>%</span>
              </div>
            </label>
            
            <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>Save Grade</button>
          </form>
        </div>
      )}
    </SidebarLayout>
  );
}