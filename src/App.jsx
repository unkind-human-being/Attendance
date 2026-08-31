import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

// Teacher Pages
import TeacherHome from "./pages/teacher/TeacherHome";

// Parent Pages
import ParentHome from "./pages/parent/ParentHome";
import ParentAttendance from "./pages/parent/ParentAttendance";
import ParentGrades from "./pages/parent/ParentGrades";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Teacher Routes */}
        <Route path="/teacher/home" element={<TeacherHome />} />
        
        {/* Parent Routes */}
        <Route path="/parent/home" element={<ParentHome />} />
        <Route path="/parent/attendance" element={<ParentAttendance />} />
        <Route path="/parent/grades" element={<ParentGrades />} />
      </Routes>
    </Router>
  );
}

export default App;