import { useState, useEffect } from "react";
import SidebarLayout from "../../components/SidebarLayout";
import { db, firebaseConfig } from "../../firebase/firebase";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, setDoc } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";

export default function AdminHome() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Navigation State
  const [activeView, setActiveView] = useState("create-room"); 
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false); // Default is false so it waits to be clicked

  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  
  const [feedback, setFeedback] = useState({ text: "", type: "", show: false });
  
  const [formData, setFormData] = useState({
    firstName: "",
    middleInitial: "",
    lastName: "",
    email: "",
    password: "",
    assignedRoom: "",
    studentLRN: ""
  });

  const [roomForm, setRoomForm] = useState({
    grade: "1",
    section: "",
    assignedTeacherId: ""
  });

  const [roleFilter, setRoleFilter] = useState("teacher");
  const [gradeFilter, setGradeFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const showMessage = (text, type = "success") => {
    setFeedback({ text, type, show: true });
    setTimeout(() => setFeedback({ text: "", type: "", show: false }), 3500);
  };

  useEffect(() => {
    fetchUsers();
    fetchRooms();
  }, []);

  const fetchUsers = async () => {
    const querySnapshot = await getDocs(collection(db, "users"));
    const loadedUsers = [];
    querySnapshot.forEach((doc) => loadedUsers.push({ id: doc.id, ...doc.data() }));
    setUsers(loadedUsers);
  };

  const fetchRooms = async () => {
    const querySnapshot = await getDocs(collection(db, "rooms"));
    const loadedRooms = [];
    querySnapshot.forEach((doc) => loadedRooms.push({ id: doc.id, ...doc.data() }));
    loadedRooms.sort((a, b) => a.grade - b.grade);
    setRooms(loadedRooms);
  };

  const handleUserChange = (e) => {
    let { name, value } = e.target;
    
    // Auto capitalize and limit Middle Initial to 1 character
    if (name === "middleInitial") {
      value = value.toUpperCase().slice(0, 1);
    }
    
    // Enforce LRN to strictly be numbers only, up to 12 digits
    if (name === "studentLRN") {
      value = value.replace(/\D/g, '').slice(0, 12);
    }
    
    setFormData({ ...formData, [name]: value });
  };

  const handleCreateUser = async (e, role) => {
    e.preventDefault();
    try {
      // 1. Initialize Secondary App for Auth
      const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
      const secondaryAuth = getAuth(secondaryApp);
      
      // 2. Create the actual Firebase Authentication login credential
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
      const newUserId = userCredential.user.uid; 

      // 3. Format the name
      const formattedMI = formData.middleInitial ? `${formData.middleInitial}.` : "";
      const fullName = `${formData.firstName} ${formattedMI} ${formData.lastName}`.replace(/\s+/g, " ").trim();

      // 4. Prepare the database document
      const userData = {
        fullName,
        firstName: formData.firstName,
        middleInitial: formData.middleInitial,
        lastName: formData.lastName,
        email: formData.email,
        role: role,
        assignedRoom: role === "teacher" ? "" : formData.assignedRoom,
        ...(role === "parent" && { studentLRN: formData.studentLRN })
      };
      
      // 5. Save to Firestore using the exact Auth ID
      await setDoc(doc(db, "users", newUserId), userData);

      // 6. Sign out the secondary app to clean up (prevents Admin from being logged out)
      await signOut(secondaryAuth);

      showMessage(`${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully!`);
      
      setFormData({ firstName: "", middleInitial: "", lastName: "", email: "", password: "", assignedRoom: "", studentLRN: "" });
      fetchUsers();
    } catch (error) {
      console.error("Auth Error:", error);
      showMessage(error.message || "Error creating user.", "error");
    }
  };

  const handleDeleteUser = async (userId, name) => {
    if (window.confirm(`Are you sure you want to delete ${name}'s account?`)) {
      try {
        await deleteDoc(doc(db, "users", userId));
        showMessage("User deleted successfully.");
        fetchUsers();
      } catch (error) {
        showMessage("Failed to delete user.", "error");
      }
    }
  };

  const handleRoomChange = (e) => {
    setRoomForm({ ...roomForm, [e.target.name]: e.target.value });
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    try {
      const assignedTeacher = users.find(u => u.id === roomForm.assignedTeacherId);
      const teacherName = assignedTeacher ? `${assignedTeacher.firstName} ${assignedTeacher.lastName}` : "Unassigned";
      const newRoomName = `Grade ${roomForm.grade} - ${roomForm.section}`;

      const roomData = { 
        grade: roomForm.grade, 
        name: roomForm.section, 
        assignedTeacherId: roomForm.assignedTeacherId || "",
        assignedTeacherName: teacherName,
        createdBy: "Admin" 
      };

      await addDoc(collection(db, "rooms"), roomData);

      if (roomForm.assignedTeacherId) {
        const teacherDocRef = doc(db, "users", roomForm.assignedTeacherId);
        await updateDoc(teacherDocRef, { assignedRoom: newRoomName });
      }

      showMessage(`${newRoomName} created successfully!`);
      setRoomForm({ grade: "1", section: "", assignedTeacherId: "" });
      fetchRooms(); 
      fetchUsers(); 
    } catch (error) {
      showMessage("Failed to create room.", "error");
    }
  };

  const handleDeleteRoom = async (roomId, name) => {
    if (window.confirm(`Are you sure you want to delete the room ${name}?`)) {
      try {
        await deleteDoc(doc(db, "rooms", roomId));
        showMessage("Room deleted successfully.");
        fetchRooms();
      } catch (error) {
        showMessage("Failed to delete room.", "error");
      }
    }
  };

  // --- Filtering & Sorting ---
  let filteredUsers = users.filter(u => u.role === roleFilter);

  if (roleFilter === "parent") {
    if (gradeFilter) filteredUsers = filteredUsers.filter(u => u.assignedRoom?.includes(`Grade ${gradeFilter}`));
    if (sectionFilter) filteredUsers = filteredUsers.filter(u => u.assignedRoom?.includes(sectionFilter));
  }

  filteredUsers.sort((a, b) => {
    const nameA = (a.lastName || a.fullName || "").toLowerCase();
    const nameB = (b.lastName || b.fullName || "").toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const totalItems = filteredUsers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentDisplayedUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);

  const availableSections = gradeFilter ? rooms.filter(r => r.grade.toString() === gradeFilter) : rooms;

  return (
    <SidebarLayout role="admin">
      <style>{`
        .admin-nav-bar { background: transparent; padding: 0 0 15px 0; display: flex; align-items: center; justify-content: flex-start; }
        .admin-burger { font-size: 1rem; background: #ffffff; border: 1px solid #d1d5db; padding: 8px 16px; border-radius: 8px; cursor: pointer; color: #111827; display: flex; align-items: center; gap: 8px; font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: background 0.2s; }
        .admin-burger:hover { background: #f3f4f6; }
        .admin-drawer { position: fixed; top: 0; left: 0; height: 100vh; width: 260px; background: white; z-index: 100; box-shadow: 4px 0 15px rgba(0,0,0,0.1); transform: translateX(-100%); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column; overflow-y: auto; }
        .admin-drawer.open { transform: translateX(0); }
        .admin-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 90; display: none; backdrop-filter: blur(2px); }
        .admin-overlay.open { display: block; }
        .drawer-header { padding: 1.5rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
        
        .drawer-link { padding: 1.25rem 1.5rem; cursor: pointer; border-bottom: 1px solid #f3f4f6; color: #374151; font-weight: 500; transition: all 0.2s; display: flex; justify-content: space-between; align-items: center; }
        .drawer-link:hover { background: #f9fafb; color: #1877f2; }
        .drawer-link.active { background: #eff6ff; color: #1877f2; border-left: 4px solid #1877f2; padding-left: calc(1.5rem - 4px); }
        
        .sub-menu { background-color: #f9fafb; display: flex; flex-direction: column; }
        .sub-drawer-link { padding: 1rem 1.5rem 1rem 2.5rem; cursor: pointer; border-bottom: 1px solid #e5e7eb; color: #4b5563; font-size: 0.9rem; transition: all 0.2s; }
        .sub-drawer-link:hover { color: #1877f2; }
        .sub-drawer-link.active { background: #eff6ff; color: #1877f2; font-weight: 600; border-left: 4px solid #1877f2; padding-left: calc(2.5rem - 4px); }
        
        /* Floating Toast Notification */
        .toast-popup { position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-100px); opacity: 0; background: white; padding: 12px 24px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; font-weight: 600; transition: all 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28); display: flex; align-items: center; gap: 10px; }
        .toast-popup.show { transform: translateX(-50%) translateY(0); opacity: 1; }
        .toast-success { border-left: 6px solid #10b981; color: #065f46; }
        .toast-error { border-left: 6px solid #ef4444; color: #991b1b; }
      `}</style>

      {/* Floating Pop-up Notification */}
      <div className={`toast-popup ${feedback.show ? 'show' : ''} ${feedback.type === 'error' ? 'toast-error' : 'toast-success'}`}>
        {feedback.text}
      </div>

      <div className="admin-nav-bar">
        <button className="admin-burger" onClick={() => setIsDrawerOpen(true)}>
          ☰ Admin Menu
        </button>
      </div>

      <div className={`admin-overlay ${isDrawerOpen ? "open" : ""}`} onClick={() => setIsDrawerOpen(false)}></div>
      <div className={`admin-drawer ${isDrawerOpen ? "open" : ""}`}>
        <div className="drawer-header">
          <h2 style={{ fontSize: '1.2rem', margin: 0, color: '#1877f2' }}>Admin Portal</h2>
          <button style={{ background: 'none', border: 'none', fontSize: '1.75rem', cursor: 'pointer', color: '#6b7280' }} onClick={() => setIsDrawerOpen(false)}>×</button>
        </div>
        
        {/* CREATE DROPDOWN MENU */}
        <div className="drawer-link" onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)} style={{ fontWeight: 'bold' }}>
          Create
          <span style={{ fontSize: '0.8rem', transform: isCreateMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
        </div>
        
        {isCreateMenuOpen && (
          <div className="sub-menu">
            <div className={`sub-drawer-link ${activeView === "create-room" ? "active" : ""}`} onClick={() => { setActiveView("create-room"); setIsDrawerOpen(false); }}>
              Create Room
            </div>
            <div className={`sub-drawer-link ${activeView === "create-teacher" ? "active" : ""}`} onClick={() => { setActiveView("create-teacher"); setIsDrawerOpen(false); }}>
              Teacher Account
            </div>
            <div className={`sub-drawer-link ${activeView === "create-parent" ? "active" : ""}`} onClick={() => { setActiveView("create-parent"); setIsDrawerOpen(false); }}>
              Parent Account
            </div>
          </div>
        )}

        <div className={`drawer-link ${activeView === "manage" ? "active" : ""}`} onClick={() => { setActiveView("manage"); setIsDrawerOpen(false); setCurrentPage(1); }} style={{ fontWeight: 'bold' }}>
          Manage Users
        </div>
      </div>


      {/* =========================================
          VIEW: CREATE ROOM
      ========================================= */}
      {activeView === "create-room" && (
        <div className="card">
          <h3>Create New Room</h3>
          <p className="subtext">Create class sections and optionally assign a teacher.</p>
          <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '500px' }}>
            
            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Grade Level</label>
            <select className="auth-input" name="grade" value={roomForm.grade} onChange={handleRoomChange} required>
              {[1, 2, 3, 4, 5, 6].map(g => <option key={g} value={g}>Grade {g}</option>)}
            </select>

            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Section Name</label>
            <input className="auth-input" type="text" name="section" placeholder="e.g. Apollo" value={roomForm.section} onChange={handleRoomChange} required />

            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Assign Adviser (Optional)</label>
            <select className="auth-input" name="assignedTeacherId" value={roomForm.assignedTeacherId} onChange={handleRoomChange}>
              <option value="">-- Leave Unassigned --</option>
              {users
                .filter(u => u.role === "teacher")
                .sort((a, b) => (a.lastName || "").localeCompare(b.lastName || ""))
                .map(t => (
                  <option key={t.id} value={t.id}>
                    {t.lastName}, {t.firstName} {t.middleInitial ? t.middleInitial + '.' : ''}
                  </option>
              ))}
            </select>

            <button className="btn-primary" type="submit" style={{ marginTop: '10px' }}>Create Room</button>
          </form>

          <hr style={{ margin: '2.5rem 0 1.5rem 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />
          
          <h3>Active Rooms</h3>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Section</th>
                  <th>Assigned Adviser</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.length === 0 ? (
                  <tr><td colSpan="4" className="empty-state">No rooms have been created yet.</td></tr>
                ) : (
                  rooms.map(room => (
                    <tr key={room.id}>
                      <td style={{ fontWeight: '600' }}>Grade {room.grade}</td>
                      <td>{room.name}</td>
                      <td style={{ color: room.assignedTeacherName === "Unassigned" ? '#9ca3af' : '#1877f2', fontWeight: '500' }}>
                        {room.assignedTeacherName || "Unassigned"}
                      </td>
                      <td>
                        <button className="btn-outline" style={{ color: '#dc2626', borderColor: '#dc2626', padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handleDeleteRoom(room.id, room.name)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* =========================================
          VIEW: CREATE TEACHER
      ========================================= */}
      {activeView === "create-teacher" && (
        <div className="card">
          <h3>Create Teacher Account</h3>
          <form onSubmit={(e) => handleCreateUser(e, "teacher")} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '500px' }}>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>First Name</label>
                <input className="auth-input" type="text" name="firstName" value={formData.firstName} onChange={handleUserChange} required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>M.I.</label>
                <input className="auth-input" type="text" name="middleInitial" placeholder="X" value={formData.middleInitial} onChange={handleUserChange} maxLength="1" />
              </div>
            </div>

            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Last Name</label>
            <input className="auth-input" type="text" name="lastName" value={formData.lastName} onChange={handleUserChange} required />

            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Email Address</label>
            <input className="auth-input" type="email" name="email" value={formData.email} onChange={handleUserChange} required />

            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Assign Password</label>
            <input className="auth-input" type="text" name="password" placeholder="Password" value={formData.password} onChange={handleUserChange} required />

            <button className="btn-primary" type="submit" style={{ marginTop: '10px' }}>Create Teacher Profile</button>
          </form>
        </div>
      )}


      {/* =========================================
          VIEW: CREATE PARENT
      ========================================= */}
      {activeView === "create-parent" && (
        <div className="card">
          <h3>Create Parent Account</h3>
          <form onSubmit={(e) => handleCreateUser(e, "parent")} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '500px' }}>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>First Name</label>
                <input className="auth-input" type="text" name="firstName" value={formData.firstName} onChange={handleUserChange} required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>M.I.</label>
                <input className="auth-input" type="text" name="middleInitial" placeholder="X" value={formData.middleInitial} onChange={handleUserChange} maxLength="1" />
              </div>
            </div>

            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Last Name</label>
            <input className="auth-input" type="text" name="lastName" value={formData.lastName} onChange={handleUserChange} required />

            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Email Address</label>
            <input className="auth-input" type="email" name="email" value={formData.email} onChange={handleUserChange} required />

            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Assign Room</label>
            <select className="auth-input" name="assignedRoom" value={formData.assignedRoom} onChange={handleUserChange} required>
              <option value="">-- Select a Room --</option>
              {rooms.map(r => (
                <option key={r.id} value={`Grade ${r.grade} - ${r.name}`}>
                  Grade {r.grade} - {r.name}
                </option>
              ))}
            </select>

            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Assigned Student LRN</label>
            {/* Using type="text" with inputMode="numeric" prevents letters and works best on mobile keyboards */}
            <input className="auth-input" type="text" inputMode="numeric" pattern="\d*" name="studentLRN" placeholder="12-digit LRN" maxLength="12" value={formData.studentLRN} onChange={handleUserChange} required />

            <label style={{ fontWeight: '600', fontSize: '0.875rem' }}>Assign Password</label>
            <input className="auth-input" type="text" name="password" placeholder="Password" value={formData.password} onChange={handleUserChange} required />

            <button className="btn-primary" type="submit" style={{ marginTop: '10px' }}>Create Parent Profile</button>
          </form>
        </div>
      )}


      {/* =========================================
          VIEW: MANAGE USERS 
      ========================================= */}
      {activeView === "manage" && (
        <div className="card">
          <h3>Manage Users</h3>
          
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
            <div style={{ flex: '1', minWidth: '150px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Role Filter</label>
              <select className="auth-input" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}>
                <option value="teacher">Teachers</option>
                <option value="parent">Parents</option>
              </select>
            </div>

            {roleFilter === "parent" && (
              <>
                <div style={{ flex: '1', minWidth: '120px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Grade</label>
                  <select className="auth-input" value={gradeFilter} onChange={(e) => { setGradeFilter(e.target.value); setSectionFilter(""); setCurrentPage(1); }}>
                    <option value="">All Grades</option>
                    {[1, 2, 3, 4, 5, 6].map(g => <option key={g} value={g}>Grade {g}</option>)}
                  </select>
                </div>

                <div style={{ flex: '1', minWidth: '150px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Section</label>
                  <select className="auth-input" value={sectionFilter} onChange={(e) => { setSectionFilter(e.target.value); setCurrentPage(1); }} disabled={!gradeFilter}>
                    <option value="">All Sections</option>
                    {availableSections.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Name (A-Z)</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Assigned Room</th>
                  {roleFilter === "parent" && <th>Student LRN</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentDisplayedUsers.length === 0 ? (
                  <tr><td colSpan="6" className="empty-state">No users match the current filters.</td></tr>
                ) : (
                  currentDisplayedUsers.map(user => (
                    <tr key={user.id}>
                      <td style={{ fontWeight: '600' }}>
                        {user.lastName}, {user.firstName} {user.middleInitial ? user.middleInitial + '.' : ''}
                      </td>
                      <td>
                        <span className="badge" style={{ backgroundColor: user.role === 'teacher' ? '#dbeafe' : '#fef3c7', color: user.role === 'teacher' ? '#1e3a8a' : '#92400e' }}>
                          {user.role.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ color: '#4b5563', fontSize: '0.875rem' }}>{user.email}</td>
                      <td style={{ color: '#6b7280', fontSize: '0.875rem' }}>{user.assignedRoom || "Unassigned"}</td>
                      {roleFilter === "parent" && <td style={{ color: '#6b7280', fontSize: '0.875rem' }}>{user.studentLRN || "N/A"}</td>}
                      <td>
                        <button className="btn-outline" style={{ color: '#dc2626', borderColor: '#dc2626', padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => handleDeleteUser(user.id, user.fullName)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalItems > 0 && (
            <div className="pagination-controls" style={{ marginTop: '1.5rem' }}>
              <button className="btn-outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                Previous
              </button>
              
              <span style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#374151' }}>
                {Math.min(indexOfLastItem, totalItems)} / {totalItems}
              </span>
              
              <button className="btn-outline" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </SidebarLayout>
  );
}