import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase/firebase";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const EyeOpenIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeClosedIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Bypass Forgot Password States
  const [isResetMode, setIsResetMode] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));

          if (userDoc.exists()) {
            const role = userDoc.data().role;
            if (role === "teacher") {
              navigate("/teacher/home", { replace: true });
            } else if (role === "parent") {
              navigate("/parent/home", { replace: true });
            } else if (role === "admin") {
              navigate("/admin/home", { replace: true });
            } else {
              await signOut(auth);
              setError("Account role is invalid. Contact your school administrator.");
              setLoading(false);
            }
          } else {
            await signOut(auth);
            setError("Account not found or has been deleted. Contact your school administrator.");
            setLoading(false);
          }
        } catch (err) {
          console.error("Role check error:", err);
          await signOut(auth);
          setError("Unable to verify account permissions.");
          setLoading(false);
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
    setSuccessMsg("");
    setLoading(true);

    try {
      const cleanedEmail = email.trim();
      await signInWithEmailAndPassword(auth, cleanedEmail, password);
    } catch (err) {
      console.error("Login Error:", err);
      setError(`Firebase Error: ${err.code || "Failed to sign in"}`);
      setLoading(false);
    }
  };

  // Step 1 of Forgot Password: Require email first & verify it exists in DB
  const handleForgotPasswordClick = async () => {
    setError("");
    setSuccessMsg("");

    const cleanedEmail = email.trim();
    if (!cleanedEmail) {
      setError("Please enter your email address first to verify.");
      return;
    }

    setVerifyingEmail(true);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", email: cleanedEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Email not found in the database.");
      }

      setNewPassword("");
      setConfirmPassword("");
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setIsResetMode(true);
    } catch (err) {
      console.error("Verify Email Error:", err);
      setError(err.message || "Failed to verify email.");
    } finally {
      setVerifyingEmail(false);
    }
  };

  // Step 2 of Forgot Password: Save new password directly in Firebase Auth
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset",
          email: email.trim(),
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password.");
      }

      setIsResetMode(false);
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMsg("Password updated successfully! You can now sign in with your new password.");
    } catch (err) {
      console.error("Password Update Error:", err);
      setError(err.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setIsResetMode(false);
    setError("");
    setSuccessMsg("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const eyeBtnStyle = {
    position: "absolute",
    right: "10px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2 className="auth-title">
          {isResetMode ? "Change Password" : "Welcome to Smart PTA"}
        </h2>

        {!isResetMode && deferredPrompt && (
          <div style={{ marginBottom: "1.5rem", padding: "1rem", backgroundColor: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe", textAlign: "center" }}>
            <p style={{ margin: "0 0 10px 0", fontSize: "0.875rem", color: "#1e3a8a", fontWeight: "600" }}>
              For the best experience, install our native app:
            </p>
            <button
              onClick={handleInstallApp}
              className="btn-primary"
              style={{ width: "100%", backgroundColor: "#10b981", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              Download App
            </button>
          </div>
        )}

        {error && (
          <div style={{ color: "#dc2626", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "10px", marginBottom: "1rem", textAlign: "center", fontWeight: "500", fontSize: "0.875rem", wordWrap: "break-word" }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{ color: "#065f46", backgroundColor: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "6px", padding: "10px", marginBottom: "1rem", textAlign: "center", fontWeight: "500", fontSize: "0.875rem", wordWrap: "break-word" }}>
            {successMsg}
          </div>
        )}

        {!isResetMode ? (
          <form className="auth-form" onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email Address"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div style={{ position: "relative", width: "100%" }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                className="auth-input"
                style={{ width: "100%", paddingRight: "42px", boxSizing: "border-box" }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={eyeBtnStyle}
              >
                {showPassword ? <EyeOpenIcon /> : <EyeClosedIcon />}
              </button>
            </div>

            <div style={{ textAlign: "right", marginTop: "-6px", marginBottom: "6px" }}>
              <button
                type="button"
                onClick={handleForgotPasswordClick}
                disabled={verifyingEmail || loading}
                style={{
                  background: "none",
                  border: "none",
                  color: "#1877f2",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {verifyingEmail ? "Verifying email..." : "Forgot Password?"}
              </button>
            </div>

            <button type="submit" className="auth-button" disabled={loading || verifyingEmail}>
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handlePasswordChange}>
            <div style={{ padding: "8px 12px", backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px", fontSize: "0.85rem", color: "#1e3a8a", marginBottom: "4px", textAlign: "center" }}>
              Verified account: <strong>{email.trim()}</strong>
            </div>

            <div style={{ position: "relative", width: "100%" }}>
              <input
                type={showNewPassword ? "text" : "password"}
                placeholder="New Password (min. 6 characters)"
                className="auth-input"
                style={{ width: "100%", paddingRight: "42px", boxSizing: "border-box" }}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                style={eyeBtnStyle}
              >
                {showNewPassword ? <EyeOpenIcon /> : <EyeClosedIcon />}
              </button>
            </div>

            <div style={{ position: "relative", width: "100%" }}>
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm New Password"
                className="auth-input"
                style={{ width: "100%", paddingRight: "42px", boxSizing: "border-box" }}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                style={eyeBtnStyle}
              >
                {showConfirmPassword ? <EyeOpenIcon /> : <EyeClosedIcon />}
              </button>
            </div>

            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? "Updating Password..." : "Update Password"}
            </button>

            <button
              type="button"
              onClick={handleBackToLogin}
              style={{
                marginTop: "8px",
                background: "none",
                border: "none",
                color: "#4b5563",
                fontSize: "0.875rem",
                fontWeight: "600",
                cursor: "pointer",
                width: "100%",
                textAlign: "center",
              }}
            >
              ← Back to Sign In
            </button>
          </form>
        )}

        <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.875rem", color: "#6b7280" }}>
          Contact your school administrator for account credentials.
        </p>
      </div>
    </div>
  );
}