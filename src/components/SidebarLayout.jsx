import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { db } from "../firebase/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

// --- Clean SVG Icons ---
const HomeIcon = () => (
  <svg viewBox="0 0 24 24" className="tab-icon"><path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" /><path d="M12 5.432l8.159 8.159c.03.03.04.07.04.114v8.045a2.25 2.25 0 01-2.25 2.25h-3.45a.75.75 0 01-.75-.75v-4.875a.375.375 0 00-.375-.375H10.59a.375.375 0 00-.375.375v4.875a.75.75 0 01-.75.75H5.805a2.25 2.25 0 01-2.25-2.25v-8.045c0-.045.01-.084.04-.114L12 5.432z" /></svg>
);
const BellIcon = () => (
  <svg viewBox="0 0 24 24" className="tab-icon"><path d="M5.85 3.5a.75.75 0 00-1.117-1 9.719 9.719 0 00-2.348 4.876.75.75 0 001.479.248A8.219 8.219 0 015.85 3.5zM19.267 2.5a.75.75 0 10-1.118 1 8.22 8.22 0 011.987 4.124.75.75 0 001.48-.248A9.72 9.72 0 0019.266 2.5z" /><path fillRule="evenodd" d="M12 2.25A6.75 6.75 0 005.25 9v.878a4.99 4.99 0 01-3.152 4.635.75.75 0 00-.435.952c.07.24.278.436.533.436H20.8a.75.75 0 00.533-.436.75.75 0 00-.435-.952 4.99 4.99 0 01-3.152-4.635V9A6.75 6.75 0 0012 2.25zm.375 16.5h-1.5a.75.75 0 00-.75.75c0 1.2431.009 2.25 1.5 2.25s1.5-1.0069 1.5-2.25a.75.75 0 00-.75-.75z" clipRule="evenodd" /></svg>
);
const ChartIcon = () => (
  <svg viewBox="0 0 24 24" className="tab-icon"><path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 018.25-8.25.75.75 0 01.75.75v6.75H18a.75.75 0 01.75.75 8.25 8.25 0 01-16.5 0z" clipRule="evenodd" /><path fillRule="evenodd" d="M12.75 3a.75.75 0 01.75-.75 8.25 8.25 0 018.25 8.25.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75V3z" clipRule="evenodd" /></svg>
);

export default function SidebarLayout({ children, role }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location.pathname);

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
    <div className="app-shell">
      
      {/* Top Bar (Facebook Header Style) */}
      <header className="top-header">
        <h1>Smart PTA</h1>
        <button onClick={handleLogout} className="logout-btn">Log Out</button>
      </header>

      {/* Hide the Icon Tab Bar completely for the Admin role */}
      {role !== "admin" && (
        <nav className="tab-nav">
          {/* TEACHER TABS */}
          {role === "teacher" && (
            <Link to="/teacher/home" className={`tab-item ${location.pathname === "/teacher/home" ? "active" : ""}`}>
              <HomeIcon />
            </Link>
          )}

          {/* PARENT TABS */}
          {role === "parent" && (
            <>
              <Link to="/parent/home" className={`tab-item ${location.pathname === "/parent/home" ? "active" : ""}`}>
                <HomeIcon />
              </Link>
              <Link to="/parent/attendance" className={`tab-item ${location.pathname === "/parent/attendance" ? "active" : ""}`}>
                <BellIcon />
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount}</span>
                )}
              </Link>
              <Link to="/parent/grades" className={`tab-item ${location.pathname === "/parent/grades" ? "active" : ""}`}>
                <ChartIcon />
              </Link>
            </>
          )}
        </nav>
      )}

      {/* Main Page Content */}
      <main className="content-area">
        {children}
      </main>
      
    </div>
  );
}