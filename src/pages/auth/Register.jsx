import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerUser } from "../../firebase/attendanceService";

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "teacher", 
    studentName: ""  
  });
  const [feedback, setFeedback] = useState({ text: "", type: "" });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ text: "", type: "" });

    const additionalData = formData.role === "parent" 
      ? { studentName: formData.studentName } 
      : {};

    const response = await registerUser(
      formData.email,
      formData.password,
      formData.fullName,
      formData.role,
      additionalData
    );

    if (response.success) {
      setFeedback({ text: "Registration successful! Redirecting...", type: "success" });
      setTimeout(() => {
        navigate("/login");
      }, 2000); // Wait 2 seconds so they can read the success message
    } else {
      setFeedback({ text: response.error, type: "error" });
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2 className="auth-title">Register for Smart PTA</h2>
        
        {/* Modern Feedback Banner */}
        {feedback.text && (
          <div style={{
            padding: '12px 16px', marginBottom: '1rem', borderRadius: '8px', fontSize: '0.875rem', textAlign: 'center',
            backgroundColor: feedback.type === 'error' ? '#fee2e2' : '#d1fae5',
            color: feedback.type === 'error' ? '#dc2626' : '#059669'
          }}>
            {feedback.text}
          </div>
        )}
        
        <form className="auth-form" onSubmit={handleSubmit}>
          <select 
            className="auth-input" 
            name="role" 
            value={formData.role} 
            onChange={handleChange} 
            required
          >
            <option value="teacher">Teacher / Adviser</option>
            <option value="parent">Parent</option>
          </select>

          <input 
            className="auth-input"
            type="text" 
            name="fullName" 
            placeholder="Full Name" 
            value={formData.fullName} 
            onChange={handleChange} 
            required 
          />
          
          <input 
            className="auth-input"
            type="email" 
            name="email" 
            placeholder="Email Address" 
            value={formData.email} 
            onChange={handleChange} 
            required 
          />
          
          <input 
            className="auth-input"
            type="password" 
            name="password" 
            placeholder="Password" 
            value={formData.password} 
            onChange={handleChange} 
            required 
          />

          {formData.role === "parent" && (
            <input 
              className="auth-input"
              type="text" 
              name="studentName" 
              placeholder="Name of Student" 
              value={formData.studentName} 
              onChange={handleChange} 
              required 
            />
          )}

          <button className="auth-button" type="submit">Create Account</button>
        </form>
        
        <div className="auth-footer">
          Already have an account? <Link className="auth-link" to="/login">Login here</Link>
        </div>
      </div>
    </div>
  );
}