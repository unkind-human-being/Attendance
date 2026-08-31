import { useState, useEffect } from "react";
import SidebarLayout from "../../components/SidebarLayout";
import { getStudentGrades } from "../../firebase/attendanceService";

export default function ParentGrades() {
  const [grades, setGrades] = useState([]);
  const [joinedChild, setJoinedChild] = useState(null);

  useEffect(() => {
    const savedChild = localStorage.getItem("joinedChild");
    if (savedChild) {
      const parsedChild = JSON.parse(savedChild);
      setJoinedChild(parsedChild);
      fetchGrades(parsedChild.id);
    }
  }, []);

  const fetchGrades = async (studentId) => {
    const gradeRes = await getStudentGrades(studentId);
    if (gradeRes.success) setGrades(gradeRes.grades);
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
        <h3>Academic Grades for {joinedChild.fullName}</h3>
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Quarter</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {grades.length === 0 ? <tr><td colSpan="3">No grades recorded yet.</td></tr> : null}
            {grades.map(g => (
              <tr key={g.id}>
                <td>{g.subject}</td>
                <td>{g.quarter}</td>
                {/* Added the % sign here and styled it */}
                <td style={{ fontWeight: 'bold', color: '#3b82f6' }}>{g.score}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SidebarLayout>
  );
}