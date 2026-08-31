import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { db } from "../firebase/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function SidebarLayout({ children, role }) {
  // Default closed on mobile, open on desktop
  const [isOpen, setIsOpen] = useState(window.innerWidth > 768);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location.pathname);

  // Auto-close sidebar on mobile when a link is clicked
  const handleMobileNav = () => {
    if (window.innerWidth <= 768) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    locationRef.current = location.pathname;
    if (location.pathname === "/parent/attendance") {
      setUnreadCount(0);
      localStorage.setItem("lastCheckedAttendance", Date.now().toString());
    }
  }, [location.pathname]);

  useEffect(() => {
    if (role !== "parent") return;
    const savedChild = localStorage.getItem("joinedChild");
    if (!savedChild) return;
    
    const child = JSON.parse(savedChild);
    const q = query(collection(db, "attendance"), where("studentId", "==", child.id));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let newUnread = 0;
      const lastChecked = parseInt(localStorage.getItem("lastCheckedAttendance") || "0");

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const docData = change.doc.data();
          const recordTime = docData.timestamp?.seconds ? docData.timestamp.seconds * 1000 : Date.now();
          if (recordTime > lastChecked && location.pathname !== "/parent/attendance") {
            newUnread++;
          }
        }
      });

      if (newUnread > 0) setUnreadCount((prev) => prev + newUnread);
    });

    return () => unsubscribe();
  }, [role, location.pathname]); 

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <div className="dashboard-layout">
      
      {/* Mobile Dark Overlay */}
      {isOpen && window.innerWidth <= 768 && (
        <div className="sidebar-overlay" onClick={() => setIsOpen(false)}></div>
      )}

      <div className={`sidebar ${isOpen ? "" : "closed"}`}>
        <div className="sidebar-title">Smart PTA</div>
        <nav className="sidebar-nav">
          
          {role === "teacher" && (
            <Link to="/teacher/home" onClick={handleMobileNav} className="sidebar-link">My Rooms</Link>
          )}

          {role === "parent" && (
            <>
              <Link to="/parent/home" onClick={handleMobileNav} className="sidebar-link">Join Room</Link>
              <Link to="/parent/attendance" onClick={handleMobileNav} className="sidebar-link" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Attendance
                {unreadCount > 0 && (
                  <span style={{ backgroundColor: '#ef4444', color: 'white', borderRadius: '50%', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    {unreadCount}
                  </span>
                )}
              </Link>
              <Link to="/parent/grades" onClick={handleMobileNav} className="sidebar-link">Grades</Link>
            </>
          )}

          <button onClick={handleLogout} className="sidebar-link" style={{ background: "none", border: "none", textAlign: "left", cursor: "pointer", padding: "0.5rem", marginTop: "2rem" }}>
            Logout
          </button>
        </nav>
      </div>

      <div className="main-content">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setIsOpen(!isOpen)}>☰</button>
          <h2>{role === "teacher" ? "Teacher Portal" : "Parent Portal"}</h2>
        </header>
        <main className="content-area">
          {children}
        </main>
      </div>
    </div>
  );
}