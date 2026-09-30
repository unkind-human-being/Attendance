import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase/firebase";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    // Lock the session: If already logged in, redirect and replace history so "Back" doesn't work
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const role = userDoc.data().role;
          if (role === "teacher") navigate("/teacher/home", { replace: true });
          else if (role === "parent") navigate("/parent/home", { replace: true });
          else navigate("/admin/home", { replace: true }); 
        } else {
          navigate("/admin/home", { replace: true });
        }
      }
    });

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault(); 
      setDeferredPrompt(e); 
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      unsubscribe();
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, [navigate]);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null); 
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const cleanedEmail = email.trim();
      // Notice we do not navigate here anymore; the onAuthStateChanged listener above handles it automatically
      await signInWithEmailAndPassword(auth, cleanedEmail, password);
    } catch (err) {
      console.error("Login Error:", err);
      setError(`Firebase Error: ${err.code || "Failed to sign in"}`);
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2 className="auth-title">Welcome to Smart PTA</h2>
        
        {deferredPrompt && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '0.875rem', color: '#1e3a8a', fontWeight: '600' }}>
              For the best experience, install our native app:
            </p>
            <button 
              onClick={handleInstallApp} 
              className="btn-primary" 
              style={{ width: '100%', backgroundColor: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
               Download App
            </button>
          </div>
        )}

        {error && <div style={{ color: "#dc2626", marginBottom: "1rem", textAlign: "center", fontWeight: "500", fontSize: "0.9rem", wordWrap: "break-word" }}>{error}</div>}
        
        <form className="auth-form" onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email Address"
            className="auth-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="auth-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>
        
        <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.875rem", color: "#6b7280" }}>
          Contact your school administrator for account credentials.
        </p>
      </div>
    </div>
  );
}