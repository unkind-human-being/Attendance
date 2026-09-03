import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../../firebase/attendanceService";

export default function Login() {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [feedback, setFeedback] = useState({ text: "", type: "" });

  const handleChange = (e) => setCredentials({ ...credentials, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ text: "", type: "" });

    const response = await loginUser(credentials.email, credentials.password);

    if (response.success) {
      const userRole = response.profile?.role;
      
      // Route based on role
      if (userRole === "admin") navigate("/admin/home");
      else if (userRole === "teacher") navigate("/teacher/home");
      else if (userRole === "parent") navigate("/parent/home");
      else setFeedback({ text: "Invalid user role assigned.", type: "error" });
    } else {
      setFeedback({ text: response.error, type: "error" });
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2 className="auth-title">Welcome to Smart PTA</h2>
        
        {feedback.text && (
          <div style={{ padding: '12px 16px', marginBottom: '1rem', borderRadius: '8px', fontSize: '0.875rem', textAlign: 'center', backgroundColor: feedback.type === 'error' ? '#fee2e2' : '#d1fae5', color: feedback.type === 'error' ? '#dc2626' : '#059669' }}>
            {feedback.text}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <input className="auth-input" type="email" name="email" placeholder="Email Address" value={credentials.email} onChange={handleChange} required />
          <input className="auth-input" type="password" name="password" placeholder="Password" value={credentials.password} onChange={handleChange} required />
          <button className="btn-primary" type="submit">Sign In</button>
        </form>
        
        {/* Registration Link Completely Removed */}
        <div style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.875rem", color: "#6b7280" }}>
          Contact your school administrator for account access.
        </div>
      </div>
    </div>
  );
}