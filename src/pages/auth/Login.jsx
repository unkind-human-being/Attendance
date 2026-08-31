import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginUser } from "../../firebase/attendanceService";

export default function Login() {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const response = await loginUser(credentials.email, credentials.password);

    if (response.success) {
      const userRole = response.profile?.role;
      
      if (userRole === "teacher") {
        navigate("/teacher/home"); 
      } else if (userRole === "parent") {
        navigate("/parent/home"); 
      } else {
        setError("Invalid user role assigned.");
      }
    } else {
      setError(response.error);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2 className="auth-title">Welcome to Smart PTA</h2>
        
        {error && <div className="auth-error">{error}</div>}
        
        <form className="auth-form" onSubmit={handleSubmit}>
          <input 
            className="auth-input"
            type="email" 
            name="email" 
            placeholder="Email Address" 
            value={credentials.email} 
            onChange={handleChange} 
            required 
          />
          
          <input 
            className="auth-input"
            type="password" 
            name="password" 
            placeholder="Password" 
            value={credentials.password} 
            onChange={handleChange} 
            required 
          />

          <button className="auth-button" type="submit">Sign In</button>
        </form>

        <div className="auth-footer">
          Don't have an account? <Link className="auth-link" to="/register">Register here</Link>
        </div>
      </div>
    </div>
  );
}